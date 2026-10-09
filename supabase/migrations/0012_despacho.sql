-- Paso 003 · Despacho (plan R2 a R11, R19, R22).
-- Ofertas por conductor, aceptación atómica, estado "sin_conductor", transiciones
-- validadas por la BD y cierre del hueco que dejaba tomar un viaje sin oferta.
--
-- Quién ejecuta qué:
--   * El despachador del backend usa la clave de servicio y llama a las funciones
--     "del sistema" (security invoker, solo service_role).
--   * El conductor acepta o rechaza con su JWT: envoltorio invoker en public que
--     llama a una función security definer en private (el linter no la ve expuesta).
--   * Dentro de una función security definer, current_user es su dueño, no
--     "authenticated": así los triggers distinguen al usuario del sistema.

-- ESTADO "SIN CONDUCTOR" -----------------------------------------------------
alter table public.viajes drop constraint viajes_estado_check;
alter table public.viajes add constraint viajes_estado_check
  check (estado in ('solicitado', 'aceptado', 'en_curso', 'finalizado', 'cancelado', 'sin_conductor'));

-- Solicitudes viejas que nadie atendió (había una de pruebas en producción).
-- Sin esto no se puede crear el índice de un viaje activo por pasajero.
update public.viajes
   set estado = 'sin_conductor', finalizado_en = now()
 where estado = 'solicitado' and creado_en < now() - interval '2 minutes';

-- VIAJES: LUGARES, UN VIAJE ACTIVO POR PASAJERO ----------------------------
alter table public.viajes
  add column lugar_origen_id  uuid references public.lugares(id) on delete set null,
  add column lugar_destino_id uuid references public.lugares(id) on delete set null;
create index idx_viajes_lugar_origen on public.viajes (lugar_origen_id);
create index idx_viajes_lugar_destino on public.viajes (lugar_destino_id);

create unique index uq_viajes_activo_por_pasajero on public.viajes (pasajero_id)
  where estado in ('solicitado', 'aceptado', 'en_curso');

-- Con un lugar elegido, el servidor toma sus coordenadas y su nombre (el cliente no
-- puede moverlo); el sector sale del centro más cercano cuando no llega (criterio 19).
create or replace function private.completar_viaje()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_lugar record;
begin
  if new.lugar_origen_id is not null then
    select l.ubicacion, l.nombre into v_lugar
      from public.lugares l where l.id = new.lugar_origen_id and l.visible;
    if not found then
      raise exception 'lugar_no_disponible' using errcode = 'check_violation';
    end if;
    new.origen := v_lugar.ubicacion;
    new.origen_descripcion := left(v_lugar.nombre || coalesce(' · ' || new.origen_descripcion, ''), 200);
  end if;
  if new.lugar_destino_id is not null then
    select l.ubicacion, l.nombre into v_lugar
      from public.lugares l where l.id = new.lugar_destino_id and l.visible;
    if not found then
      raise exception 'lugar_no_disponible' using errcode = 'check_violation';
    end if;
    new.destino := v_lugar.ubicacion;
    new.destino_descripcion := left(v_lugar.nombre || coalesce(' · ' || new.destino_descripcion, ''), 200);
  end if;
  new.sector_origen_id := coalesce(new.sector_origen_id, private.sector_mas_cercano(new.origen));
  new.sector_destino_id := coalesce(new.sector_destino_id, private.sector_mas_cercano(new.destino));
  return new;
end;
$$;
create trigger viajes_completar
  before insert on public.viajes
  for each row execute function private.completar_viaje();

-- TRANSICIONES (R4) --------------------------------------------------------
-- Para un usuario de la app solo valen las transiciones de esta lista. "aceptado"
-- y "sin_conductor" los ponen únicamente las funciones del sistema.
create or replace function private.controlar_transicion_viaje()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_es_participante boolean := v_uid in (old.pasajero_id, old.conductor_id);
begin
  if new.estado in ('finalizado', 'cancelado', 'sin_conductor') and new.estado is distinct from old.estado then
    new.finalizado_en := now();
  end if;
  if current_user <> 'authenticated' or new.estado is not distinct from old.estado then
    return new;
  end if;
  if (old.estado = 'solicitado' and new.estado = 'cancelado' and v_uid = old.pasajero_id)
     or (old.estado = 'aceptado' and new.estado in ('en_curso', 'cancelado') and v_es_participante)
     or (old.estado = 'en_curso' and new.estado = 'finalizado' and v_es_participante) then
    return new;
  end if;
  raise exception 'transicion_no_permitida: % -> %', old.estado, new.estado
    using errcode = 'insufficient_privilege';
end;
$$;
create trigger viajes_controlar_transicion
  before update on public.viajes
  for each row execute function private.controlar_transicion_viaje();

-- Sin la rama "conductor tomando un viaje libre": eso solo pasa por aceptar_viaje().
drop policy viajes_update on public.viajes;
create policy viajes_update on public.viajes for update to authenticated
  using (pasajero_id = (select auth.uid()) or conductor_id = (select auth.uid()))
  with check (pasajero_id = (select auth.uid()) or conductor_id = (select auth.uid()));

revoke update on public.viajes from anon, authenticated;
grant update (estado, finalizado_en) on public.viajes to authenticated;

-- TRICIMOTOS: FRESCURA DE UBICACIÓN Y DESDE CUÁNDO ESTÁ DISPONIBLE (R9) -------
alter table public.tricimotos
  add column ubicacion_en     timestamptz,
  add column disponible_desde timestamptz;

-- "UPDATE OF ubicacion_actual" se dispara aunque el punto no cambie: un conductor
-- parado sigue contando como ubicado mientras envíe su posición (criterio 2).
create or replace function private.marcar_ubicacion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.ubicacion_actual is not null then
    new.ubicacion_en := now();
  end if;
  return new;
end;
$$;
create trigger tricimotos_marcar_ubicacion
  before insert or update of ubicacion_actual on public.tricimotos
  for each row execute function private.marcar_ubicacion();

create or replace function private.marcar_disponible()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'disponible' then
    if tg_op = 'INSERT' or old.estado is distinct from 'disponible' then
      new.disponible_desde := now();
    end if;
  else
    new.disponible_desde := null;
  end if;
  return new;
end;
$$;
create trigger tricimotos_marcar_disponible
  before insert or update of estado on public.tricimotos
  for each row execute function private.marcar_disponible();

-- OFERTAS (R1, R7; criterio 17: sin coordenadas) -----------------------------
create table public.ofertas_viaje (
  id             uuid primary key default gen_random_uuid(),
  viaje_id       uuid not null references public.viajes(id) on delete cascade,
  conductor_id   uuid not null references public.perfiles(id) on delete cascade,
  fase           text not null check (fase in ('secuencial', 'abierta')),
  enviada_en     timestamptz not null default now(),
  vence_en       timestamptz not null,
  respondida_en  timestamptz,
  resultado      text not null default 'pendiente'
                 check (resultado in ('pendiente', 'aceptada', 'rechazada', 'vencida', 'cancelada', 'tomada')),
  distancia_m    integer check (distancia_m >= 0),
  unique (viaje_id, conductor_id),
  check (vence_en > enviada_en)
);
create index idx_ofertas_conductor on public.ofertas_viaje (conductor_id);
create index idx_ofertas_pendientes_vence on public.ofertas_viaje (vence_en) where resultado = 'pendiente';
-- Una oferta abierta a la vez por conductor (criterio 7).
create unique index uq_ofertas_una_pendiente_por_conductor on public.ofertas_viaje (conductor_id)
  where resultado = 'pendiente';

alter table public.ofertas_viaje enable row level security;
create policy ofertas_select on public.ofertas_viaje for select to authenticated
  using (conductor_id = (select auth.uid()) or private.rol_actual() = 'admin');
revoke all on public.ofertas_viaje from anon, authenticated;
grant select on public.ofertas_viaje to authenticated;

-- El conductor solo ve un viaje "solicitado" si tiene una oferta abierta de ese viaje
-- (antes lo veía cualquier conductor aprobado, con las coordenadas del pasajero).
create or replace function private.tiene_oferta_pendiente(p_viaje uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ofertas_viaje o
    where o.viaje_id = p_viaje and o.conductor_id = (select auth.uid())
      and o.resultado = 'pendiente' and o.vence_en > now()
  );
$$;

drop policy viajes_select on public.viajes;
create policy viajes_select on public.viajes for select to authenticated
  using (pasajero_id = (select auth.uid())
         or conductor_id = (select auth.uid())
         or (estado = 'solicitado' and private.tiene_oferta_pendiente(id))
         or private.rol_actual() = 'admin');

-- EFECTOS AL CERRAR UN VIAJE (R11) Y AL DEJAR DE ESTAR DISPONIBLE --------------
-- security definer: el pasajero que cancela no puede escribir ofertas ni tricimotos.
create or replace function private.al_cambiar_estado_viaje()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.estado = 'solicitado' and new.estado in ('cancelado', 'sin_conductor') then
    update public.ofertas_viaje
       set resultado = case when new.estado = 'cancelado' then 'cancelada' else 'vencida' end,
           respondida_en = now()
     where viaje_id = new.id and resultado = 'pendiente';
  end if;
  if new.estado in ('finalizado', 'cancelado', 'sin_conductor') and new.conductor_id is not null then
    update public.tricimotos set estado = 'disponible'
     where conductor_id = new.conductor_id and estado = 'ocupado';
  end if;
  return null;
end;
$$;
create trigger viajes_al_cambiar_estado
  after update of estado on public.viajes
  for each row when (old.estado is distinct from new.estado)
  execute function private.al_cambiar_estado_viaje();

create or replace function private.al_dejar_disponible()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.ofertas_viaje
     set resultado = 'rechazada', respondida_en = now()
   where conductor_id = new.conductor_id and resultado = 'pendiente';
  return null;
end;
$$;
create trigger tricimotos_al_dejar_disponible
  after update of estado on public.tricimotos
  for each row when (old.estado = 'disponible' and new.estado <> 'disponible')
  execute function private.al_dejar_disponible();

-- FUNCIONES DEL SISTEMA (solo service_role; R5, R22) -------------------------
-- Candidatos ordenados por distancia en tramos de 50 m y, a igual tramo, por quién
-- lleva más tiempo disponible (criterios 2 a 7).
create or replace function public.candidatos_despacho(p_viaje uuid, p_ubicacion_max_seg integer default 60)
returns table (conductor_id uuid, distancia_m integer, disponible_desde timestamptz)
language sql stable security invoker set search_path = '' as $$
  select t.conductor_id,
         round(extensions.st_distance(t.ubicacion_actual, v.origen))::integer as distancia_m,
         t.disponible_desde
  from public.viajes v
  join public.tricimotos t on true
  join public.perfiles p on p.id = t.conductor_id and p.activo and p.rol = 'conductor'
  join public.conductores_verificacion cv on cv.conductor_id = t.conductor_id and cv.estado = 'aprobado'
  where v.id = p_viaje
    and v.estado = 'solicitado'
    and t.estado = 'disponible'
    and t.ubicacion_actual is not null
    and t.ubicacion_en > now() - make_interval(secs => p_ubicacion_max_seg)
    and t.conductor_id is distinct from v.pasajero_id
    and not exists (select 1 from public.viajes a
                    where a.conductor_id = t.conductor_id and a.estado in ('aceptado', 'en_curso'))
    and not exists (select 1 from public.ofertas_viaje o
                    where o.conductor_id = t.conductor_id
                      and (o.resultado = 'pendiente' or o.viaje_id = p_viaje))
  order by floor(extensions.st_distance(t.ubicacion_actual, v.origen) / 50),
           t.disponible_desde nulls last,
           t.conductor_id
$$;

-- Crea ofertas para los conductores indicados. Omite a quien ya tiene una oferta
-- pendiente o ya recibió este viaje (índices únicos) y no hace nada si el viaje ya
-- no busca conductor.
create or replace function public.crear_ofertas(p_viaje uuid, p_conductores uuid[], p_fase text, p_vence_en timestamptz)
returns setof public.ofertas_viaje
language sql volatile security invoker set search_path = '' as $$
  insert into public.ofertas_viaje (viaje_id, conductor_id, fase, vence_en, distancia_m)
  select v.id, t.conductor_id, p_fase, p_vence_en,
         round(extensions.st_distance(t.ubicacion_actual, v.origen))::integer
  from public.viajes v
  join public.tricimotos t on t.conductor_id = any (p_conductores)
  where v.id = p_viaje and v.estado = 'solicitado'
  on conflict do nothing
  returning *
$$;

-- Vence las ofertas pasadas de hora y cierra como "sin_conductor" las solicitudes
-- más viejas que p_max_seg. Devuelve lo que cambió para avisar a cada uno (criterio 14).
create or replace function public.cerrar_vencidos(p_max_seg integer default 120)
returns table (tipo text, viaje_id uuid, usuario_id uuid)
language plpgsql volatile security invoker set search_path = '' as $$
begin
  return query
    with vencidas as (
      update public.ofertas_viaje o set resultado = 'vencida', respondida_en = now()
       where o.resultado = 'pendiente' and o.vence_en <= now()
      returning o.viaje_id, o.conductor_id
    )
    select 'oferta_vencida'::text, vencidas.viaje_id, vencidas.conductor_id from vencidas;

  -- Primero las ofertas pendientes de esos viajes, para avisar a sus conductores.
  return query
    select 'oferta_retirada'::text, o.viaje_id, o.conductor_id
    from public.ofertas_viaje o
    join public.viajes v on v.id = o.viaje_id
    where o.resultado = 'pendiente' and v.estado = 'solicitado'
      and v.creado_en <= now() - make_interval(secs => p_max_seg);

  return query
    with cerrados as (
      update public.viajes v set estado = 'sin_conductor'
       where v.estado = 'solicitado' and v.creado_en <= now() - make_interval(secs => p_max_seg)
      returning v.id, v.pasajero_id
    )
    select 'viaje_sin_conductor'::text, cerrados.id, cerrados.pasajero_id from cerrados;
end;
$$;

-- Cierra un viaje concreto cuando ya no quedan candidatos (criterio 11).
create or replace function public.cerrar_sin_conductor(p_viaje uuid)
returns table (tipo text, viaje_id uuid, usuario_id uuid)
language plpgsql volatile security invoker set search_path = '' as $$
begin
  return query
    select 'oferta_retirada'::text, o.viaje_id, o.conductor_id
    from public.ofertas_viaje o
    join public.viajes v on v.id = o.viaje_id
    where o.viaje_id = p_viaje and o.resultado = 'pendiente' and v.estado = 'solicitado';
  return query
    with cerrado as (
      update public.viajes v set estado = 'sin_conductor'
       where v.id = p_viaje and v.estado = 'solicitado'
      returning v.id, v.pasajero_id
    )
    select 'viaje_sin_conductor'::text, cerrado.id, cerrado.pasajero_id from cerrado;
end;
$$;

revoke all on function public.candidatos_despacho(uuid, integer) from public, anon, authenticated;
revoke all on function public.crear_ofertas(uuid, uuid[], text, timestamptz) from public, anon, authenticated;
revoke all on function public.cerrar_vencidos(integer) from public, anon, authenticated;
revoke all on function public.cerrar_sin_conductor(uuid) from public, anon, authenticated;
grant execute on function public.candidatos_despacho(uuid, integer) to service_role;
grant execute on function public.crear_ofertas(uuid, uuid[], text, timestamptz) to service_role;
grant execute on function public.cerrar_vencidos(integer) to service_role;
grant execute on function public.cerrar_sin_conductor(uuid) to service_role;

-- FUNCIONES DEL CONDUCTOR (R2, R3) -------------------------------------------
-- Aceptación atómica (criterios 8, 9 y 10). El FOR UPDATE hace esperar al segundo
-- conductor; cuando el primero confirma, el segundo ve el viaje ya aceptado.
create or replace function private.aceptar_viaje(p_viaje uuid)
returns table (viaje_id uuid, thread_id uuid)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_viaje public.viajes%rowtype;
  v_thread uuid;
begin
  if not private.es_conductor_aprobado() then
    raise exception 'conductor_no_aprobado' using errcode = 'insufficient_privilege';
  end if;

  select * into v_viaje from public.viajes v where v.id = p_viaje for update;
  if not found or v_viaje.estado <> 'solicitado' then
    raise exception 'viaje_no_disponible' using errcode = 'P0001';
  end if;

  update public.ofertas_viaje o set resultado = 'aceptada', respondida_en = now()
   where o.viaje_id = p_viaje and o.conductor_id = v_uid
     and o.resultado = 'pendiente' and o.vence_en > now();
  if not found then
    raise exception 'oferta_no_vigente' using errcode = 'P0001';
  end if;

  update public.ofertas_viaje o set resultado = 'tomada', respondida_en = now()
   where o.viaje_id = p_viaje and o.resultado = 'pendiente';

  update public.viajes v set conductor_id = v_uid, estado = 'aceptado', aceptado_en = now()
   where v.id = p_viaje;

  update public.tricimotos t set estado = 'ocupado' where t.conductor_id = v_uid;

  insert into public.threads (viaje_id, created_by) values (p_viaje, v_uid)
  returning id into v_thread;
  insert into public.thread_members (thread_id, user_id) values
    (v_thread, v_viaje.pasajero_id), (v_thread, v_uid);

  return query select p_viaje, v_thread;
end;
$$;

create or replace function private.rechazar_oferta(p_viaje uuid)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.ofertas_viaje o set resultado = 'rechazada', respondida_en = now()
   where o.viaje_id = p_viaje and o.conductor_id = (select auth.uid()) and o.resultado = 'pendiente';
  return found;
end;
$$;

create or replace function public.aceptar_viaje(p_viaje uuid)
returns table (viaje_id uuid, thread_id uuid)
language sql volatile security invoker set search_path = '' as $$
  select * from private.aceptar_viaje(p_viaje)
$$;

create or replace function public.rechazar_oferta(p_viaje uuid)
returns boolean
language sql volatile security invoker set search_path = '' as $$
  select private.rechazar_oferta(p_viaje)
$$;

revoke all on function public.aceptar_viaje(uuid) from public, anon;
revoke all on function public.rechazar_oferta(uuid) from public, anon;
grant execute on function public.aceptar_viaje(uuid) to authenticated;
grant execute on function public.rechazar_oferta(uuid) to authenticated;

-- Funciones nuevas de private: solo authenticated (como en 0005 y 0010).
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
-- La clave de servicio (despachador) dispara triggers que usan funciones de private.
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

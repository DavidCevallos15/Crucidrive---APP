-- 005 · Viaje en curso: recogida, llegada, cierre, cancelación con motivo, confirmación de las
-- dos partes y calificaciones (plan P1 a P5).
--
-- Igual que aceptar_viaje (0012): cada paso es una función security definer en private, con
-- un envoltorio security invoker en public para la app. Dentro de la función current_user es
-- su dueño, así que controlar_transicion_viaje la deja pasar; un cliente ya no puede cambiar
-- el estado por REST porque se le quita el permiso de update.

-- P1 · COLUMNAS --------------------------------------------------------------
alter table public.viajes
  add column llegado_en timestamptz,
  add column cancelado_por text check (cancelado_por in ('pasajero', 'conductor')),
  -- Mismos códigos que MOTIVOS_CANCELACION en backend/src/utils/validation.js.
  add column motivo_cancelacion text
    check (motivo_cancelacion in ('ya_no_lo_necesito', 'tarda_demasiado', 'no_encuentro_al_pasajero', 'otro')),
  add column confirmacion_pasajero text check (confirmacion_pasajero in ('llego', 'no_llego')),
  add column confirmado_en timestamptz,
  -- Quién finalizó: el pasajero también puede, con sanción (criterios 5b y 5c).
  add column finalizado_por text check (finalizado_por in ('conductor', 'pasajero'));
create index idx_viajes_finalizados_por_pasajero on public.viajes (pasajero_id, finalizado_en)
  where finalizado_por = 'pasajero';

-- P2 · TRANSICIONES SOLO POR FUNCIONES (criterio 6) -----------------------------
revoke update (estado, finalizado_en) on public.viajes from authenticated;

-- Viaje del que el usuario es el conductor asignado, bloqueado para el resto de la operación.
create or replace function private.viaje_del_conductor(p_viaje uuid)
returns public.viajes language plpgsql security definer set search_path = '' as $$
declare v public.viajes;
begin
  select * into v from public.viajes where id = p_viaje for update;
  if not found or v.conductor_id is distinct from (select auth.uid()) then
    raise exception 'no_es_tu_viaje' using errcode = 'insufficient_privilege';
  end if;
  return v;
end;
$$;

create or replace function private.marcar_llegada(p_viaje uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.viajes := private.viaje_del_conductor(p_viaje);
begin
  if v.estado <> 'aceptado' then raise exception 'estado_no_permite' using errcode = 'P0001'; end if;
  update public.viajes set llegado_en = coalesce(llegado_en, now()) where id = p_viaje;
end;
$$;

create or replace function private.iniciar_viaje(p_viaje uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.viajes := private.viaje_del_conductor(p_viaje);
begin
  if v.estado <> 'aceptado' then raise exception 'estado_no_permite' using errcode = 'P0001'; end if;
  update public.viajes set estado = 'en_curso', llegado_en = coalesce(llegado_en, now()) where id = p_viaje;
end;
$$;

-- Finaliza el conductor o, con sanción, el pasajero (criterios 5 y 5b); solo en curso.
-- El trigger del 003 (al_cambiar_estado_viaje) deja al conductor disponible.
create or replace function private.terminar_viaje(p_viaje uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.viajes;
  v_uid uuid := (select auth.uid());
begin
  select * into v from public.viajes where id = p_viaje for update;
  -- is distinct from: con conductor_id NULL (buscando), "not in" daría NULL y dejaría pasar a un tercero.
  if not found or (v_uid is distinct from v.pasajero_id and v_uid is distinct from v.conductor_id) then
    raise exception 'no_es_tu_viaje' using errcode = 'insufficient_privilege';
  end if;
  if v.estado <> 'en_curso' then raise exception 'estado_no_permite' using errcode = 'P0001'; end if;
  update public.viajes
     set estado = 'finalizado',
         finalizado_por = case when v_uid = v.conductor_id then 'conductor' else 'pasajero' end
   where id = p_viaje;
end;
$$;

-- Pasajero: buscando (motivo opcional, como en el 003) o aceptado (motivo obligatorio).
-- Conductor: aceptado, con motivo. En curso nadie cancela (criterio 9).
create or replace function private.cancelar_viaje(p_viaje uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.viajes;
  v_uid uuid := (select auth.uid());
  v_quien text;
begin
  select * into v from public.viajes where id = p_viaje for update;
  -- is distinct from: con conductor_id NULL (buscando), "not in" daría NULL y dejaría pasar a un tercero.
  if not found or (v_uid is distinct from v.pasajero_id and v_uid is distinct from v.conductor_id) then
    raise exception 'no_es_tu_viaje' using errcode = 'insufficient_privilege';
  end if;
  v_quien := case when v_uid = v.pasajero_id then 'pasajero' else 'conductor' end;
  if not (v.estado = 'aceptado' or (v.estado = 'solicitado' and v_quien = 'pasajero')) then
    raise exception 'estado_no_permite' using errcode = 'P0001';
  end if;
  if v.estado = 'aceptado' and p_motivo is null then
    raise exception 'motivo_requerido' using errcode = 'P0001';
  end if;
  update public.viajes
     set estado = 'cancelado', cancelado_por = v_quien, motivo_cancelacion = p_motivo
   where id = p_viaje;
end;
$$;

-- Criterio 5a: el pasajero confirma una sola vez que llegó (o que no).
create or replace function private.confirmar_llegada(p_viaje uuid, p_llego boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.viajes;
begin
  select * into v from public.viajes where id = p_viaje for update;
  if not found or v.pasajero_id is distinct from (select auth.uid()) then
    raise exception 'no_es_tu_viaje' using errcode = 'insufficient_privilege';
  end if;
  if v.estado <> 'finalizado' or v.finalizado_por = 'pasajero' or v.confirmacion_pasajero is not null or p_llego is null then
    raise exception 'estado_no_permite' using errcode = 'P0001';
  end if;
  update public.viajes
     set confirmacion_pasajero = case when p_llego then 'llego' else 'no_llego' end, confirmado_en = now()
   where id = p_viaje;
end;
$$;

-- P3 · PUNTO DE RECOGIDA (criterios 1 y 2) -------------------------------------
create or replace function private.punto_recogida(p_viaje uuid)
returns table (lat double precision, lng double precision)
language sql stable security definer set search_path = '' as $$
  select extensions.st_y(v.origen::extensions.geometry), extensions.st_x(v.origen::extensions.geometry)
  from public.viajes v
  where v.id = p_viaje
    and v.conductor_id = (select auth.uid())
    and v.estado in ('aceptado', 'en_curso')
$$;

-- P4 · CALIFICACIONES (criterios 15 a 19) --------------------------------------
create table public.calificaciones (
  viaje_id     uuid primary key references public.viajes(id) on delete cascade,
  conductor_id uuid not null references public.perfiles(id) on delete cascade,
  estrellas    smallint not null check (estrellas between 1 and 5),
  -- Igual que validarComentario (backend): sin enlaces ni teléfonos (7 o más dígitos,
  -- aunque vengan separados por espacios, puntos o guiones).
  comentario   text check (comentario is null or (
                 char_length(btrim(comentario)) between 1 and 280
                 and comentario !~* '(https?://|www\.)'
                 and regexp_replace(comentario, '[[:space:].-]', '', 'g') !~ '[0-9]{7,}')),
  creado_en    timestamptz not null default now()
);
create index idx_calificaciones_conductor on public.calificaciones (conductor_id, creado_en desc);
alter table public.calificaciones enable row level security;
revoke all on public.calificaciones from anon, authenticated;
grant all on public.calificaciones to service_role;
-- Sin lectura directa desde la app (LOPDP, criterio 17): el conductor no puede cruzar viaje_id
-- con el pasajero. Solo el administrador lee la tabla (moderación, paso 006).
grant select on public.calificaciones to authenticated;
create policy calificaciones_admin on public.calificaciones for select to authenticated
  using (private.rol_actual() = 'admin');

-- Calificar también confirma la llegada si el pasajero no lo había hecho (criterio 15).
create or replace function private.calificar_viaje(p_viaje uuid, p_estrellas integer, p_comentario text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.viajes;
begin
  select * into v from public.viajes where id = p_viaje for update;
  if not found or v.pasajero_id is distinct from (select auth.uid()) then
    raise exception 'no_es_tu_viaje' using errcode = 'insufficient_privilege';
  end if;
  if v.estado <> 'finalizado' or v.conductor_id is null or v.finalizado_por = 'pasajero'
     or v.confirmacion_pasajero = 'no_llego' then
    raise exception 'no_calificable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.calificaciones c where c.viaje_id = p_viaje) then
    raise exception 'ya_calificado' using errcode = 'P0001';
  end if;
  if v.confirmacion_pasajero is null then
    update public.viajes set confirmacion_pasajero = 'llego', confirmado_en = now() where id = p_viaje;
  end if;
  insert into public.calificaciones (viaje_id, conductor_id, estrellas, comentario)
  values (p_viaje, v.conductor_id, p_estrellas, nullif(btrim(p_comentario), ''));
end;
$$;

-- Reseñas propias del conductor: sin viaje_id ni hora, solo la fecha (criterio 17).
create or replace function private.mis_resenas()
returns table (estrellas smallint, comentario text, fecha date)
language sql stable security definer set search_path = '' as $$
  select c.estrellas, c.comentario, c.creado_en::date
  from public.calificaciones c
  where c.conductor_id = (select auth.uid())
  order by c.creado_en desc
  limit 100
$$;

-- Promedio y número de reseñas: para el propio conductor o para el pasajero que viaja con él
-- (criterio 18). A cualquier otro no le devuelve nada.
create or replace function private.resumen_conductor(p_conductor uuid)
returns table (promedio numeric, total integer)
language sql stable security definer set search_path = '' as $$
  select round(avg(c.estrellas)::numeric, 1), count(*)::integer
  from public.calificaciones c
  where c.conductor_id = p_conductor
    and ((select auth.uid()) = p_conductor
         or exists (select 1 from public.viajes v
                    where v.conductor_id = p_conductor and v.pasajero_id = (select auth.uid())
                      and v.estado in ('aceptado', 'en_curso')))
$$;

-- P5 · CHAT EN SOLO LECTURA AL TERMINAR (criterio 7) ----------------------------
create or replace function private.hilo_abierto(p_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.threads h join public.viajes v on v.id = h.viaje_id
                     where h.id = p_thread and v.estado in ('finalizado', 'cancelado', 'sin_conductor'))
$$;
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.es_miembro_hilo(thread_id) and private.hilo_abierto(thread_id));

-- ENVOLTORIOS PARA LA APP -------------------------------------------------------
create or replace function public.marcar_llegada(p_viaje uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.marcar_llegada(p_viaje) $$;
create or replace function public.iniciar_viaje(p_viaje uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.iniciar_viaje(p_viaje) $$;
create or replace function public.terminar_viaje(p_viaje uuid) returns void
language sql volatile security invoker set search_path = '' as $$ select private.terminar_viaje(p_viaje) $$;
create or replace function public.cancelar_viaje(p_viaje uuid, p_motivo text default null) returns void
language sql volatile security invoker set search_path = '' as $$ select private.cancelar_viaje(p_viaje, p_motivo) $$;
create or replace function public.confirmar_llegada(p_viaje uuid, p_llego boolean) returns void
language sql volatile security invoker set search_path = '' as $$ select private.confirmar_llegada(p_viaje, p_llego) $$;
create or replace function public.punto_recogida(p_viaje uuid) returns table (lat double precision, lng double precision)
language sql stable security invoker set search_path = '' as $$ select * from private.punto_recogida(p_viaje) $$;
create or replace function public.calificar_viaje(p_viaje uuid, p_estrellas integer, p_comentario text default null) returns void
language sql volatile security invoker set search_path = '' as $$ select private.calificar_viaje(p_viaje, p_estrellas, p_comentario) $$;
create or replace function public.mis_resenas() returns table (estrellas smallint, comentario text, fecha date)
language sql stable security invoker set search_path = '' as $$ select * from private.mis_resenas() $$;
create or replace function public.resumen_conductor(p_conductor uuid) returns table (promedio numeric, total integer)
language sql stable security invoker set search_path = '' as $$ select * from private.resumen_conductor(p_conductor) $$;

revoke all on function public.marcar_llegada(uuid) from public, anon;
revoke all on function public.iniciar_viaje(uuid) from public, anon;
revoke all on function public.terminar_viaje(uuid) from public, anon;
revoke all on function public.cancelar_viaje(uuid, text) from public, anon;
revoke all on function public.confirmar_llegada(uuid, boolean) from public, anon;
revoke all on function public.punto_recogida(uuid) from public, anon;
revoke all on function public.calificar_viaje(uuid, integer, text) from public, anon;
revoke all on function public.mis_resenas() from public, anon;
revoke all on function public.resumen_conductor(uuid) from public, anon;
grant execute on function public.marcar_llegada(uuid) to authenticated;
grant execute on function public.iniciar_viaje(uuid) to authenticated;
grant execute on function public.terminar_viaje(uuid) to authenticated;
grant execute on function public.cancelar_viaje(uuid, text) to authenticated;
grant execute on function public.confirmar_llegada(uuid, boolean) to authenticated;
grant execute on function public.punto_recogida(uuid) to authenticated;
grant execute on function public.calificar_viaje(uuid, integer, text) to authenticated;
grant execute on function public.mis_resenas() to authenticated;
grant execute on function public.resumen_conductor(uuid) to authenticated;

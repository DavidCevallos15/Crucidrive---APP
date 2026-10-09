-- Paso 004: avisos con la app cerrada y seguimiento del conductor (plan P3, P15, P16).
-- 1. dispositivos_push: el identificador de avisos de cada teléfono, que solo se escribe con RPC.
-- 2. Se cierra la lectura de tricimotos.ubicacion_actual (criterio 14): hoy cualquier usuario
--    autenticado podía seguir por la API REST a un conductor durante un viaje ajeno.
-- 3. ubicacion_conductor_viaje: el pasajero de un viaje aceptado o en curso ve a su conductor.
-- Se puede aplicar antes que el backend del 004: ningún cliente lee ubicacion_actual.

-- DISPOSITIVOS PARA AVISOS (P3) --------------------------------------------
create table public.dispositivos_push (
  token          text primary key
                 check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  usuario_id     uuid not null references public.perfiles(id) on delete cascade,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index idx_dispositivos_push_usuario on public.dispositivos_push (usuario_id);

alter table public.dispositivos_push enable row level security;
create policy dispositivos_push_select_propio on public.dispositivos_push for select to authenticated
  using (usuario_id = (select auth.uid()));
-- Nada de escritura directa: solo por las funciones de abajo. El despachador lee y borra
-- tokens con la clave de servicio (service_role salta RLS).
revoke all on public.dispositivos_push from anon, authenticated;
grant select on public.dispositivos_push to authenticated;

-- Máximo de teléfonos por usuario: los más viejos se olvidan.
create or replace function private.registrar_dispositivo(p_token text)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'sin_sesion' using errcode = 'insufficient_privilege';
  end if;
  -- Si el teléfono ya estaba registrado con otra cuenta, pasa a esta (criterio 11).
  insert into public.dispositivos_push (token, usuario_id) values (p_token, v_uid)
  on conflict (token) do update set usuario_id = excluded.usuario_id, actualizado_en = now();
  delete from public.dispositivos_push d
   where d.usuario_id = v_uid
     and d.token not in (select x.token from public.dispositivos_push x
                          where x.usuario_id = v_uid order by x.actualizado_en desc limit 3);
end;
$$;

create or replace function private.olvidar_dispositivo(p_token text)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.dispositivos_push d where d.token = p_token and d.usuario_id = (select auth.uid());
  return found;
end;
$$;

create or replace function public.registrar_dispositivo(p_token text)
returns void
language sql volatile security invoker set search_path = '' as $$
  select private.registrar_dispositivo(p_token)
$$;

create or replace function public.olvidar_dispositivo(p_token text)
returns boolean
language sql volatile security invoker set search_path = '' as $$
  select private.olvidar_dispositivo(p_token)
$$;

-- PRIVACIDAD DE LA UBICACIÓN (P15, criterio 14) ------------------------------
-- La RLS no limita columnas: se quita la lectura de ubicacion_actual por permisos.
revoke select on public.tricimotos from anon, authenticated;
grant select (id, conductor_id, placa, estado, sector_id, updated_at, ubicacion_en, disponible_desde)
  on public.tricimotos to authenticated;

-- Posición del conductor del viaje: solo para su pasajero y mientras el viaje está
-- aceptado o en curso (criterios 13, 14, 15 y 17). No se guarda historial (16).
create or replace function private.ubicacion_conductor_viaje(p_viaje uuid)
returns table (lat double precision, lng double precision, actualizado_en timestamptz)
language sql stable security definer set search_path = '' as $$
  select extensions.st_y(t.ubicacion_actual::extensions.geometry),
         extensions.st_x(t.ubicacion_actual::extensions.geometry),
         t.ubicacion_en
  from public.viajes v
  join public.tricimotos t on t.conductor_id = v.conductor_id
  where v.id = p_viaje
    and v.pasajero_id = (select auth.uid())
    and v.estado in ('aceptado', 'en_curso')
    and t.ubicacion_actual is not null
$$;

create or replace function public.ubicacion_conductor_viaje(p_viaje uuid)
returns table (lat double precision, lng double precision, actualizado_en timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from private.ubicacion_conductor_viaje(p_viaje)
$$;

revoke all on function public.registrar_dispositivo(text) from public, anon;
revoke all on function public.olvidar_dispositivo(text) from public, anon;
revoke all on function public.ubicacion_conductor_viaje(uuid) from public, anon;
grant execute on function public.registrar_dispositivo(text) to authenticated;
grant execute on function public.olvidar_dispositivo(text) to authenticated;
grant execute on function public.ubicacion_conductor_viaje(uuid) to authenticated;

-- Funciones nuevas de private: como en 0005, 0010 y 0012.
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on all functions in schema private to service_role;

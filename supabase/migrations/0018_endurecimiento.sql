-- Paso 007, PR 2 (plan P6 y P7): el teléfono solo con un viaje activo y consentimientos sin su número interno.
-- 1. perfiles.telefono deja de leerse directo. El nombre se sigue viendo como hoy (E1): perfiles_select no cambia.
-- 2. telefono_contraparte: la otra parte del viaje, solo mientras está aceptado o en curso (criterios 7 y 8).
-- 3. mi_perfil: el propio usuario sigue viendo su teléfono (criterio 10).
-- 4. telefonos_admin: el administrador sigue viendo el de los conductores que revisa (criterio 10).
-- 5. consentimientos.id deja de leerse (criterio 15).
-- Los clientes que leían el teléfono con select pasan a estas funciones en el mismo PR. Un APK viejo
-- recibe un error al pedir la columna y muestra el viaje sin el botón «Llamar» hasta la actualización.

-- PERFILES (P6) --------------------------------------------------------------
-- RLS no limita columnas: se quita el select de la tabla y se da por columna (como en 0005 con update).
revoke select on public.perfiles from anon, authenticated;
grant select (id, rol, nombre, activo, creado_en) on public.perfiles to authenticated;

create or replace function private.telefono_contraparte(p_viaje uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select p.telefono
  from public.viajes v
  join public.perfiles p
    on p.id = case when v.pasajero_id = (select auth.uid()) then v.conductor_id else v.pasajero_id end
  where v.id = p_viaje
    and (select auth.uid()) in (v.pasajero_id, v.conductor_id)
    and v.estado in ('aceptado', 'en_curso')
$$;

create or replace function private.mi_perfil()
returns table (id uuid, nombre text, telefono text, rol text, activo boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.nombre, p.telefono, p.rol, p.activo
  from public.perfiles p
  where p.id = (select auth.uid())
$$;

create or replace function private.telefonos_admin(p_ids uuid[])
returns table (id uuid, telefono text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.telefono
  from public.perfiles p
  where private.rol_actual() = 'admin'
    and p.id = any (p_ids)
$$;

-- Envolturas en public, security invoker, como ubicacion_conductor_viaje (0014).
create or replace function public.telefono_contraparte(p_viaje uuid)
returns text
language sql stable security invoker set search_path = '' as $$
  select private.telefono_contraparte(p_viaje)
$$;

create or replace function public.mi_perfil()
returns table (id uuid, nombre text, telefono text, rol text, activo boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.mi_perfil()
$$;

create or replace function public.telefonos_admin(p_ids uuid[])
returns table (id uuid, telefono text)
language sql stable security invoker set search_path = '' as $$
  select * from private.telefonos_admin(p_ids)
$$;

revoke all on function public.telefono_contraparte(uuid) from public, anon;
revoke all on function public.mi_perfil() from public, anon;
revoke all on function public.telefonos_admin(uuid[]) from public, anon;
grant execute on function public.telefono_contraparte(uuid) to authenticated;
grant execute on function public.mi_perfil() to authenticated;
grant execute on function public.telefonos_admin(uuid[]) to authenticated;

-- CONSENTIMIENTOS (P7) -------------------------------------------------------
-- El número interno (identity) dejaba contar cuántas personas se registraron.
revoke select on public.consentimientos from anon, authenticated;
grant select (user_id, version, aceptado_en) on public.consentimientos to authenticated;

-- Funciones nuevas de private: como en 0005, 0010, 0012 y 0014.
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
grant execute on all functions in schema private to service_role;

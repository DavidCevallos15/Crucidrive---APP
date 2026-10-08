-- Paso 002: identidad, consentimiento LOPDP y aprobación de conductores.

-- CONSENTIMIENTO ------------------------------------------------------------
-- Una fila por aceptación (versión y fecha). Sin consentimiento no se crea el perfil.
create table public.consentimientos (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  version      text not null check (char_length(version) between 1 and 20),
  aceptado_en  timestamptz not null default now()
);
create index idx_consentimientos_user on public.consentimientos (user_id);

-- La fecha la pone la BD: el cliente no puede falsearla.
create or replace function private.fijar_fecha_consentimiento()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.aceptado_en := now();
  return new;
end;
$$;
create trigger consentimientos_fecha
  before insert on public.consentimientos
  for each row execute function private.fijar_fecha_consentimiento();

alter table public.consentimientos enable row level security;
create policy consentimientos_select on public.consentimientos for select to authenticated
  using (user_id = (select auth.uid()) or private.rol_actual() = 'admin');
create policy consentimientos_insert on public.consentimientos for insert to authenticated
  with check (user_id = (select auth.uid()));
-- Sin UPDATE ni DELETE: el historial de consentimientos es de solo anexar.
revoke update, delete on public.consentimientos from anon, authenticated;
revoke all on public.consentimientos from anon;

-- Los perfiles de prueba que ya existen se consideran aceptados con la versión "prueba".
insert into public.consentimientos (user_id, version)
select id, 'prueba' from public.perfiles;

create or replace function private.tiene_consentimiento()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.consentimientos where user_id = (select auth.uid()));
$$;

drop policy perfiles_insert_propio on public.perfiles;
create policy perfiles_insert_propio on public.perfiles for insert to authenticated
  with check (id = (select auth.uid())
              and rol in ('pasajero', 'conductor')
              and private.tiene_consentimiento());

-- VERIFICACIÓN DE CONDUCTORES ----------------------------------------------
create table public.conductores_verificacion (
  conductor_id    uuid primary key references public.perfiles(id) on delete cascade,
  cedula          text not null unique check (cedula ~ '^[0-9]{10}$'),
  foto_conductor  text not null,
  foto_cedula     text not null,
  foto_vehiculo   text not null,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  motivo_rechazo  text check (char_length(motivo_rechazo) between 3 and 300),
  revisado_por    uuid references public.perfiles(id) on delete set null,
  revisado_en     timestamptz,
  creado_en       timestamptz not null default now(),
  -- Las fotos viven en la carpeta del propio conductor.
  constraint fotos_del_conductor check (
    foto_conductor = conductor_id::text || '/conductor.jpg'
    and foto_cedula = conductor_id::text || '/cedula.jpg'
    and foto_vehiculo = conductor_id::text || '/vehiculo.jpg'
  ),
  constraint rechazo_con_motivo check (estado <> 'rechazado' or motivo_rechazo is not null)
);
create index idx_verificacion_estado on public.conductores_verificacion (estado, creado_en);
create index idx_verificacion_revisor on public.conductores_verificacion (revisado_por);

create or replace function private.es_conductor_aprobado()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.conductores_verificacion cv
    join public.perfiles p on p.id = cv.conductor_id
    where cv.conductor_id = (select auth.uid())
      and cv.estado = 'aprobado'
      and p.rol = 'conductor'
      and p.activo
  );
$$;

-- Fija la fecha de revisión y bloquea que quien revisa edite los datos del conductor.
create or replace function private.controlar_verificacion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is distinct from old.conductor_id
     and (new.cedula, new.foto_conductor, new.foto_cedula, new.foto_vehiculo)
         is distinct from (old.cedula, old.foto_conductor, old.foto_cedula, old.foto_vehiculo) then
    raise exception 'Solo el conductor puede cambiar sus datos de verificación' using errcode = 'insufficient_privilege';
  end if;
  -- Si el conductor corrige una solicitud rechazada, vuelve a la cola de revisión.
  if (select auth.uid()) = old.conductor_id and old.estado = 'rechazado' then
    new.estado := 'pendiente';
  end if;
  if new.estado is distinct from old.estado and new.estado in ('aprobado', 'rechazado') then
    new.revisado_en := now();
  end if;
  -- Al volver a "pendiente" (el conductor corrigió sus datos) se borra la revisión anterior.
  if new.estado = 'pendiente' then
    new.revisado_por := null;
    new.revisado_en := null;
    new.motivo_rechazo := null;
  end if;
  return new;
end;
$$;
create trigger verificacion_control
  before update on public.conductores_verificacion
  for each row execute function private.controlar_verificacion();

alter table public.conductores_verificacion enable row level security;

create policy verificacion_select on public.conductores_verificacion for select to authenticated
  using (conductor_id = (select auth.uid()) or private.rol_actual() = 'admin');

create policy verificacion_insert on public.conductores_verificacion for insert to authenticated
  with check (conductor_id = (select auth.uid())
              and private.rol_actual() = 'conductor'
              and estado = 'pendiente'
              and revisado_por is null and revisado_en is null and motivo_rechazo is null);

-- El conductor corrige sus datos (p. ej. tras un rechazo) y la solicitud vuelve a "pendiente".
-- Una vez aprobado no puede tocar nada.
create policy verificacion_update_conductor on public.conductores_verificacion for update to authenticated
  using (conductor_id = (select auth.uid()) and estado <> 'aprobado')
  with check (conductor_id = (select auth.uid())
              and estado = 'pendiente'
              and revisado_por is null and revisado_en is null and motivo_rechazo is null);

-- El administrador aprueba o rechaza, y queda registrado quién.
create policy verificacion_update_admin on public.conductores_verificacion for update to authenticated
  using (private.rol_actual() = 'admin')
  with check (private.rol_actual() = 'admin'
              and (estado = 'pendiente' or revisado_por = (select auth.uid())));

revoke update on public.conductores_verificacion from anon, authenticated;
grant update (cedula, foto_conductor, foto_cedula, foto_vehiculo,
              estado, motivo_rechazo, revisado_por) on public.conductores_verificacion to authenticated;
revoke all on public.conductores_verificacion from anon;
revoke delete on public.conductores_verificacion from authenticated;

-- UN CONDUCTOR SIN APROBAR NO OPERA ----------------------------------------
drop policy tricimotos_update_propia on public.tricimotos;
create policy tricimotos_update_propia on public.tricimotos for update to authenticated
  using (conductor_id = (select auth.uid()) and private.es_conductor_aprobado())
  with check (conductor_id = (select auth.uid()) and private.es_conductor_aprobado());

drop policy viajes_select on public.viajes;
create policy viajes_select on public.viajes for select to authenticated
  using (pasajero_id = (select auth.uid())
         or conductor_id = (select auth.uid())
         or (estado = 'solicitado' and private.es_conductor_aprobado())
         or private.rol_actual() = 'admin');

drop policy viajes_update on public.viajes;
create policy viajes_update on public.viajes for update to authenticated
  using (pasajero_id = (select auth.uid())
         or conductor_id = (select auth.uid())
         or (estado = 'solicitado' and conductor_id is null and private.es_conductor_aprobado()))
  with check (pasajero_id = (select auth.uid())
              or conductor_id = (select auth.uid())
              or (estado = 'solicitado' and conductor_id is null and private.es_conductor_aprobado()));

-- STORAGE PRIVADO PARA FOTOS Y CÉDULA --------------------------------------
-- Una sola imagen JPEG por archivo, hasta 1 MB (la app las reduce a ~300 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verificacion', 'verificacion', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy verificacion_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'verificacion'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and name ~ '^[0-9a-f-]{36}/(conductor|cedula|vehiculo)\.jpg$'
              and private.rol_actual() = 'conductor');

create policy verificacion_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'verificacion'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or private.rol_actual() = 'admin'));

-- Reemplazar una foto solo mientras no esté aprobado.
create policy verificacion_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'verificacion'
         and (storage.foldername(name))[1] = (select auth.uid())::text
         and not private.es_conductor_aprobado())
  with check (bucket_id = 'verificacion'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

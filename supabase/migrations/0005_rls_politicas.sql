-- Funciones auxiliares (security definer, en schema privado) para evitar
-- recursión entre políticas. auth.uid() va envuelto en (select ...) para
-- que se evalúe una sola vez por consulta.
create or replace function private.rol_actual()
returns text language sql stable security definer set search_path = '' as $$
  select rol from public.perfiles where id = (select auth.uid()) and activo;
$$;

create or replace function private.es_miembro_hilo(p_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.thread_members
    where thread_id = p_thread and user_id = (select auth.uid())
  );
$$;

create or replace function private.es_participante_viaje(p_viaje uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.viajes
    where id = p_viaje and (select auth.uid()) in (pasajero_id, conductor_id)
  );
$$;

create or replace function private.comparte_viaje(p_perfil uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.viajes
    where (pasajero_id = (select auth.uid()) and conductor_id = p_perfil)
       or (conductor_id = (select auth.uid()) and pasajero_id = p_perfil)
  );
$$;

-- El creador del hilo solo puede añadir a participantes del viaje vinculado.
create or replace function private.puede_agregar_miembro(p_thread uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.threads t
    join public.viajes v on v.id = t.viaje_id
    where t.id = p_thread
      and t.created_by = (select auth.uid())
      and p_user in (v.pasajero_id, v.conductor_id)
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter table public.perfiles       enable row level security;
alter table public.tricimotos     enable row level security;
alter table public.viajes         enable row level security;
alter table public.threads        enable row level security;
alter table public.thread_members enable row level security;
alter table public.messages       enable row level security;

-- PERFILES ----------------------------------------------------------------
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = (select auth.uid())
         or private.comparte_viaje(id)
         or private.rol_actual() = 'admin');

-- Nadie puede auto-asignarse el rol admin.
create policy perfiles_insert_propio on public.perfiles for insert to authenticated
  with check (id = (select auth.uid()) and rol in ('pasajero', 'conductor'));

create policy perfiles_update_propio on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy perfiles_delete_propio on public.perfiles for delete to authenticated
  using (id = (select auth.uid()));

-- Rol y estado activo no se cambian desde el cliente.
revoke update on public.perfiles from anon, authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;

-- TRICIMOTOS --------------------------------------------------------------
create policy tricimotos_select on public.tricimotos for select to authenticated
  using (estado <> 'inactivo'
         or conductor_id = (select auth.uid())
         or private.rol_actual() = 'admin');

create policy tricimotos_insert_propia on public.tricimotos for insert to authenticated
  with check (conductor_id = (select auth.uid()) and private.rol_actual() = 'conductor');

create policy tricimotos_update_propia on public.tricimotos for update to authenticated
  using (conductor_id = (select auth.uid())) with check (conductor_id = (select auth.uid()));

revoke update on public.tricimotos from anon, authenticated;
grant update (estado, ubicacion_actual, sector_id) on public.tricimotos to authenticated;

-- VIAJES ------------------------------------------------------------------
create policy viajes_select on public.viajes for select to authenticated
  using (pasajero_id = (select auth.uid())
         or conductor_id = (select auth.uid())
         or (estado = 'solicitado' and private.rol_actual() = 'conductor')
         or private.rol_actual() = 'admin');

create policy viajes_insert_pasajero on public.viajes for insert to authenticated
  with check (pasajero_id = (select auth.uid())
              and estado = 'solicitado'
              and conductor_id is null
              and private.rol_actual() = 'pasajero');

-- Participantes, o un conductor tomando un viaje libre. Las transiciones
-- válidas las valida el backend (y una RPC atómica en el paso 003).
create policy viajes_update on public.viajes for update to authenticated
  using (pasajero_id = (select auth.uid())
         or conductor_id = (select auth.uid())
         or (estado = 'solicitado' and conductor_id is null and private.rol_actual() = 'conductor'))
  with check (pasajero_id = (select auth.uid())
              or conductor_id = (select auth.uid())
              or (estado = 'solicitado' and conductor_id is null and private.rol_actual() = 'conductor'));

-- Tarifa, origen y destino no se modifican desde el cliente.
revoke update on public.viajes from anon, authenticated;
grant update (estado, conductor_id, aceptado_en, finalizado_en) on public.viajes to authenticated;

-- CHAT --------------------------------------------------------------------
create policy threads_select on public.threads for select to authenticated
  using (created_by = (select auth.uid()) or private.es_miembro_hilo(id));

create policy threads_insert on public.threads for insert to authenticated
  with check (created_by = (select auth.uid()) and private.es_participante_viaje(viaje_id));

create policy threads_delete_creador on public.threads for delete to authenticated
  using (created_by = (select auth.uid()));

create policy thread_members_select on public.thread_members for select to authenticated
  using (user_id = (select auth.uid()) or private.es_miembro_hilo(thread_id));

create policy thread_members_insert on public.thread_members for insert to authenticated
  with check (private.puede_agregar_miembro(thread_id, user_id));

create policy messages_select on public.messages for select to authenticated
  using (private.es_miembro_hilo(thread_id));

create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.es_miembro_hilo(thread_id));

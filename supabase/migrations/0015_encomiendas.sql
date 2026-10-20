-- Encomiendas en tricimoto. Precio acordado por chat; NULL nunca significa gratis.
alter table public.viajes add column tipo_servicio text not null default 'viaje'
  check (tipo_servicio in ('viaje', 'encomienda'));
alter table public.viajes add constraint encomienda_sin_precio_fijo
  check (tipo_servicio <> 'encomienda' or (pasajeros = 1 and tarifa is null));

-- Separación deliberada: un conductor con una oferta puede leer el tipo del servicio,
-- pero los datos del paquete/destinatario solo se leen cuando ya fue asignado.
create table public.encomiendas (
  viaje_id uuid primary key references public.viajes(id) on delete cascade,
  descripcion text not null check (char_length(btrim(descripcion)) between 2 and 200),
  destinatario text not null check (char_length(btrim(destinatario)) between 2 and 100),
  autorizado boolean not null check (autorizado = true)
);
alter table public.encomiendas enable row level security;
revoke all on public.encomiendas from anon, authenticated;
grant select, insert on public.encomiendas to authenticated;
grant all on public.encomiendas to service_role;
create policy encomiendas_select on public.encomiendas for select to authenticated
  using (exists (select 1 from public.viajes v where v.id = viaje_id and
    (v.pasajero_id = (select auth.uid()) or v.conductor_id = (select auth.uid())))
    or private.rol_actual() = 'admin');
create policy encomiendas_insert on public.encomiendas for insert to authenticated
  with check (exists (select 1 from public.viajes v where v.id = viaje_id
    and v.pasajero_id = (select auth.uid()) and v.tipo_servicio = 'encomienda' and v.estado = 'solicitado'));

create or replace function private.fijar_tarifa_viaje()
returns trigger language plpgsql set search_path = '' as $$
declare v_precio numeric(5,2);
begin
  if new.tipo_servicio = 'encomienda' then
    if new.pasajeros <> 1 then raise exception 'Una encomienda es un solo servicio' using errcode = 'check_violation'; end if;
    new.tarifa := null;
    return new;
  end if;
  select z.precio_por_persona into v_precio from public.zonas z
  where z.activa and (new.sector_origen_id is null or z.id =
    (select s.zona_id from public.sectores s where s.id = new.sector_origen_id))
  order by z.creado_en limit 1;
  if v_precio is null then raise exception 'No hay una zona activa con precio configurado' using errcode = 'check_violation'; end if;
  new.tarifa := v_precio * new.pasajeros;
  return new;
end;
$$;

create function public.solicitar_encomienda(p_solicitud jsonb, p_descripcion text, p_destinatario text, p_autorizado boolean)
returns setof public.viajes language plpgsql security invoker set search_path = '' as $$
declare v public.viajes;
begin
  insert into public.viajes (pasajero_id, origen, destino, lugar_origen_id, lugar_destino_id,
    sector_origen_id, sector_destino_id, pasajeros, origen_descripcion, destino_descripcion, tipo_servicio)
  values ((select auth.uid()), (p_solicitud->>'origen')::extensions.geography,
    (p_solicitud->>'destino')::extensions.geography, (p_solicitud->>'lugar_origen_id')::uuid,
    (p_solicitud->>'lugar_destino_id')::uuid, p_solicitud->>'sector_origen_id', p_solicitud->>'sector_destino_id',
    1, p_solicitud->>'origen_descripcion', p_solicitud->>'destino_descripcion', 'encomienda') returning * into v;
  insert into public.encomiendas values (v.id, btrim(p_descripcion), btrim(p_destinatario), p_autorizado);
  return next v;
end;
$$;
revoke all on function public.solicitar_encomienda(jsonb,text,text,boolean) from public, anon;
grant execute on function public.solicitar_encomienda(jsonb,text,text,boolean) to authenticated;

create function private.comprobar_encomienda() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo_servicio = 'encomienda' and not exists (select 1 from public.encomiendas e where e.viaje_id = new.id) then
    raise exception 'Faltan datos de la encomienda' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create constraint trigger viajes_encomienda_completa after insert on public.viajes
  deferrable initially deferred for each row execute function private.comprobar_encomienda();

create function private.proteger_tipo_servicio() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.tipo_servicio is distinct from old.tipo_servicio then
    raise exception 'No se puede cambiar el tipo de un servicio solicitado' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger viajes_tipo_inmutable before update on public.viajes for each row execute function private.proteger_tipo_servicio();

-- Solo el backend, después de reautenticar la contraseña y eliminar los archivos
-- físicos de Storage. El bloqueo de perfil impide nuevas referencias concurrentes.
create function private.eliminar_cuenta_crucidrive(p_usuario uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id = p_usuario for update;
  perform 1 from public.perfiles where id = p_usuario for update;
  if exists (select 1 from public.viajes where (pasajero_id = p_usuario or conductor_id = p_usuario)
    and estado in ('solicitado','aceptado','en_curso')) then
    raise exception 'servicio_activo' using errcode = 'check_violation';
  end if;
  delete from public.messages where sender_id = p_usuario;
  delete from public.encomiendas e using public.viajes v where e.viaje_id = v.id and v.pasajero_id = p_usuario;
  delete from auth.users where id = p_usuario;
end;
$$;
create function public.eliminar_cuenta_crucidrive(p_usuario uuid) returns void
language sql security invoker set search_path = '' as $$
  select private.eliminar_cuenta_crucidrive(p_usuario);
$$;
revoke all on function private.eliminar_cuenta_crucidrive(uuid) from public, anon, authenticated;
revoke all on function public.eliminar_cuenta_crucidrive(uuid) from public, anon, authenticated;
grant execute on function private.eliminar_cuenta_crucidrive(uuid) to service_role;
grant execute on function public.eliminar_cuenta_crucidrive(uuid) to service_role;

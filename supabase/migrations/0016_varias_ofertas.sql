-- 010 · Parte B (D-15): hasta N ofertas abiertas por conductor, sin quitar D-11.
-- Reemplaza el criterio 7 del 003 ("una oferta abierta a la vez"). El máximo lo fija el
-- servidor (OFERTAS_MAX_POR_CONDUCTOR, 3 al inicio) y se pasa a las funciones del despacho.

-- 1. Ya no hay una sola oferta pendiente por conductor: el tope lo aplica crear_ofertas.
drop index if exists public.uq_ofertas_una_pendiente_por_conductor;

-- 2. "liberada": el conductor aceptó otra oferta y esta vuelve al despacho. Se distingue de
--    "rechazada" para que las métricas del piloto (criterio 17 del 003) no cuenten rechazos falsos.
alter table public.ofertas_viaje drop constraint if exists ofertas_viaje_resultado_check;
alter table public.ofertas_viaje add constraint ofertas_viaje_resultado_check
  check (resultado in ('pendiente', 'aceptada', 'rechazada', 'vencida', 'cancelada', 'tomada', 'liberada'));

-- 3. Candidatos: un conductor con menos de p_max_ofertas pendientes sigue siendo candidato,
--    salvo para un viaje que ya recibió. Lo demás de D-11 no cambia (distancia, tramos de 50 m).
drop function if exists public.candidatos_despacho(uuid, integer);
create function public.candidatos_despacho(p_viaje uuid, p_ubicacion_max_seg integer default 60, p_max_ofertas integer default 3)
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
                    where o.conductor_id = t.conductor_id and o.viaje_id = p_viaje)
    and (select count(*) from public.ofertas_viaje o
          where o.conductor_id = t.conductor_id and o.resultado = 'pendiente') < greatest(p_max_ofertas, 1)
  order by floor(extensions.st_distance(t.ubicacion_actual, v.origen) / 50),
           t.disponible_desde nulls last,
           t.conductor_id
$$;

-- 4. Crear ofertas respetando el tope. Bloquea la tricimoto de cada conductor (en orden, sin
--    interbloqueos) para que dos solicitudes a la vez no le dejen más de p_max_ofertas.
drop function if exists public.crear_ofertas(uuid, uuid[], text, timestamptz);
create function public.crear_ofertas(p_viaje uuid, p_conductores uuid[], p_fase text, p_vence_en timestamptz, p_max_ofertas integer default 3)
returns setof public.ofertas_viaje
language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform 1 from public.tricimotos t
   where t.conductor_id = any (p_conductores)
   order by t.conductor_id
   for update;

  return query
    insert into public.ofertas_viaje (viaje_id, conductor_id, fase, vence_en, distancia_m)
    select v.id, t.conductor_id, p_fase, p_vence_en,
           round(extensions.st_distance(t.ubicacion_actual, v.origen))::integer
    from public.viajes v
    join public.tricimotos t on t.conductor_id = any (p_conductores)
    where v.id = p_viaje and v.estado = 'solicitado'
      and (select count(*) from public.ofertas_viaje o
            where o.conductor_id = t.conductor_id and o.resultado = 'pendiente') < greatest(p_max_ofertas, 1)
    on conflict do nothing
    returning *;
end;
$$;

revoke all on function public.candidatos_despacho(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.crear_ofertas(uuid, uuid[], text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.candidatos_despacho(uuid, integer, integer) to service_role;
grant execute on function public.crear_ofertas(uuid, uuid[], text, timestamptz, integer) to service_role;

-- 5. Aceptar: igual que en el 003, y además libera las otras ofertas pendientes del
--    conductor antes de marcarlo ocupado (si no, el trigger al_dejar_disponible las daría
--    por rechazadas). El despachador las pasa al siguiente candidato de inmediato (010, 9).
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

  update public.ofertas_viaje o set resultado = 'liberada', respondida_en = now()
   where o.conductor_id = v_uid and o.viaje_id <> p_viaje and o.resultado = 'pendiente';

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

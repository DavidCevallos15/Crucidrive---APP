-- Pruebas de BD del 005: viaje en curso, cancelación, cierre, confirmación y calificaciones.
-- Debe terminar con 'RLS 007: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajera Ana
  ('22222222-2222-2222-2222-222222222222'),  -- conductora Carla
  ('33333333-3333-3333-3333-333333333333'),  -- otro pasajero
  ('44444444-4444-4444-4444-444444444444'),  -- pasajero Beto
  ('55555555-5555-5555-5555-555555555555');  -- administrador

create or replace function pg_temp.como(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;
create or replace function pg_temp.debe_fallar(q text, nombre text) returns void language plpgsql as $$
declare n int;
begin
  begin
    execute q; get diagnostics n = row_count;
    if n = 0 then raise notice 'OK  % (0 filas afectadas)', nombre; return; end if;
  exception when insufficient_privilege or check_violation or not_null_violation or unique_violation then
    raise notice 'OK  % (bloqueado: %)', nombre, sqlerrm; return;
  end;
  raise exception 'FALLO: % se permitió (% filas)', nombre, n;
end $$;
create or replace function pg_temp.debe_fallar_con(q text, patron text, nombre text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm like '%' || patron || '%' then raise notice 'OK  % (%)', nombre, sqlerrm; return; end if;
    raise exception 'FALLO: % falló con otro error: %', nombre, sqlerrm;
  end;
  raise exception 'FALLO: % se permitió', nombre;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

insert into consentimientos (user_id, version) select id, 'prueba' from auth.users;
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Ana', '0991111111'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('33333333-3333-3333-3333-333333333333', 'pasajero', 'Otro', '0993333333'),
  ('44444444-4444-4444-4444-444444444444', 'pasajero', 'Beto', '0994444444'),
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555');
insert into tricimotos (conductor_id, placa, estado, ubicacion_actual) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'ocupado', extensions.st_geogfromtext('SRID=4326;POINT(-80.5401 -0.8700)'));

-- Viajes ya aceptados por Carla (como los deja aceptar_viaje), con su chat.
insert into viajes (id, pasajero_id, conductor_id, estado, aceptado_en, origen, destino) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aceptado', now(),
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)')),
  ('c0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'aceptado', now(),
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8710)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
insert into threads (id, viaje_id, created_by) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
insert into thread_members (thread_id, user_id) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');

\echo '--- criterio 6: solo por funciones, cada paso a quien le toca ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$update viajes set estado = 'en_curso' where id = 'c0000000-0000-0000-0000-000000000001'$q$, 'pasajera cambia el estado por REST');
select pg_temp.debe_fallar_con($q$select marcar_llegada('c0000000-0000-0000-0000-000000000001')$q$, 'no_es_tu_viaje', 'pasajera marca la llegada');
select pg_temp.debe_fallar_con($q$select iniciar_viaje('c0000000-0000-0000-0000-000000000001')$q$, 'no_es_tu_viaje', 'pasajera inicia el viaje');
select pg_temp.debe_fallar_con($q$select terminar_viaje('c0000000-0000-0000-0000-000000000001')$q$, 'estado_no_permite', 'pasajera finaliza antes de empezar');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select pg_temp.debe_fallar_con($q$select marcar_llegada('c0000000-0000-0000-0000-000000000001')$q$, 'no_es_tu_viaje', 'un tercero marca la llegada');
select pg_temp.debe_fallar_con($q$select cancelar_viaje('c0000000-0000-0000-0000-000000000001', 'otro')$q$, 'no_es_tu_viaje', 'un tercero cancela');

\echo '--- criterios 1 a 4: recogida, llegada e inicio ---'
select (select count(*) from punto_recogida('c0000000-0000-0000-0000-000000000001')) = 0 as tercero_no_ve_la_recogida;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select (select count(*) from punto_recogida('c0000000-0000-0000-0000-000000000001')) = 0 as pasajera_no_pide_la_recogida_por_aqui;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select abs(lat - (-0.87)) < 0.0001 and abs(lng - (-80.54)) < 0.0001 as conductora_ve_la_recogida
  from punto_recogida('c0000000-0000-0000-0000-000000000001');
select pg_temp.debe_fallar_con($q$select terminar_viaje('c0000000-0000-0000-0000-000000000001')$q$, 'estado_no_permite', 'finalizar sin empezar');
select marcar_llegada('c0000000-0000-0000-0000-000000000001');
select llegado_en is not null and estado = 'aceptado' as llegada_marcada from viajes where id = 'c0000000-0000-0000-0000-000000000001';
select iniciar_viaje('c0000000-0000-0000-0000-000000000001');
select estado = 'en_curso' as viaje_en_curso from viajes where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar_con($q$select iniciar_viaje('c0000000-0000-0000-0000-000000000001')$q$, 'estado_no_permite', 'iniciar dos veces');

\echo '--- criterio 9: en curso nadie cancela ---'
select pg_temp.debe_fallar_con($q$select cancelar_viaje('c0000000-0000-0000-0000-000000000001', 'otro')$q$, 'estado_no_permite', 'conductora cancela en curso');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar_con($q$select cancelar_viaje('c0000000-0000-0000-0000-000000000001', 'otro')$q$, 'estado_no_permite', 'pasajera cancela en curso');

\echo '--- criterios 5 y 13: cierre por la conductora ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select terminar_viaje('c0000000-0000-0000-0000-000000000001');
reset role;
select v.estado = 'finalizado' and v.finalizado_por = 'conductor' and v.finalizado_en is not null and t.estado = 'disponible'
       as cierre_completo_y_conductora_libre
  from viajes v join tricimotos t on t.conductor_id = v.conductor_id
 where v.id = 'c0000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select (select count(*) from punto_recogida('c0000000-0000-0000-0000-000000000001')) = 0 as al_terminar_ya_no_hay_recogida;

\echo '--- criterio 7: chat en solo lectura ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$insert into messages (thread_id, sender_id, content) values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'hola')$q$, 'escribir en el chat de un viaje terminado');
select count(*) = 0 as el_historial_se_sigue_leyendo_sin_errores from messages where content = 'hola';

\echo '--- criterio 5a: confirmación de la pasajera ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar_con($q$select confirmar_llegada('c0000000-0000-0000-0000-000000000001', true)$q$, 'no_es_tu_viaje', 'la conductora confirma por la pasajera');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select confirmar_llegada('c0000000-0000-0000-0000-000000000001', true);
select confirmacion_pasajero = 'llego' and confirmado_en is not null as llegada_confirmada from viajes where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar_con($q$select confirmar_llegada('c0000000-0000-0000-0000-000000000001', false)$q$, 'estado_no_permite', 'confirmar dos veces');

\echo '--- criterios 15, 16 y 19: calificar una vez, sin enlaces ni teléfonos ---'
select pg_temp.debe_fallar($q$select calificar_viaje('c0000000-0000-0000-0000-000000000001', 5, 'mira www.ejemplo.com')$q$, 'comentario con enlace');
select pg_temp.debe_fallar($q$select calificar_viaje('c0000000-0000-0000-0000-000000000001', 5, 'llámame al 099 123 4567')$q$, 'comentario con teléfono');
select pg_temp.debe_fallar($q$select calificar_viaje('c0000000-0000-0000-0000-000000000001', 6, null)$q$, 'seis estrellas');
select calificar_viaje('c0000000-0000-0000-0000-000000000001', 5, '  Muy amable, llegó rápido  ');
select pg_temp.debe_fallar_con($q$select calificar_viaje('c0000000-0000-0000-0000-000000000001', 1, null)$q$, 'ya_calificado', 'calificar dos veces');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select pg_temp.debe_fallar_con($q$select calificar_viaje('c0000000-0000-0000-0000-000000000001', 1, null)$q$, 'no_es_tu_viaje', 'un tercero califica');

\echo '--- criterios 17 y 18: reseñas sin autor ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 0 as conductora_no_lee_la_tabla from calificaciones;
select estrellas = 5 and comentario = 'Muy amable, llegó rápido' and fecha = current_date as ve_su_resena_sin_autor from mis_resenas();
select promedio = 5.0 and total = 1 as ve_su_promedio from resumen_conductor('22222222-2222-2222-2222-222222222222');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select (select count(*) from mis_resenas()) = 0 and (select count(*) from resumen_conductor('22222222-2222-2222-2222-222222222222') where total > 0) = 0
       as un_tercero_no_ve_resenas_ni_promedio;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select promedio = 5.0 and total = 1 as pasajero_con_viaje_activo_ve_el_promedio from resumen_conductor('22222222-2222-2222-2222-222222222222');
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select count(*) = 1 as el_admin_lee_la_tabla from calificaciones;

\echo '--- criterios 8, 10 y 11: cancelar después de aceptar ---'
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar_con($q$select cancelar_viaje('c0000000-0000-0000-0000-000000000002')$q$, 'motivo_requerido', 'cancelar aceptado sin motivo');
select pg_temp.debe_fallar($q$select cancelar_viaje('c0000000-0000-0000-0000-000000000002', 'porque si')$q$, 'motivo fuera de la lista');
select cancelar_viaje('c0000000-0000-0000-0000-000000000002', 'tarda_demasiado');
reset role;
select estado = 'cancelado' and cancelado_por = 'pasajero' and motivo_cancelacion = 'tarda_demasiado' and finalizado_en is not null
       as cancelacion_registrada from viajes where id = 'c0000000-0000-0000-0000-000000000002';
-- El conductor de otro viaje aceptado cancela con su motivo.
update tricimotos set estado = 'ocupado' where conductor_id = '22222222-2222-2222-2222-222222222222';
insert into viajes (id, pasajero_id, conductor_id, estado, aceptado_en, origen, destino) values
  ('c0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'aceptado', now(),
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8710)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select cancelar_viaje('c0000000-0000-0000-0000-000000000003', 'no_encuentro_al_pasajero');
reset role;
select v.cancelado_por = 'conductor' and v.motivo_cancelacion = 'no_encuentro_al_pasajero' and t.estado = 'disponible'
       as cancela_la_conductora_y_queda_libre
  from viajes v join tricimotos t on t.conductor_id = v.conductor_id where v.id = 'c0000000-0000-0000-0000-000000000003';
select not exists (select 1 from information_schema.columns where table_name = 'viajes'
                   and column_name in ('lat_cancelacion', 'ubicacion_cancelacion')) as cancelacion_sin_coordenadas;

\echo '--- criterio 5b: la pasajera también puede finalizar, con sanción ---'
update tricimotos set estado = 'ocupado' where conductor_id = '22222222-2222-2222-2222-222222222222';
insert into viajes (id, pasajero_id, conductor_id, estado, aceptado_en, origen, destino) values
  ('c0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'en_curso', now(),
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8710)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select terminar_viaje('c0000000-0000-0000-0000-000000000004');
reset role;
select v.estado = 'finalizado' and v.finalizado_por = 'pasajero' and t.estado = 'disponible'
       as pasajero_finaliza_y_la_conductora_queda_libre
  from viajes v join tricimotos t on t.conductor_id = v.conductor_id where v.id = 'c0000000-0000-0000-0000-000000000004';
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar_con($q$select calificar_viaje('c0000000-0000-0000-0000-000000000004', 1, null)$q$, 'no_calificable', 'calificar un viaje que finalizó el pasajero');
select pg_temp.debe_fallar_con($q$select confirmar_llegada('c0000000-0000-0000-0000-000000000004', true)$q$, 'estado_no_permite', 'confirmar un viaje que finalizó el pasajero');

\echo '--- 003: cancelar mientras busca sigue sin motivo ---'
reset role;
insert into viajes (id, pasajero_id, origen, destino) values
  ('c0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333',
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar_con($q$select cancelar_viaje('c0000000-0000-0000-0000-000000000005', 'otro')$q$, 'no_es_tu_viaje', 'conductora cancela una solicitud ajena');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select cancelar_viaje('c0000000-0000-0000-0000-000000000005');
reset role;
select estado = 'cancelado' and cancelado_por = 'pasajero' and motivo_cancelacion is null as cancelar_buscando_sin_motivo
  from viajes where id = 'c0000000-0000-0000-0000-000000000005';

\echo 'RLS 007: TODAS LAS PRUEBAS TERMINARON'

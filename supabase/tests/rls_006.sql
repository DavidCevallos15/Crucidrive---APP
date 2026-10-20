-- Pruebas de BD del 010, parte B (D-15): hasta 3 ofertas abiertas por conductor.
-- Debe terminar con 'RLS 006: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajera 1
  ('12121212-1212-1212-1212-121212121212'),  -- pasajero 2
  ('13131313-1313-1313-1313-131313131313'),  -- pasajera 3
  ('14141414-1414-1414-1414-141414141414'),  -- pasajero 4
  ('22222222-2222-2222-2222-222222222222'),  -- conductora Carla
  ('44444444-4444-4444-4444-444444444444');  -- conductor Diego

create or replace function pg_temp.como(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

insert into consentimientos (user_id, version) select id, 'prueba' from auth.users;
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Ana', '0991111111'),
  ('12121212-1212-1212-1212-121212121212', 'pasajero', 'Beto', '0991212121'),
  ('13131313-1313-1313-1313-131313131313', 'pasajero', 'Cris', '0991313131'),
  ('14141414-1414-1414-1414-141414141414', 'pasajero', 'Dani', '0991414141'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('44444444-4444-4444-4444-444444444444', 'conductor', 'Diego', '0994444444');
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado) values
  ('22222222-2222-2222-2222-222222222222', '1700000002', '22222222-2222-2222-2222-222222222222/conductor.jpg', '22222222-2222-2222-2222-222222222222/cedula.jpg', '22222222-2222-2222-2222-222222222222/vehiculo.jpg', 'aprobado'),
  ('44444444-4444-4444-4444-444444444444', '1700000004', '44444444-4444-4444-4444-444444444444/conductor.jpg', '44444444-4444-4444-4444-444444444444/cedula.jpg', '44444444-4444-4444-4444-444444444444/vehiculo.jpg', 'aprobado');
insert into tricimotos (conductor_id, placa, estado, ubicacion_actual) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5401 -0.8700)')),
  ('44444444-4444-4444-4444-444444444444', 'DEF-456', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5410 -0.8700)'));

-- Cuatro solicitudes al mismo tiempo, una por pasajero.
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into viajes (id, pasajero_id, origen, destino) values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
select pg_temp.como('12121212-1212-1212-1212-121212121212');
insert into viajes (id, pasajero_id, origen, destino) values ('b0000000-0000-0000-0000-000000000002', '12121212-1212-1212-1212-121212121212',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8701)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
select pg_temp.como('13131313-1313-1313-1313-131313131313');
insert into viajes (id, pasajero_id, origen, destino) values ('b0000000-0000-0000-0000-000000000003', '13131313-1313-1313-1313-131313131313',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8702)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
select pg_temp.como('14141414-1414-1414-1414-141414141414');
insert into viajes (id, pasajero_id, origen, destino) values ('b0000000-0000-0000-0000-000000000004', '14141414-1414-1414-1414-141414141414',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8703)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
reset role;

\echo '--- criterios 7 y 11: hasta 3 ofertas abiertas a la vez ---'
set role service_role;
select count(*) = 1 as primera_oferta from crear_ofertas('b0000000-0000-0000-0000-000000000001', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
select exists (select 1 from candidatos_despacho('b0000000-0000-0000-0000-000000000002') where conductor_id = '22222222-2222-2222-2222-222222222222') as con_una_oferta_sigue_siendo_candidata;
select count(*) = 1 as segunda_oferta from crear_ofertas('b0000000-0000-0000-0000-000000000002', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
select count(*) = 1 as tercera_oferta from crear_ofertas('b0000000-0000-0000-0000-000000000003', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
select not exists (select 1 from candidatos_despacho('b0000000-0000-0000-0000-000000000004') where conductor_id = '22222222-2222-2222-2222-222222222222') as con_tres_no_es_candidata;
select count(*) = 0 as no_recibe_una_cuarta from crear_ofertas('b0000000-0000-0000-0000-000000000004', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
select exists (select 1 from candidatos_despacho('b0000000-0000-0000-0000-000000000004', 60, 4) where conductor_id = '22222222-2222-2222-2222-222222222222') as el_tope_es_un_parametro;
select not exists (select 1 from candidatos_despacho('b0000000-0000-0000-0000-000000000001') where conductor_id = '22222222-2222-2222-2222-222222222222') as no_repite_el_mismo_viaje;
-- Diego también recibe el viaje 1 (aviso abierto).
select count(*) = 1 as diego_recibe_el_viaje_1 from crear_ofertas('b0000000-0000-0000-0000-000000000001', array['44444444-4444-4444-4444-444444444444']::uuid[], 'abierta', now() + interval '60 seconds');
reset role;

\echo '--- criterio 8: la conductora ve sus ofertas ---'
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 3 as ve_sus_tres_ofertas from ofertas_viaje where resultado = 'pendiente';

\echo '--- criterios 9 y 14: aceptar una libera las demás ---'
select count(*) = 1 as carla_acepta_el_viaje_2 from aceptar_viaje('b0000000-0000-0000-0000-000000000002');
reset role;
select (select resultado from ofertas_viaje where viaje_id = 'b0000000-0000-0000-0000-000000000002' and conductor_id = '22222222-2222-2222-2222-222222222222') = 'aceptada'
       and (select count(*) from ofertas_viaje where conductor_id = '22222222-2222-2222-2222-222222222222' and resultado = 'liberada') = 2
       and (select count(*) from ofertas_viaje where conductor_id = '22222222-2222-2222-2222-222222222222' and resultado in ('pendiente', 'rechazada')) = 0
       as las_otras_quedan_liberadas_no_rechazadas;
select (select estado from viajes where id = 'b0000000-0000-0000-0000-000000000001') = 'solicitado'
       and (select estado from viajes where id = 'b0000000-0000-0000-0000-000000000003') = 'solicitado'
       as las_liberadas_siguen_buscando;
select (select resultado from ofertas_viaje where viaje_id = 'b0000000-0000-0000-0000-000000000001' and conductor_id = '44444444-4444-4444-4444-444444444444') = 'pendiente'
       as la_oferta_de_diego_sigue_abierta;
set role service_role;
select not exists (select 1 from candidatos_despacho('b0000000-0000-0000-0000-000000000004') where conductor_id = '22222222-2222-2222-2222-222222222222') as ocupada_no_es_candidata;
select exists (select 1 from candidatos_despacho('b0000000-0000-0000-0000-000000000003') where conductor_id = '44444444-4444-4444-4444-444444444444') as el_viaje_3_pasa_a_diego;
reset role;

\echo '--- dejar de estar disponible sigue rechazando lo pendiente (003) ---'
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
update tricimotos set estado = 'inactivo' where conductor_id = '44444444-4444-4444-4444-444444444444';
reset role;
select (select resultado from ofertas_viaje where viaje_id = 'b0000000-0000-0000-0000-000000000001' and conductor_id = '44444444-4444-4444-4444-444444444444') = 'rechazada'
       as no_disponible_rechaza_sus_ofertas;

\echo 'RLS 006: TODAS LAS PRUEBAS TERMINARON'

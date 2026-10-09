-- Pruebas de BD del paso 004 (T2): dispositivos para avisos y privacidad de la ubicación.
-- Debe terminar con 'RLS 004: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajero del viaje
  ('22222222-2222-2222-2222-222222222222'),  -- conductor del viaje
  ('33333333-3333-3333-3333-333333333333'),  -- otro pasajero
  ('44444444-4444-4444-4444-444444444444');  -- otro conductor

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
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

insert into consentimientos (user_id, version) values
  ('11111111-1111-1111-1111-111111111111', 'prueba'),
  ('22222222-2222-2222-2222-222222222222', 'prueba'),
  ('33333333-3333-3333-3333-333333333333', 'prueba'),
  ('44444444-4444-4444-4444-444444444444', 'prueba');
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Pedro', '0991111111'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('33333333-3333-3333-3333-333333333333', 'pasajero', 'Xavi', '0993333333'),
  ('44444444-4444-4444-4444-444444444444', 'conductor', 'Diego', '0994444444');
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado) values
  ('22222222-2222-2222-2222-222222222222', '1700000002', '22222222-2222-2222-2222-222222222222/conductor.jpg', '22222222-2222-2222-2222-222222222222/cedula.jpg', '22222222-2222-2222-2222-222222222222/vehiculo.jpg', 'aprobado'),
  ('44444444-4444-4444-4444-444444444444', '1700000004', '44444444-4444-4444-4444-444444444444/conductor.jpg', '44444444-4444-4444-4444-444444444444/cedula.jpg', '44444444-4444-4444-4444-444444444444/vehiculo.jpg', 'aprobado');
insert into tricimotos (conductor_id, placa, estado, ubicacion_actual) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'ocupado',    extensions.st_geogfromtext('SRID=4326;POINT(-80.5401 -0.8700)')),
  ('44444444-4444-4444-4444-444444444444', 'DEF-456', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5402 -0.8700)'));
-- Viaje aceptado de Pedro con Carla (lo crea el sistema, como aceptar_viaje).
insert into viajes (id, pasajero_id, conductor_id, origen, destino, estado, aceptado_en) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5210 -0.8015)'),
   'aceptado', now());

\echo '--- P3, criterio 11: dispositivos para avisos ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select registrar_dispositivo('ExponentPushToken[telefonoDePedro01]');
select (select count(*) from dispositivos_push) = 1 as pedro_ve_su_token;
-- Volver a registrar el mismo teléfono no duplica.
select registrar_dispositivo('ExponentPushToken[telefonoDePedro01]');
select (select count(*) from dispositivos_push) = 1 as registrar_dos_veces_no_duplica;
select pg_temp.debe_fallar($q$insert into dispositivos_push (token, usuario_id) values ('ExponentPushToken[directoSinRpc0001]', '11111111-1111-1111-1111-111111111111')$q$, 'insert directo');
select pg_temp.debe_fallar($q$update dispositivos_push set usuario_id = '33333333-3333-3333-3333-333333333333'$q$, 'update directo');
select pg_temp.debe_fallar($q$delete from dispositivos_push$q$, 'delete directo');
select pg_temp.debe_fallar($q$select registrar_dispositivo('token-inventado')$q$, 'token con formato inválido');

-- El mismo teléfono inicia sesión con otra cuenta: el token pasa a Xavi.
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select registrar_dispositivo('ExponentPushToken[telefonoDePedro01]');
select (select count(*) from dispositivos_push) = 1 as el_telefono_pasa_a_la_nueva_cuenta;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select (select count(*) from dispositivos_push) = 0 as la_cuenta_anterior_ya_no_lo_tiene;
select not olvidar_dispositivo('ExponentPushToken[telefonoDePedro01]') as no_olvida_el_token_de_otro;

-- Como mucho 3 teléfonos por cuenta: el más viejo se olvida.
select registrar_dispositivo('ExponentPushToken[pedroTelefonoA001]');
select registrar_dispositivo('ExponentPushToken[pedroTelefonoB001]');
select registrar_dispositivo('ExponentPushToken[pedroTelefonoC001]');
select registrar_dispositivo('ExponentPushToken[pedroTelefonoD001]');
select (select count(*) from dispositivos_push) = 3 as maximo_tres_telefonos;
select not exists (select 1 from dispositivos_push where token = 'ExponentPushToken[pedroTelefonoA001]') as se_olvida_el_mas_viejo;
select olvidar_dispositivo('ExponentPushToken[pedroTelefonoD001]') as cerrar_sesion_olvida_el_token;
select (select count(*) from dispositivos_push) = 2 as quedan_dos;
reset role;

set role anon;
select pg_temp.como('');
select pg_temp.debe_fallar($q$select registrar_dispositivo('ExponentPushToken[visitanteSinCuenta1]')$q$, 'visitante registra token');
select pg_temp.debe_fallar($q$select * from dispositivos_push$q$, 'visitante lee tokens');
reset role;

set role service_role;
select (select count(*) from dispositivos_push) = 3 as el_sistema_lee_todos_los_tokens;
reset role;

\echo '--- P15, criterio 14: nadie lee ubicacion_actual por REST ---'
set role authenticated;
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select pg_temp.debe_fallar($q$select ubicacion_actual from tricimotos$q$, 'otro pasajero lee la ubicación');
select pg_temp.debe_fallar($q$select * from tricimotos$q$, 'select * (como PostgREST sin columnas)');
select (select count(*) from tricimotos where placa = 'ABC-123') = 1 as sigue_viendo_placa_y_estado;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar($q$select ubicacion_actual from tricimotos where conductor_id = '22222222-2222-2222-2222-222222222222'$q$, 'otro conductor lee la ubicación');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$select ubicacion_actual from tricimotos$q$, 'el pasajero tampoco la lee directo');

-- El conductor sigue enviando su ubicación (update_location) y leyendo lo que necesita.
select pg_temp.como('22222222-2222-2222-2222-222222222222');
update tricimotos set ubicacion_actual = extensions.st_geogfromtext('SRID=4326;POINT(-80.5405 -0.8705)'), sector_id = 'malecon'
 where conductor_id = '22222222-2222-2222-2222-222222222222'
 returning conductor_id = '22222222-2222-2222-2222-222222222222' as conductor_actualiza_su_ubicacion;
select ubicacion_en > now() - interval '5 seconds' as lee_su_frescura from tricimotos
 where conductor_id = '22222222-2222-2222-2222-222222222222';
-- El registro del conductor ya no puede pedir todas las columnas al insertar (authController corregido).
select pg_temp.debe_fallar($q$insert into tricimotos (conductor_id, placa) values ('22222222-2222-2222-2222-222222222222', 'ZZZ-999') returning *$q$, 'insert con returning *');
reset role;

\echo '--- criterios 13, 14, 15 y 17: ubicación del conductor de mi viaje ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select abs(lat - (-0.8705)) < 0.00001 and abs(lng - (-80.5405)) < 0.00001 and actualizado_en is not null as el_pasajero_ve_a_su_conductor
  from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select (select count(*) from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001')) = 0 as otro_pasajero_no_la_ve;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select (select count(*) from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001')) = 0 as otro_conductor_no_la_ve;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select (select count(*) from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001')) = 0 as el_propio_conductor_no_la_pide_por_aqui;
reset role;

-- En curso sigue visible; al terminar deja de verse (15).
update viajes set estado = 'en_curso' where id = 'b0000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select (select count(*) from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001')) = 1 as visible_en_curso;
reset role;
update viajes set estado = 'finalizado' where id = 'b0000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select (select count(*) from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001')) = 0 as al_terminar_deja_de_verse;
reset role;

set role anon;
select pg_temp.como('');
select pg_temp.debe_fallar($q$select * from ubicacion_conductor_viaje('b0000000-0000-0000-0000-000000000001')$q$, 'visitante pide la ubicación');
reset role;

\echo '--- criterio 16: sin historial ---'
select (select count(*) from tricimotos where conductor_id = '22222222-2222-2222-2222-222222222222') = 1 as una_sola_fila_con_la_ultima_posicion;
select not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'dispositivos_push'
                      and column_name like '%ubicacion%') as los_tokens_no_guardan_ubicacion;

\echo 'RLS 004: TODAS LAS PRUEBAS TERMINARON'

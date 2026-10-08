-- Pruebas de RLS del paso 002 (identidad, consentimiento, aprobación de conductores y Storage).
-- Debe terminar con 'RLS 002: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajero
  ('22222222-2222-2222-2222-222222222222'),  -- conductor que será aprobado
  ('44444444-4444-4444-4444-444444444444'),  -- conductor que será rechazado
  ('55555555-5555-5555-5555-555555555555'),  -- administrador
  ('66666666-6666-6666-6666-666666666666'),  -- usuario sin consentimiento
  ('33333333-3333-3333-3333-333333333333');  -- otro pasajero

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
grant execute on all functions in schema pg_temp to authenticated, anon;

-- El administrador lo crea un SQL de una sola vez (aquí, como superusuario).
insert into consentimientos (user_id, version) values ('55555555-5555-5555-5555-555555555555', 'prueba');
insert into perfiles (id, rol, nombre, telefono) values ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555');

set role authenticated;

\echo '--- criterio 1: consentimiento ---'
select pg_temp.como('66666666-6666-6666-6666-666666666666');
select pg_temp.debe_fallar($q$insert into perfiles (id, rol, nombre, telefono) values ('66666666-6666-6666-6666-666666666666','pasajero','Sin Consentimiento','0996666666')$q$, 'perfil sin consentimiento');
insert into consentimientos (user_id, version, aceptado_en) values ('66666666-6666-6666-6666-666666666666', '0.1', '2001-01-01');
select (now() - aceptado_en) < interval '1 minute' as fecha_la_fija_la_bd from consentimientos where user_id = '66666666-6666-6666-6666-666666666666';
insert into perfiles (id, rol, nombre, telefono) values ('66666666-6666-6666-6666-666666666666','pasajero','Con Consentimiento','0996666666');
select pg_temp.debe_fallar($q$update consentimientos set version='9.9' where user_id='66666666-6666-6666-6666-666666666666'$q$, 'editar consentimiento');
select pg_temp.debe_fallar($q$delete from consentimientos where user_id='66666666-6666-6666-6666-666666666666'$q$, 'borrar consentimiento');
select pg_temp.debe_fallar($q$insert into consentimientos (user_id, version) values ('11111111-1111-1111-1111-111111111111','0.1')$q$, 'consentir por otro');

-- perfiles de prueba
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into consentimientos (user_id, version) values ('11111111-1111-1111-1111-111111111111', '0.1');
insert into perfiles (id, rol, nombre, telefono) values ('11111111-1111-1111-1111-111111111111','pasajero','Pedro','0991111111');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
insert into consentimientos (user_id, version) values ('33333333-3333-3333-3333-333333333333', '0.1');
insert into perfiles (id, rol, nombre, telefono) values ('33333333-3333-3333-3333-333333333333','pasajero','Xavi','0993333333');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
insert into consentimientos (user_id, version) values ('22222222-2222-2222-2222-222222222222', '0.1');
insert into perfiles (id, rol, nombre, telefono) values ('22222222-2222-2222-2222-222222222222','conductor','Carla','0992222222');
insert into tricimotos (conductor_id, placa) values ('22222222-2222-2222-2222-222222222222','ABC-123');
select pg_temp.como('44444444-4444-4444-4444-444444444444');
insert into consentimientos (user_id, version) values ('44444444-4444-4444-4444-444444444444', '0.1');
insert into perfiles (id, rol, nombre, telefono) values ('44444444-4444-4444-4444-444444444444','conductor','Diego','0994444444');
insert into tricimotos (conductor_id, placa) values ('44444444-4444-4444-4444-444444444444','DEF-456');

\echo '--- verificación: quién puede pedirla ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo) values ('11111111-1111-1111-1111-111111111111','1700000001','11111111-1111-1111-1111-111111111111/conductor.jpg','11111111-1111-1111-1111-111111111111/cedula.jpg','11111111-1111-1111-1111-111111111111/vehiculo.jpg')$q$, 'pasajero pide verificación');

select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado) values ('22222222-2222-2222-2222-222222222222','1700000002','22222222-2222-2222-2222-222222222222/conductor.jpg','22222222-2222-2222-2222-222222222222/cedula.jpg','22222222-2222-2222-2222-222222222222/vehiculo.jpg','aprobado')$q$, 'conductor se inserta ya aprobado');
select pg_temp.debe_fallar($q$insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo) values ('22222222-2222-2222-2222-222222222222','1700000002','44444444-4444-4444-4444-444444444444/conductor.jpg','22222222-2222-2222-2222-222222222222/cedula.jpg','22222222-2222-2222-2222-222222222222/vehiculo.jpg')$q$, 'foto en la carpeta de otro');
select pg_temp.debe_fallar($q$insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo) values ('22222222-2222-2222-2222-222222222222','123','22222222-2222-2222-2222-222222222222/conductor.jpg','22222222-2222-2222-2222-222222222222/cedula.jpg','22222222-2222-2222-2222-222222222222/vehiculo.jpg')$q$, 'cédula inválida');
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo) values ('22222222-2222-2222-2222-222222222222','1700000002','22222222-2222-2222-2222-222222222222/conductor.jpg','22222222-2222-2222-2222-222222222222/cedula.jpg','22222222-2222-2222-2222-222222222222/vehiculo.jpg');
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar($q$insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo) values ('44444444-4444-4444-4444-444444444444','1700000002','44444444-4444-4444-4444-444444444444/conductor.jpg','44444444-4444-4444-4444-444444444444/cedula.jpg','44444444-4444-4444-4444-444444444444/vehiculo.jpg')$q$, 'cédula repetida');
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo) values ('44444444-4444-4444-4444-444444444444','1700000004','44444444-4444-4444-4444-444444444444/conductor.jpg','44444444-4444-4444-4444-444444444444/cedula.jpg','44444444-4444-4444-4444-444444444444/vehiculo.jpg');

\echo '--- criterio 4: nadie se aprueba ni se hace admin ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$update conductores_verificacion set estado='aprobado' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'conductor se aprueba solo');
select pg_temp.debe_fallar($q$update conductores_verificacion set estado='aprobado', revisado_por='22222222-2222-2222-2222-222222222222' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'conductor se aprueba con revisor propio');
select pg_temp.debe_fallar($q$update perfiles set rol='admin' where id='22222222-2222-2222-2222-222222222222'$q$, 'conductor se hace admin');
select pg_temp.debe_fallar($q$insert into perfiles (id, rol, nombre, telefono) values ('33333333-3333-3333-3333-333333333333','admin','Otro','0990000000')$q$, 'insertar perfil admin');

\echo '--- criterio 2: conductor sin aprobar no opera ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into viajes (id, pasajero_id, origen, destino) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', extensions.st_geogfromtext('SRID=4326;POINT(-80.5375 -0.8706)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8350)'));
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 0 as pendiente_no_ve_viajes_solicitados from viajes;
select pg_temp.debe_fallar($q$update tricimotos set estado='disponible' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'pendiente se pone disponible');
select pg_temp.debe_fallar($q$update tricimotos set ubicacion_actual=extensions.st_geogfromtext('SRID=4326;POINT(-80.5375 -0.8706)') where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'pendiente actualiza ubicación');
select pg_temp.debe_fallar($q$update viajes set conductor_id='22222222-2222-2222-2222-222222222222', estado='aceptado' where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'pendiente acepta un viaje');

\echo '--- criterio 3: el administrador aprueba y rechaza ---'
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select count(*) = 2 as admin_ve_las_dos_solicitudes from conductores_verificacion;
select pg_temp.debe_fallar($q$update conductores_verificacion set estado='aprobado' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'aprobar sin registrar al revisor');
select pg_temp.debe_fallar($q$update conductores_verificacion set cedula='1700000099', estado='aprobado', revisado_por='55555555-5555-5555-5555-555555555555' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'admin edita la cédula del conductor');
select pg_temp.debe_fallar($q$update conductores_verificacion set estado='rechazado', revisado_por='55555555-5555-5555-5555-555555555555' where conductor_id='44444444-4444-4444-4444-444444444444'$q$, 'rechazar sin motivo');
update conductores_verificacion set estado='aprobado', revisado_por='55555555-5555-5555-5555-555555555555' where conductor_id='22222222-2222-2222-2222-222222222222';
update conductores_verificacion set estado='rechazado', motivo_rechazo='La foto de la cédula no se lee', revisado_por='55555555-5555-5555-5555-555555555555' where conductor_id='44444444-4444-4444-4444-444444444444';
select estado = 'aprobado' and revisado_por = '55555555-5555-5555-5555-555555555555' and revisado_en is not null as quedo_quien_y_cuando from conductores_verificacion where conductor_id='22222222-2222-2222-2222-222222222222';
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$update conductores_verificacion set estado='aprobado' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'pasajero aprueba');

\echo '--- aprobado: ya puede operar y no puede editar su verificación ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
update tricimotos set estado='disponible', ubicacion_actual=extensions.st_geogfromtext('SRID=4326;POINT(-80.5375 -0.8706)') where conductor_id='22222222-2222-2222-2222-222222222222';
select count(*) = 1 as aprobado_ve_viaje_solicitado from viajes where estado='solicitado';
update viajes set conductor_id='22222222-2222-2222-2222-222222222222', estado='aceptado', aceptado_en=now() where id='aaaaaaaa-0000-0000-0000-000000000001';
select count(*) = 1 as aprobado_acepto_el_viaje from viajes where conductor_id='22222222-2222-2222-2222-222222222222';
select pg_temp.debe_fallar($q$update conductores_verificacion set cedula='1700000077' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'aprobado edita su cédula');

\echo '--- rechazado: corrige y vuelve a pendiente ---'
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select motivo_rechazo like 'La foto%' as rechazado_ve_el_motivo from conductores_verificacion;
update conductores_verificacion set cedula='1700000005' where conductor_id='44444444-4444-4444-4444-444444444444';
select estado = 'pendiente' and motivo_rechazo is null and revisado_por is null and revisado_en is null as vuelve_a_pendiente_limpio from conductores_verificacion;
select pg_temp.debe_fallar($q$update tricimotos set estado='disponible' where conductor_id='44444444-4444-4444-4444-444444444444'$q$, 'reenviado sigue sin operar');

\echo '--- criterio 5: privacidad de la cédula ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select count(*) = 0 as pasajero_no_ve_verificaciones from conductores_verificacion;
select count(*) = 0 as pasajero_no_ve_consentimientos_ajenos from consentimientos where user_id <> '11111111-1111-1111-1111-111111111111';
select nombre = 'Carla' and telefono = '0992222222' as pasajero_ve_nombre_y_telefono_del_conductor from perfiles where id='22222222-2222-2222-2222-222222222222';
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select count(*) = 1 as conductor_solo_ve_la_suya from conductores_verificacion;

\echo '--- storage privado ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
insert into storage.objects (bucket_id, name, owner) values ('verificacion', '22222222-2222-2222-2222-222222222222/conductor.jpg', '22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$insert into storage.objects (bucket_id, name, owner) values ('verificacion', '44444444-4444-4444-4444-444444444444/conductor.jpg', '22222222-2222-2222-2222-222222222222')$q$, 'subir a la carpeta de otro');
select pg_temp.debe_fallar($q$insert into storage.objects (bucket_id, name, owner) values ('verificacion', '22222222-2222-2222-2222-222222222222/otro.jpg', '22222222-2222-2222-2222-222222222222')$q$, 'nombre de archivo no permitido');
select pg_temp.debe_fallar($q$update storage.objects set name='22222222-2222-2222-2222-222222222222/cedula.jpg' where name='22222222-2222-2222-2222-222222222222/conductor.jpg'$q$, 'aprobado reemplaza su foto');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$insert into storage.objects (bucket_id, name, owner) values ('verificacion', '11111111-1111-1111-1111-111111111111/conductor.jpg', '11111111-1111-1111-1111-111111111111')$q$, 'pasajero sube archivos de verificación');
select count(*) = 0 as pasajero_no_lee_fotos from storage.objects where bucket_id='verificacion';
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select count(*) = 0 as otro_conductor_no_lee_fotos_ajenas from storage.objects where bucket_id='verificacion';
insert into storage.objects (bucket_id, name, owner) values ('verificacion', '44444444-4444-4444-4444-444444444444/cedula.jpg', '44444444-4444-4444-4444-444444444444');
update storage.objects set name='44444444-4444-4444-4444-444444444444/cedula.jpg' where name='44444444-4444-4444-4444-444444444444/cedula.jpg';
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select count(*) = 2 as admin_lee_todas_las_fotos from storage.objects where bucket_id='verificacion';

\echo '--- anon ---'
reset role; set role anon;
select pg_temp.debe_fallar($q$select * from conductores_verificacion$q$, 'anon lee verificaciones');
select pg_temp.debe_fallar($q$select * from consentimientos$q$, 'anon lee consentimientos');
reset role;
select public = false and file_size_limit = 1048576 and allowed_mime_types = array['image/jpeg'] as bucket_privado_1mb_jpeg from storage.buckets where id = 'verificacion';
\echo 'RLS 002: TODAS LAS PRUEBAS TERMINARON'

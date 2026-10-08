-- Pruebas de RLS del paso 001. Debe terminar con 'RLS: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333'),('44444444-4444-4444-4444-444444444444');

create or replace function pg_temp.como(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;
create or replace function pg_temp.debe_fallar(q text, nombre text) returns void language plpgsql as $$
declare n int;
begin
  begin
    execute q; get diagnostics n = row_count;
    if n = 0 then raise notice 'OK  % (0 filas afectadas)', nombre; return; end if;
  exception when insufficient_privilege or check_violation or not_null_violation then
    raise notice 'OK  % (bloqueado: %)', nombre, sqlerrm; return;
  end;
  raise exception 'FALLO: % se permitió (% filas)', nombre, n;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

\echo '--- criterio 2 y 3: catálogo ---'
select (select count(*) from sectores) = 5 and (select count(*) from tarifas) = 10 as semilla_ok;
select (select precio from obtener_tarifa('playa','centro')) = (select precio from obtener_tarifa('centro','playa'))
   and (select precio from obtener_tarifa('playa','centro')) = 1.50 as simetria_ok;

set role authenticated;
\echo '--- perfiles ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into perfiles (id, rol, nombre, telefono) values ('11111111-1111-1111-1111-111111111111','pasajero','Pedro','0991111111');
select pg_temp.debe_fallar($q$insert into perfiles (id, rol, nombre, telefono) values ('33333333-3333-3333-3333-333333333333','pasajero','Suplantado','0993333330')$q$, 'insertar perfil ajeno');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select pg_temp.debe_fallar($q$insert into perfiles (id, rol, nombre, telefono) values ('33333333-3333-3333-3333-333333333333','admin','Hacker','0993333333')$q$, 'auto-asignarse admin');
insert into perfiles (id, rol, nombre, telefono) values ('33333333-3333-3333-3333-333333333333','pasajero','Xavi','0993333333');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$update perfiles set rol='admin' where id='11111111-1111-1111-1111-111111111111'$q$, 'cambiar su propio rol');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
insert into perfiles (id, rol, nombre, telefono) values ('22222222-2222-2222-2222-222222222222','conductor','Carla','0992222222');
select pg_temp.como('44444444-4444-4444-4444-444444444444');
insert into perfiles (id, rol, nombre, telefono) values ('44444444-4444-4444-4444-444444444444','conductor','Diego','0994444444');

\echo '--- tricimotos ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar($q$insert into tricimotos (conductor_id, placa) values ('11111111-1111-1111-1111-111111111111','PAS-001')$q$, 'pasajero registra tricimoto');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
insert into tricimotos (conductor_id, placa) values ('22222222-2222-2222-2222-222222222222','ABC-123');
update tricimotos set estado='disponible', sector_id='centro', ubicacion_actual=extensions.st_geogfromtext('SRID=4326;POINT(-80.5432 -1.0448)') where conductor_id='22222222-2222-2222-2222-222222222222';
select pg_temp.debe_fallar($q$update tricimotos set placa='ZZZ-999' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'cambiar su placa');
select pg_temp.como('44444444-4444-4444-4444-444444444444');
insert into tricimotos (conductor_id, placa) values ('44444444-4444-4444-4444-444444444444','DEF-456');
select pg_temp.debe_fallar($q$update tricimotos set estado='inactivo' where conductor_id='22222222-2222-2222-2222-222222222222'$q$, 'modificar tricimoto ajena');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select count(*) = 1 as pasajero_ve_solo_disponibles from tricimotos;

\echo '--- viajes ---'
insert into viajes (id, pasajero_id, origen, destino, tarifa) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', extensions.st_geogfromtext('SRID=4326;POINT(-80.5432 -1.0448)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5485 -1.0470)'), 1.50);
select pg_temp.debe_fallar($q$update viajes set tarifa=0.01 where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, 'pasajero cambia la tarifa');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$insert into viajes (pasajero_id, origen, destino) values ('22222222-2222-2222-2222-222222222222', extensions.st_geogfromtext('SRID=4326;POINT(0 0)'), extensions.st_geogfromtext('SRID=4326;POINT(0 0)'))$q$, 'conductor crea viaje');
select count(*) = 1 as conductor_ve_solicitado from viajes where estado='solicitado';
update viajes set conductor_id='22222222-2222-2222-2222-222222222222', estado='aceptado', aceptado_en=now() where id='aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select count(*) = 0 as otro_conductor_ya_no_lo_ve from viajes;
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select count(*) = 0 as otro_pasajero_no_lo_ve from viajes;

\echo '--- chat ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
insert into threads (id, viaje_id, created_by) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222');
insert into thread_members (thread_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$insert into thread_members (thread_id, user_id) values ('bbbbbbbb-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333')$q$, 'meter a un tercero al chat');
insert into messages (thread_id, sender_id, content) values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Voy en camino');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select count(*) = 1 as pasajero_lee_mensaje from messages;
select nombre = 'Carla' as pasajero_ve_nombre_conductor from perfiles where id='22222222-2222-2222-2222-222222222222';
select pg_temp.debe_fallar($q$insert into messages (thread_id, sender_id, content) values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','suplantación')$q$, 'enviar mensaje como otro');
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select count(*) = 0 as tercero_no_lee_mensajes from messages;
select count(*) = 0 as tercero_no_ve_perfil_conductor from perfiles where id='22222222-2222-2222-2222-222222222222';

\echo '--- estados y trigger ---'
select pg_temp.como('22222222-2222-2222-2222-222222222222');
update viajes set estado='en_curso' where id='aaaaaaaa-0000-0000-0000-000000000001';
select updated_at > creado_en as trigger_updated_at_ok from viajes where id='aaaaaaaa-0000-0000-0000-000000000001';

\echo '--- anon ---'
reset role; set role anon;
select count(*) = 5 as anon_lee_sectores from sectores;
select count(*) = 0 as anon_no_lee_perfiles from perfiles;
select count(*) = 0 as anon_no_lee_viajes from viajes;
reset role;
\echo 'RLS: TODAS LAS PRUEBAS TERMINARON'

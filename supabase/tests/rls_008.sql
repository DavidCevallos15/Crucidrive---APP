-- Pruebas de BD del 007, PR 2 (0018): el teléfono solo con un viaje activo y consentimientos sin número interno.
-- Debe terminar con 'RLS 008: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajera Ana
  ('22222222-2222-2222-2222-222222222222'),  -- conductora Carla
  ('33333333-3333-3333-3333-333333333333'),  -- otro pasajero (tercero)
  ('55555555-5555-5555-5555-555555555555'),  -- administrador
  ('66666666-6666-6666-6666-666666666666');  -- usuaria nueva, sin perfil

create or replace function pg_temp.como(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;
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
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555');
insert into tricimotos (conductor_id, placa, estado) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'ocupado');

-- Viaje de Ana con Carla, ya aceptado (como lo deja aceptar_viaje).
insert into viajes (id, pasajero_id, conductor_id, estado, aceptado_en, origen, destino) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aceptado', now(),
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));

\echo '--- criterio 7: con el viaje aceptado, cada parte ve el teléfono de la otra ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') = '0992222222' as pasajera_ve_telefono_aceptado;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') = '0991111111' as conductora_ve_telefono_aceptado;
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') is null as tercero_no_ve_telefono;
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') is null as admin_no_es_contraparte;

reset role;
update viajes set estado = 'en_curso' where id = 'e0000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') = '0992222222' as pasajera_ve_telefono_en_curso;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') = '0991111111' as conductora_ve_telefono_en_curso;

\echo '--- criterios 8 y 9: viaje cerrado, sin teléfono y con el nombre ---'
reset role;
update viajes set estado = 'finalizado', finalizado_por = 'conductor' where id = 'e0000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') is null as pasajera_sin_telefono_finalizado;
select nombre = 'Carla' as pasajera_ve_nombre_tras_el_viaje from perfiles where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select telefono_contraparte('e0000000-0000-0000-0000-000000000001') is null as conductora_sin_telefono_finalizado;
select nombre = 'Ana' as conductora_ve_nombre_tras_el_viaje from perfiles where id = '11111111-1111-1111-1111-111111111111';

reset role;
insert into viajes (id, pasajero_id, conductor_id, estado, aceptado_en, origen, destino) values
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'aceptado', now(),
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
update viajes set estado = 'cancelado', cancelado_por = 'pasajero' where id = 'e0000000-0000-0000-0000-000000000002';
insert into viajes (id, pasajero_id, origen, destino) values
  ('e0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
update viajes set estado = 'sin_conductor' where id = 'e0000000-0000-0000-0000-000000000003';
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select telefono_contraparte('e0000000-0000-0000-0000-000000000002') is null as pasajera_sin_telefono_cancelado;
select telefono_contraparte('e0000000-0000-0000-0000-000000000003') is null as pasajera_sin_telefono_sin_conductor;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select telefono_contraparte('e0000000-0000-0000-0000-000000000002') is null as conductora_sin_telefono_cancelado;

\echo '--- criterio 8: ninguna otra vía lee el teléfono ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select pg_temp.debe_fallar_con($q$select telefono from perfiles where id = '22222222-2222-2222-2222-222222222222'$q$, 'permission denied', 'leer el teléfono de otro con select');
select pg_temp.debe_fallar_con($q$select * from perfiles$q$, 'permission denied', 'leer perfiles con *');
select pg_temp.debe_fallar_con($q$select id from perfiles where telefono = '0992222222'$q$, 'permission denied', 'buscar por teléfono');
select pg_temp.debe_fallar_con($q$select telefono from perfiles where id = '11111111-1111-1111-1111-111111111111'$q$, 'permission denied', 'leer el propio teléfono con select');

\echo '--- criterio 10: el propio usuario y el administrador ---'
select count(*) = 1 as mi_perfil_una_fila from mi_perfil();
select id = '11111111-1111-1111-1111-111111111111' and nombre = 'Ana' and telefono = '0991111111' and rol = 'pasajero' and activo
  as mi_perfil_completo from mi_perfil();
select count(*) = 0 as pasajera_no_usa_telefonos_admin from telefonos_admin(array['22222222-2222-2222-2222-222222222222']::uuid[]);
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 0 as conductora_no_usa_telefonos_admin from telefonos_admin(array['11111111-1111-1111-1111-111111111111']::uuid[]);
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select telefono = '0992222222' as admin_ve_telefono_de_conductora
  from telefonos_admin(array['22222222-2222-2222-2222-222222222222']::uuid[]);
select count(*) = 2 as admin_pide_dos
  from telefonos_admin(array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]);
select nombre = 'Carla' as admin_ve_nombre from perfiles where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.como('66666666-6666-6666-6666-666666666666');
select count(*) = 0 as sin_perfil_mi_perfil_vacio from mi_perfil();

\echo '--- registro, edición y borrado del propio perfil siguen funcionando ---'
insert into perfiles (id, rol, nombre, telefono) values ('66666666-6666-6666-6666-666666666666', 'pasajero', 'Nueva', '0996666666');
select telefono = '0996666666' as nueva_ve_su_telefono from mi_perfil();
update perfiles set nombre = 'Nueva Dos' where id = '66666666-6666-6666-6666-666666666666';
select nombre = 'Nueva Dos' as nueva_cambia_su_nombre from perfiles where id = '66666666-6666-6666-6666-666666666666';
delete from perfiles where id = '66666666-6666-6666-6666-666666666666';
select count(*) = 0 as nueva_borra_su_perfil from mi_perfil();

\echo '--- criterio 15: consentimientos sin número interno ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select count(*) = 1 and bool_and(version = 'prueba' and aceptado_en is not null) as pasajera_ve_version_y_fecha
  from (select user_id, version, aceptado_en from consentimientos) c;
select pg_temp.debe_fallar_con($q$select id from consentimientos$q$, 'permission denied', 'leer consentimientos.id');
select pg_temp.debe_fallar_con($q$select * from consentimientos$q$, 'permission denied', 'leer consentimientos con *');
insert into consentimientos (user_id, version) values ('11111111-1111-1111-1111-111111111111', 'v2');
select count(*) = 2 as pasajera_vuelve_a_aceptar from consentimientos where user_id = '11111111-1111-1111-1111-111111111111';

\echo '--- anon no llega a nada ---'
set role anon;
select pg_temp.debe_fallar_con($q$select telefono_contraparte('e0000000-0000-0000-0000-000000000001')$q$, 'permission denied', 'anon pide teléfono');
select pg_temp.debe_fallar_con($q$select * from mi_perfil()$q$, 'permission denied', 'anon pide mi_perfil');
select pg_temp.debe_fallar_con($q$select nombre from perfiles$q$, 'permission denied', 'anon lee perfiles');
reset role;

\echo 'RLS 008: TODAS LAS PRUEBAS TERMINARON'

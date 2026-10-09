-- Pruebas de BD del paso 003 (catálogo de lugares; el despacho se suma con la T3).
-- Debe terminar con 'RLS 003: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajero
  ('22222222-2222-2222-2222-222222222222'),  -- conductor
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
grant execute on all functions in schema pg_temp to authenticated, anon;

insert into consentimientos (user_id, version) values
  ('11111111-1111-1111-1111-111111111111', 'prueba'),
  ('22222222-2222-2222-2222-222222222222', 'prueba'),
  ('55555555-5555-5555-5555-555555555555', 'prueba');
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Pedro', '0991111111'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555');

-- Lugares que llegarían de OSM (los inserta el sistema, como la migración generada de la T5).
insert into lugares (nombre, categoria, ubicacion, fuente, osm_id) values
  ('Cevichería El Manaba',   'comida', extensions.st_geogfromtext('SRID=4326;POINT(-80.5390 -0.8690)'), 'osm', 'node/1'),
  ('FARMACIAS SANTA MARTHA', 'salud',  extensions.st_geogfromtext('SRID=4326;POINT(-80.5385 -0.8680)'), 'osm', 'node/2'),
  ('Farmacia RIOLPHARM',     'salud',  extensions.st_geogfromtext('SRID=4326;POINT(-80.5380 -0.8670)'), 'osm', 'node/3'),
  ('Letras Crucita',         'turismo', extensions.st_geogfromtext('SRID=4326;POINT(-80.5399 -0.8699)'), 'osm', 'node/4');

\echo '--- normalización y sector ---'
select private.normalizar('  Cevichería   EL Mañaba ') = 'cevicheria el manaba' as normaliza_tildes_mayusculas_espacios;
select count(*) = 2 as semilla_de_david from lugares where fuente = 'david';                         -- criterio 23
select sector_id = 'los_arenales' as muelle_en_su_sector from lugares where nombre = 'Muelle de Crucita';  -- criterio 19
select sector_id = 'malecon' as letras_en_el_malecon from lugares where osm_id = 'node/4';

\echo '--- criterio 18 y 26: búsqueda como visitante sin cuenta ---'
set role anon;
select pg_temp.como('');
select exists (select 1 from buscar_lugares('muelle') where nombre = 'Muelle de Crucita') as busca_por_palabra;
select exists (select 1 from buscar_lugares('MUELLE') where nombre = 'Muelle de Crucita') as ignora_mayusculas;
select exists (select 1 from buscar_lugares('cevicheria manaba') where nombre = 'Cevichería El Manaba') as ignora_tildes_y_palabra_faltante;
select (select count(*) from buscar_lugares('farmacia')) = 2 as lista_las_farmacias;
select exists (select 1 from buscar_lugares('farmasia') where categoria = 'salud') as tolera_error_leve;
select (select count(*) from buscar_lugares('m')) = 0 as exige_dos_letras;
select (select nombre from buscar_lugares('letras') limit 1) = 'Letras Crucita' as primero_el_que_empieza_igual;
select pg_temp.debe_fallar($q$insert into lugares (nombre, ubicacion) values ('Intruso', extensions.st_geogfromtext('SRID=4326;POINT(-80.53 -0.86)'))$q$, 'visitante crea lugar');
select pg_temp.debe_fallar($q$update lugares set nombre = 'X' where osm_id = 'node/1'$q$, 'visitante edita lugar');
reset role;

\echo '--- criterio 24: solo el administrador modifica ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select exists (select 1 from buscar_lugares('muelle')) as pasajero_busca;
select pg_temp.debe_fallar($q$insert into lugares (nombre, ubicacion) values ('Mi casa', extensions.st_geogfromtext('SRID=4326;POINT(-80.53 -0.86)'))$q$, 'pasajero crea lugar');
select pg_temp.debe_fallar($q$update lugares set visible = false where osm_id = 'node/1'$q$, 'pasajero oculta lugar');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$insert into lugares (nombre, ubicacion) values ('Mi parada', extensions.st_geogfromtext('SRID=4326;POINT(-80.53 -0.86)'))$q$, 'conductor crea lugar');
select pg_temp.debe_fallar($q$update lugares set nombre = 'Otro' where osm_id = 'node/2'$q$, 'conductor edita lugar');

select pg_temp.como('55555555-5555-5555-5555-555555555555');
select pg_temp.debe_fallar($q$insert into lugares (nombre, ubicacion, fuente, osm_id) values ('Falso OSM', extensions.st_geogfromtext('SRID=4326;POINT(-80.53 -0.86)'), 'osm', 'node/99')$q$, 'admin escribe fuente u osm_id');
insert into lugares (nombre, categoria, ubicacion) values ('Parada de La Boca', 'transporte', extensions.st_geogfromtext('SRID=4326;POINT(-80.5212 -0.8016)'));
select fuente = 'admin' and editado_por_admin and osm_id is null and sector_id = 'la_boca' as admin_crea_con_sector
  from lugares where nombre = 'Parada de La Boca';
update lugares set nombre = 'Cevichería El Manaba (malecón)' where osm_id = 'node/1';
select editado_por_admin as edicion_del_admin_queda_marcada from lugares where osm_id = 'node/1';
update lugares set visible = false where osm_id = 'node/3';
select exists (select 1 from lugares where osm_id = 'node/3') as admin_ve_lo_oculto;
select pg_temp.debe_fallar($q$delete from lugares where osm_id = 'node/2'$q$, 'admin borra lugar');
select pg_temp.debe_fallar($q$update lugares set editado_por_admin = false where osm_id = 'node/1'$q$, 'admin desmarca su edición');

select pg_temp.como('11111111-1111-1111-1111-111111111111');
select not exists (select 1 from buscar_lugares('riolpharm')) as oculto_no_sale_en_busqueda;
select not exists (select 1 from lugares where osm_id = 'node/3') as pasajero_no_ve_lo_oculto;
reset role;

\echo '--- criterio 22: volver a importar no duplica ni pisa al admin ---'
insert into lugares (nombre, categoria, ubicacion, fuente, osm_id) values
  ('Cevicheria El Manaba', 'comida', extensions.st_geogfromtext('SRID=4326;POINT(-80.5390 -0.8690)'), 'osm', 'node/1'),
  ('Farmacias Santa Martha', 'salud', extensions.st_geogfromtext('SRID=4326;POINT(-80.5386 -0.8681)'), 'osm', 'node/2')
on conflict (osm_id) do update
  set nombre = excluded.nombre, categoria = excluded.categoria, ubicacion = excluded.ubicacion
  where not lugares.editado_por_admin;
select count(*) = 4 as sin_duplicados from lugares where fuente = 'osm';
select nombre = 'Cevichería El Manaba (malecón)' as no_pisa_al_admin from lugares where osm_id = 'node/1';
select nombre = 'Farmacias Santa Martha' and not editado_por_admin as actualiza_lo_de_osm from lugares where osm_id = 'node/2';
select not visible as sigue_oculto from lugares where osm_id = 'node/3';

\echo 'RLS 003: TODAS LAS PRUEBAS TERMINARON'

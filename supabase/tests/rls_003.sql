-- Pruebas de BD del paso 003: catálogo de lugares (T2) y despacho (T3).
-- Debe terminar con 'RLS 003: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajero
  ('22222222-2222-2222-2222-222222222222'),  -- conductor
  ('55555555-5555-5555-5555-555555555555'),  -- administrador
  ('33333333-3333-3333-3333-333333333333'),  -- otro pasajero
  ('44444444-4444-4444-4444-444444444444'),  -- segundo conductor
  ('77777777-7777-7777-7777-777777777777');  -- conductor sin aprobar

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
-- Espera un error concreto (las funciones de despacho usan mensajes propios).
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

insert into consentimientos (user_id, version) values
  ('11111111-1111-1111-1111-111111111111', 'prueba'),
  ('22222222-2222-2222-2222-222222222222', 'prueba'),
  ('55555555-5555-5555-5555-555555555555', 'prueba'),
  ('33333333-3333-3333-3333-333333333333', 'prueba'),
  ('44444444-4444-4444-4444-444444444444', 'prueba'),
  ('77777777-7777-7777-7777-777777777777', 'prueba');
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Pedro', '0991111111'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555'),
  ('33333333-3333-3333-3333-333333333333', 'pasajero', 'Xavi', '0993333333'),
  ('44444444-4444-4444-4444-444444444444', 'conductor', 'Diego', '0994444444'),
  ('77777777-7777-7777-7777-777777777777', 'conductor', 'Nuevo', '0997777777');

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

-- ===================== DESPACHO (T3) =====================
-- Conductores: Carla (2222) y Diego (4444) aprobados; Nuevo (7777) sin aprobar.
-- Origen de los viajes: (-80.5400, -0.8700), cerca del malecón. 0,0001° ≈ 11 m.
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado) values
  ('22222222-2222-2222-2222-222222222222', '1700000002', '22222222-2222-2222-2222-222222222222/conductor.jpg', '22222222-2222-2222-2222-222222222222/cedula.jpg', '22222222-2222-2222-2222-222222222222/vehiculo.jpg', 'aprobado'),
  ('44444444-4444-4444-4444-444444444444', '1700000004', '44444444-4444-4444-4444-444444444444/conductor.jpg', '44444444-4444-4444-4444-444444444444/cedula.jpg', '44444444-4444-4444-4444-444444444444/vehiculo.jpg', 'aprobado'),
  ('77777777-7777-7777-7777-777777777777', '1700000007', '77777777-7777-7777-7777-777777777777/conductor.jpg', '77777777-7777-7777-7777-777777777777/cedula.jpg', '77777777-7777-7777-7777-777777777777/vehiculo.jpg', 'pendiente');
insert into tricimotos (conductor_id, placa, estado, ubicacion_actual) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5401 -0.8700)')),
  ('44444444-4444-4444-4444-444444444444', 'DEF-456', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5402 -0.8700)')),
  ('77777777-7777-7777-7777-777777777777', 'GHI-789', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'));

\echo '--- R9: frescura y disponibilidad las fija la BD ---'
select ubicacion_en > now() - interval '5 seconds' and disponible_desde is not null as marcas_al_crear
  from tricimotos where conductor_id = '22222222-2222-2222-2222-222222222222';
-- Diego lleva más tiempo disponible que Carla (para el desempate).
update tricimotos set disponible_desde = now() - interval '10 minutes' where conductor_id = '44444444-4444-4444-4444-444444444444';
update tricimotos set ubicacion_en = now() - interval '5 minutes' where conductor_id = '22222222-2222-2222-2222-222222222222';

set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
-- Carla parada: envía el mismo punto y vuelve a contar como ubicada (criterio 2).
update tricimotos set ubicacion_actual = ubicacion_actual where conductor_id = '22222222-2222-2222-2222-222222222222';
select ubicacion_en > now() - interval '5 seconds' as mismo_punto_refresca_ubicacion
  from tricimotos where conductor_id = '22222222-2222-2222-2222-222222222222';

\echo '--- criterio 19: viaje con lugar elegido ---'
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into viajes (id, pasajero_id, origen, destino, pasajeros, lugar_destino_id, destino_descripcion)
select 'a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
       extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'),
       extensions.st_geogfromtext('SRID=4326;POINT(-80.0000 -0.5000)'),  -- el cliente intenta otro punto
       2, l.id, 'junto a la entrada'
from lugares l where l.nombre = 'Muelle de Crucita';
select extensions.st_dwithin(v.destino, l.ubicacion, 1)
       and v.destino_descripcion = 'Muelle de Crucita · junto a la entrada'
       and v.sector_destino_id = 'los_arenales'
       and v.sector_origen_id = 'malecon'
       and v.tarifa = 1.00 as destino_sale_del_lugar
  from viajes v join lugares l on l.id = v.lugar_destino_id
 where v.id = 'a0000000-0000-0000-0000-000000000001';

\echo '--- criterio 13: un viaje activo por pasajero ---'
select pg_temp.debe_fallar($q$insert into viajes (pasajero_id, origen, destino) values ('11111111-1111-1111-1111-111111111111', extensions.st_geogfromtext('SRID=4326;POINT(-80.54 -0.87)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.53 -0.85)'))$q$, 'segundo viaje activo');

\echo '--- R4: nadie toma un viaje ni salta estados por fuera ---'
select pg_temp.debe_fallar($q$update viajes set conductor_id = '22222222-2222-2222-2222-222222222222' where id = 'a0000000-0000-0000-0000-000000000001'$q$, 'pasajero escribe conductor_id');
select pg_temp.debe_fallar($q$update viajes set estado = 'aceptado' where id = 'a0000000-0000-0000-0000-000000000001'$q$, 'pasajero pone aceptado');
select pg_temp.debe_fallar($q$update viajes set estado = 'sin_conductor' where id = 'a0000000-0000-0000-0000-000000000001'$q$, 'pasajero pone sin_conductor');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar($q$update viajes set conductor_id = '22222222-2222-2222-2222-222222222222', estado = 'aceptado' where id = 'a0000000-0000-0000-0000-000000000001'$q$, 'conductor toma un viaje sin oferta');
select not exists (select 1 from viajes where id = 'a0000000-0000-0000-0000-000000000001') as conductor_sin_oferta_no_ve_el_viaje;
select pg_temp.debe_fallar_con($q$select * from candidatos_despacho('a0000000-0000-0000-0000-000000000001')$q$, 'permission denied', 'conductor pide candidatos');
select pg_temp.debe_fallar_con($q$select * from crear_ofertas('a0000000-0000-0000-0000-000000000001', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds')$q$, 'permission denied', 'conductor se crea una oferta');
select pg_temp.debe_fallar_con($q$select * from cerrar_vencidos()$q$, 'permission denied', 'conductor cierra vencidos');
reset role;

\echo '--- criterios 2, 4, 5: candidatos ---'
set role service_role;
-- Carla (11 m) y Diego (22 m) están en el mismo tramo de 50 m: gana Diego, que lleva más tiempo disponible.
-- Nuevo está más cerca pero no está aprobado.
select array_agg(conductor_id order by n) = array['44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222']::uuid[] as desempate_y_sin_no_aprobados
  from candidatos_despacho('a0000000-0000-0000-0000-000000000001') with ordinality as c(conductor_id, distancia_m, disponible_desde, n);
reset role;
update tricimotos set ubicacion_actual = extensions.st_geogfromtext('SRID=4326;POINT(-80.5445 -0.8700)')
 where conductor_id = '44444444-4444-4444-4444-444444444444';   -- Diego a ~500 m
set role service_role;
select (select conductor_id from candidatos_despacho('a0000000-0000-0000-0000-000000000001') limit 1) = '22222222-2222-2222-2222-222222222222' as primero_el_mas_cercano;
reset role;
update tricimotos set ubicacion_en = now() - interval '2 minutes' where conductor_id = '44444444-4444-4444-4444-444444444444';
set role service_role;
select not exists (select 1 from candidatos_despacho('a0000000-0000-0000-0000-000000000001', 60) where conductor_id = '44444444-4444-4444-4444-444444444444') as sin_ubicacion_reciente_no_es_candidato;
reset role;
update tricimotos set ubicacion_en = now() where conductor_id = '44444444-4444-4444-4444-444444444444';

\echo '--- criterios 6, 7, 9: ofertas ---'
set role service_role;
select count(*) = 1 as oferta_secuencial_a_carla
  from crear_ofertas('a0000000-0000-0000-0000-000000000001', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
reset role;
set role authenticated;
select pg_temp.como('33333333-3333-3333-3333-333333333333');
insert into viajes (id, pasajero_id, origen, destino) values ('a0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8701)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
reset role;
set role service_role;
select count(*) = 0 as carla_no_recibe_dos_ofertas_a_la_vez
  from crear_ofertas('a0000000-0000-0000-0000-000000000002', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
select not exists (select 1 from candidatos_despacho('a0000000-0000-0000-0000-000000000002') where conductor_id = '22222222-2222-2222-2222-222222222222') as con_oferta_abierta_no_es_candidata;
reset role;

set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select exists (select 1 from viajes where id = 'a0000000-0000-0000-0000-000000000001') as con_oferta_ve_el_viaje;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('a0000000-0000-0000-0000-000000000001')$q$, 'oferta_no_vigente', 'aceptar sin oferta');
select pg_temp.como('77777777-7777-7777-7777-777777777777');
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('a0000000-0000-0000-0000-000000000001')$q$, 'conductor_no_aprobado', 'aceptar sin estar aprobado');
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select rechazar_oferta('a0000000-0000-0000-0000-000000000001') as carla_rechaza;
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('a0000000-0000-0000-0000-000000000001')$q$, 'oferta_no_vigente', 'aceptar tras rechazar');
reset role;
set role service_role;
select not exists (select 1 from candidatos_despacho('a0000000-0000-0000-0000-000000000001') where conductor_id = '22222222-2222-2222-2222-222222222222') as rechazo_no_vuelve_a_recibirla;
select count(*) = 0 as tampoco_en_el_aviso_abierto
  from crear_ofertas('a0000000-0000-0000-0000-000000000001', array['22222222-2222-2222-2222-222222222222']::uuid[], 'abierta', now() + interval '60 seconds');
select count(*) = 1 as oferta_a_diego
  from crear_ofertas('a0000000-0000-0000-0000-000000000001', array['44444444-4444-4444-4444-444444444444']::uuid[], 'secuencial', now() + interval '15 seconds');
reset role;

\echo '--- criterios 8 y 10: aceptación ---'
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select count(*) = 1 as diego_acepta from aceptar_viaje('a0000000-0000-0000-0000-000000000001');
reset role;
select v.estado = 'aceptado' and v.conductor_id = '44444444-4444-4444-4444-444444444444' and v.aceptado_en is not null
       and t.estado = 'ocupado'
       and (select count(*) from thread_members m join threads h on h.id = m.thread_id where h.viaje_id = v.id) = 2
       and (select resultado from ofertas_viaje where viaje_id = v.id and conductor_id = '44444444-4444-4444-4444-444444444444') = 'aceptada'
       as aceptacion_completa_en_un_paso
  from viajes v join tricimotos t on t.conductor_id = v.conductor_id
 where v.id = 'a0000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('a0000000-0000-0000-0000-000000000001')$q$, 'viaje_no_disponible', 'aceptar un viaje ya tomado');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select (select nombre from perfiles where id = '44444444-4444-4444-4444-444444444444') = 'Diego' as pasajero_ve_a_su_conductor;
reset role;

\echo '--- criterio 3: con viaje activo no es candidato; al terminar, se libera ---'
set role service_role;
select not exists (select 1 from candidatos_despacho('a0000000-0000-0000-0000-000000000002') where conductor_id = '44444444-4444-4444-4444-444444444444') as ocupado_no_es_candidato;
reset role;
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
update viajes set estado = 'en_curso' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.debe_fallar($q$update viajes set estado = 'solicitado' where id = 'a0000000-0000-0000-0000-000000000001'$q$, 'volver a solicitado');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
update viajes set estado = 'finalizado' where id = 'a0000000-0000-0000-0000-000000000001';
reset role;
select t.estado = 'disponible' and v.finalizado_en is not null as al_finalizar_vuelve_a_disponible
  from tricimotos t, viajes v
 where t.conductor_id = '44444444-4444-4444-4444-444444444444' and v.id = 'a0000000-0000-0000-0000-000000000001';

\echo '--- criterio 8: aviso abierto, gana el primero ---'
set role service_role;
select count(*) = 1 as aviso_abierto_a_diego   -- y a Carla, que ya no tiene ofertas abiertas
  from crear_ofertas('a0000000-0000-0000-0000-000000000002', array['44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222']::uuid[], 'abierta', now() + interval '60 seconds')
 where conductor_id = '44444444-4444-4444-4444-444444444444';
select count(*) = 2 as dos_ofertas_abiertas from ofertas_viaje where viaje_id = 'a0000000-0000-0000-0000-000000000002' and resultado = 'pendiente';
reset role;
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 1 as carla_gana from aceptar_viaje('a0000000-0000-0000-0000-000000000002');
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('a0000000-0000-0000-0000-000000000002')$q$, 'viaje_no_disponible', 'el segundo del aviso abierto');
reset role;
select resultado = 'tomada' as oferta_del_perdedor_queda_tomada from ofertas_viaje
 where viaje_id = 'a0000000-0000-0000-0000-000000000002' and conductor_id = '44444444-4444-4444-4444-444444444444';

\echo '--- criterio 17: ofertas sin coordenadas y solo para su conductor ---'
select not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'ofertas_viaje' and udt_name in ('geography', 'geometry')) as ofertas_sin_coordenadas;
select count(*) = 3 and bool_and(distancia_m is not null) as ofertas_con_distancia from ofertas_viaje where viaje_id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002') and conductor_id <> '77777777-7777-7777-7777-777777777777' and resultado <> 'tomada';
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select bool_and(conductor_id = '22222222-2222-2222-2222-222222222222') as conductor_ve_solo_sus_ofertas from ofertas_viaje;
select pg_temp.debe_fallar($q$update ofertas_viaje set resultado = 'aceptada' where conductor_id = '22222222-2222-2222-2222-222222222222'$q$, 'conductor edita su oferta');
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select not exists (select 1 from ofertas_viaje) as pasajero_no_ve_ofertas;
reset role;

\echo '--- criterio 12: cancelar mientras busca ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into viajes (id, pasajero_id, origen, destino) values ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
reset role;
set role service_role;
select count(*) = 1 as oferta_para_cancelar
  from crear_ofertas('a0000000-0000-0000-0000-000000000003', array['44444444-4444-4444-4444-444444444444']::uuid[], 'secuencial', now() + interval '15 seconds');
reset role;
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
update viajes set estado = 'cancelado' where id = 'a0000000-0000-0000-0000-000000000003';
reset role;
select resultado = 'cancelada' as cancelar_cierra_la_oferta from ofertas_viaje where viaje_id = 'a0000000-0000-0000-0000-000000000003';

\echo '--- conductor que deja de estar disponible ---'
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into viajes (id, pasajero_id, origen, destino) values ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
reset role;
set role service_role;
select count(*) = 1 as oferta_antes_de_desconectarse
  from crear_ofertas('a0000000-0000-0000-0000-000000000004', array['44444444-4444-4444-4444-444444444444']::uuid[], 'secuencial', now() + interval '15 seconds');
reset role;
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
update tricimotos set estado = 'inactivo' where conductor_id = '44444444-4444-4444-4444-444444444444';
reset role;
select o.resultado = 'rechazada' and t.disponible_desde is null as no_disponible_suelta_la_oferta
  from ofertas_viaje o, tricimotos t
 where o.viaje_id = 'a0000000-0000-0000-0000-000000000004' and t.conductor_id = o.conductor_id;

\echo '--- criterios 11 y 14: vencimientos y cierre sin conductor ---'
-- Diego ya recibió este viaje y no lo vuelve a recibir (criterio 6). Carla termina el viaje 2 y lo recibe ella.
update tricimotos set estado = 'disponible' where conductor_id = '44444444-4444-4444-4444-444444444444';
set role service_role;
select count(*) = 0 as diego_no_recibe_dos_veces_el_mismo_viaje
  from crear_ofertas('a0000000-0000-0000-0000-000000000004', array['44444444-4444-4444-4444-444444444444']::uuid[], 'secuencial', now() + interval '15 seconds');
reset role;
update viajes set estado = 'en_curso' where id = 'a0000000-0000-0000-0000-000000000002';
update viajes set estado = 'finalizado' where id = 'a0000000-0000-0000-0000-000000000002';
set role service_role;
select count(*) = 1 as nueva_oferta_a_carla
  from crear_ofertas('a0000000-0000-0000-0000-000000000004', array['22222222-2222-2222-2222-222222222222']::uuid[], 'secuencial', now() + interval '15 seconds');
reset role;
-- Simula que pasó el tiempo: la oferta venció y la solicitud tiene más de 2 minutos.
update ofertas_viaje set enviada_en = now() - interval '3 minutes', vence_en = now() - interval '1 minute'
 where viaje_id = 'a0000000-0000-0000-0000-000000000004' and resultado = 'pendiente';
update viajes set creado_en = now() - interval '3 minutes' where id = 'a0000000-0000-0000-0000-000000000004';
set role service_role;
create temp table cierre as select * from cerrar_vencidos(120);
select exists (select 1 from cierre where tipo = 'oferta_vencida' and usuario_id = '22222222-2222-2222-2222-222222222222')
   and exists (select 1 from cierre where tipo = 'viaje_sin_conductor' and usuario_id = '11111111-1111-1111-1111-111111111111')
   as cerrar_vencidos_avisa;
reset role;
select v.estado = 'sin_conductor' and v.finalizado_en is not null as solicitud_vieja_queda_sin_conductor
  from viajes v where v.id = 'a0000000-0000-0000-0000-000000000004';
select not exists (select 1 from ofertas_viaje where resultado = 'pendiente' and vence_en <= now()) as ninguna_oferta_vencida_pendiente;

set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
insert into viajes (id, pasajero_id, origen, destino) values ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
reset role;
set role service_role;
select count(*) = 1 as sin_candidatos_se_cierra_ya
  from cerrar_sin_conductor('a0000000-0000-0000-0000-000000000005') where tipo = 'viaje_sin_conductor';
reset role;
select estado = 'sin_conductor' as viaje_cerrado_sin_conductor from viajes where id = 'a0000000-0000-0000-0000-000000000005';

set role anon;
select pg_temp.como('');
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('a0000000-0000-0000-0000-000000000002')$q$, 'permission denied', 'visitante acepta');
reset role;

\echo 'RLS 003: TODAS LAS PRUEBAS TERMINARON'

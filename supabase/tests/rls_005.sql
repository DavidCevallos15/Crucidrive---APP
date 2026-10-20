-- Ejecutar con run-docker.sh después de todas las migraciones. Sin datos reales.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');
insert into consentimientos(user_id,version) select id,'0.3' from auth.users;
insert into perfiles(id,rol,nombre,telefono) values
  ('11111111-1111-1111-1111-111111111111','pasajero','Ana','0991111111'),
  ('22222222-2222-2222-2222-222222222222','conductor','Carla','0992222222'),
  ('33333333-3333-3333-3333-333333333333','pasajero','Otro','0993333333');

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select set_config('test.parcel', id::text, false) from solicitar_encomienda(
  '{"origen":"POINT(-80.54 -0.87)","destino":"POINT(-80.53 -0.86)"}'::jsonb,
  'Caja de documentos','Persona receptora',true);
select tarifa is null and pasajeros = 1 and tipo_servicio = 'encomienda' as precio_a_convenir
  from viajes where id = current_setting('test.parcel')::uuid;
select count(*) = 1 as solicitante_ve_sus_datos from encomiendas where viaje_id = current_setting('test.parcel')::uuid;

-- Dar una oferta al conductor sin asignar todavía el servicio.
reset role;
insert into ofertas_viaje(viaje_id,conductor_id,fase,vence_en)
  values(current_setting('test.parcel')::uuid,'22222222-2222-2222-2222-222222222222','secuencial',now()+interval '2 minutes');
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) = 1 as conductor_con_oferta_ve_tipo from viajes where id = current_setting('test.parcel')::uuid;
select count(*) = 0 as oferta_no_revela_destinatario from encomiendas where viaje_id = current_setting('test.parcel')::uuid;

reset role;
update viajes set conductor_id = '22222222-2222-2222-2222-222222222222', estado = 'aceptado', aceptado_en = now()
  where id = current_setting('test.parcel')::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select count(*) = 1 as asignado_puede_leer_datos from encomiendas where viaje_id = current_setting('test.parcel')::uuid;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
select count(*) = 0 as otra_cuenta_no_ve_datos from encomiendas where viaje_id = current_setting('test.parcel')::uuid;
reset role;
select not has_function_privilege('authenticated','public.eliminar_cuenta_crucidrive(uuid)','execute') as cliente_no_puede_eliminar_otros;
select not has_function_privilege('anon','public.eliminar_cuenta_crucidrive(uuid)','execute') as anon_no_puede_eliminar;
set role service_role;
select public.eliminar_cuenta_crucidrive('33333333-3333-3333-3333-333333333333');
reset role;
select count(*) = 0 as eliminada_solo_cuenta_elegida from auth.users where id = '33333333-3333-3333-3333-333333333333';
select count(*) = 1 as solicitante_intacto from auth.users where id = '11111111-1111-1111-1111-111111111111';
\echo 'RLS 005: TODAS LAS PRUEBAS TERMINARON'

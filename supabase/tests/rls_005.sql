-- Ejecutar con run-docker.sh después de todas las migraciones. Sin datos reales.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');
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
-- Atajos por REST que la RPC no cubre (otra cuenta, sin servicio activo).
-- La comprobación de datos completos es diferida: se adelanta para verla dentro de la prueba.
begin;
set constraints viajes_encomienda_completa immediate;
select pg_temp.debe_fallar($q$insert into viajes(pasajero_id,origen,destino,pasajeros,tipo_servicio)
  values ('33333333-3333-3333-3333-333333333333','POINT(-80.54 -0.87)','POINT(-80.53 -0.86)',1,'encomienda')$q$,
  'encomienda sin contenido ni destinatario');
commit;
select pg_temp.debe_fallar($q$select * from solicitar_encomienda('{"origen":"POINT(-80.54 -0.87)","destino":"POINT(-80.53 -0.86)"}'::jsonb,
  'Caja','Ana',false)$q$, 'encomienda sin autorización para compartir datos');
select pg_temp.debe_fallar($q$insert into viajes(pasajero_id,origen,destino,pasajeros,tipo_servicio)
  values ('33333333-3333-3333-3333-333333333333','POINT(-80.54 -0.87)','POINT(-80.53 -0.86)',3,'encomienda')$q$,
  'encomienda cobrada por personas');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select pg_temp.debe_fallar($q$update viajes set tipo_servicio = 'viaje' where id = current_setting('test.parcel')::uuid$q$,
  'pasajero cambia el tipo de servicio');
reset role;
select not has_function_privilege('authenticated','public.eliminar_cuenta_crucidrive(uuid)','execute') as cliente_no_puede_eliminar_otros;
select not has_function_privilege('anon','public.eliminar_cuenta_crucidrive(uuid)','execute') as anon_no_puede_eliminar;
set role service_role;
select public.eliminar_cuenta_crucidrive('33333333-3333-3333-3333-333333333333');
reset role;
select count(*) = 0 as eliminada_solo_cuenta_elegida from auth.users where id = '33333333-3333-3333-3333-333333333333';
select count(*) = 1 as solicitante_intacto from auth.users where id = '11111111-1111-1111-1111-111111111111';
-- Cuentas con historial: con un servicio activo no se borran; terminado, se borran y el
-- viaje queda sin el titular (on delete set null) y sin los datos privados de la encomienda.
set role service_role;
select pg_temp.debe_fallar($q$select public.eliminar_cuenta_crucidrive('22222222-2222-2222-2222-222222222222')$q$,
  'eliminar al conductor con un servicio activo');
reset role;
update viajes set estado = 'en_curso' where id = current_setting('test.parcel')::uuid;
update viajes set estado = 'finalizado', finalizado_en = now() where id = current_setting('test.parcel')::uuid;
set role service_role;
select public.eliminar_cuenta_crucidrive('11111111-1111-1111-1111-111111111111');
select public.eliminar_cuenta_crucidrive('22222222-2222-2222-2222-222222222222');
reset role;
select count(*) = 0 as cuentas_con_historial_eliminadas from auth.users;
select pasajero_id is null and conductor_id is null and estado = 'finalizado' as historial_sin_titulares
  from viajes where id = current_setting('test.parcel')::uuid;
select count(*) = 0 as datos_de_encomienda_eliminados from encomiendas;
\echo 'RLS 005: TODAS LAS PRUEBAS TERMINARON'

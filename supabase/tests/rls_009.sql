-- Pruebas de BD del 020 (0020): créditos del conductor, libro inmutable, comisión, devolución,
-- saldo mínimo, bono por cédula, recargas del administrador y resumen.
-- Debe terminar con 'RLS 009: TODAS LAS PRUEBAS TERMINARON' y todas las filas en t.
\set ON_ERROR_STOP 1
\set QUIET 1
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),  -- pasajera Ana
  ('22222222-2222-2222-2222-222222222222'),  -- conductora Carla
  ('33333333-3333-3333-3333-333333333333'),  -- pasajero tercero
  ('44444444-4444-4444-4444-444444444444'),  -- conductor Diego
  ('55555555-5555-5555-5555-555555555555'),  -- administrador
  ('77777777-7777-7777-7777-777777777777'),  -- conductora Eva (borra su cuenta)
  ('88888888-8888-8888-8888-888888888888');  -- cuenta nueva con la cédula de Eva

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
create or replace function pg_temp.filas(q text) returns bigint language plpgsql as $$
declare n bigint;
begin execute q; get diagnostics n = row_count; return n; end $$;
create or replace function pg_temp.saldo(uid text) returns numeric language sql as $$
  select coalesce((select saldo from public.saldos_credito where conductor_id = uid::uuid), 0) $$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

insert into consentimientos (user_id, version) select id, 'prueba' from auth.users;
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Ana', '0991111111'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('33333333-3333-3333-3333-333333333333', 'pasajero', 'Otro', '0993333333'),
  ('44444444-4444-4444-4444-444444444444', 'conductor', 'Diego', '0994444444'),
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555'),
  ('77777777-7777-7777-7777-777777777777', 'conductor', 'Eva', '0997777777'),
  ('88888888-8888-8888-8888-888888888888', 'conductor', 'Nueva', '0998888888');
insert into tricimotos (conductor_id, placa, estado) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'disponible'),
  ('44444444-4444-4444-4444-444444444444', 'DEF-456', 'disponible');

\echo '--- criterio 1: bono de bienvenida al aprobar, una vez por cédula ---'
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado)
select id, c, id || '/conductor.jpg', id || '/cedula.jpg', id || '/vehiculo.jpg', 'pendiente'
from (values ('22222222-2222-2222-2222-222222222222'::uuid, '1700000022'),
             ('44444444-4444-4444-4444-444444444444'::uuid, '1700000044'),
             ('77777777-7777-7777-7777-777777777777'::uuid, '1700000077')) as t(id, c);
select pg_temp.saldo('22222222-2222-2222-2222-222222222222') = 0 as pendiente_sin_bono;
update conductores_verificacion set estado = 'aprobado';
select pg_temp.saldo('22222222-2222-2222-2222-222222222222') = 2.00 as aprobada_recibe_bono;
select (select count(*) from movimientos_credito where tipo = 'bono') = 3 as un_bono_por_conductor;
update conductores_verificacion set estado = 'rechazado', motivo_rechazo = 'Foto borrosa'
 where conductor_id = '22222222-2222-2222-2222-222222222222';
update conductores_verificacion set estado = 'aprobado'
 where conductor_id = '22222222-2222-2222-2222-222222222222';
select pg_temp.saldo('22222222-2222-2222-2222-222222222222') = 2.00 as reaprobar_no_da_otro_bono;

-- Eva borra su cuenta y otra cuenta se registra con la misma cédula.
delete from perfiles where id = '77777777-7777-7777-7777-777777777777';
select (select count(*) from movimientos_credito where tipo = 'bono' and conductor_id is null) = 1
   as libro_conserva_monto_sin_identidad;
select not exists (select 1 from saldos_credito where conductor_id = '77777777-7777-7777-7777-777777777777')
   as saldo_borrado_con_la_cuenta;
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado)
values ('88888888-8888-8888-8888-888888888888', '1700000077', '88888888-8888-8888-8888-888888888888/conductor.jpg',
        '88888888-8888-8888-8888-888888888888/cedula.jpg', '88888888-8888-8888-8888-888888888888/vehiculo.jpg', 'aprobado');
select pg_temp.saldo('88888888-8888-8888-8888-888888888888') = 0 as misma_cedula_sin_segundo_bono;

\echo '--- criterio 8: solo lectura de lo propio; nadie escribe el libro directamente ---'
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select (select count(*) from movimientos_credito) = 1
   and (select count(*) from saldos_credito) = 1 as conductora_solo_ve_lo_suyo;
select pg_temp.como('33333333-3333-3333-3333-333333333333');
select (select count(*) from movimientos_credito) = 0
   and (select count(*) from saldos_credito) = 0 as pasajero_no_ve_creditos;
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select (select count(*) from movimientos_credito) = 3 as admin_ve_todo_el_libro;  -- incluye el bono anónimo de Eva
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select pg_temp.debe_fallar_con($q$insert into movimientos_credito (conductor_id, tipo, monto, canal, comprobante)
  values ('22222222-2222-2222-2222-222222222222', 'recarga', 50, 'deuna', 'FALSO-1')$q$,
  'permission denied', 'conductora no inserta en el libro');
select pg_temp.debe_fallar_con($q$update saldos_credito set saldo = 99$q$, 'permission denied', 'conductora no edita su saldo');
select pg_temp.debe_fallar_con($q$update movimientos_credito set monto = 99$q$, 'permission denied', 'conductora no edita movimientos');
select pg_temp.debe_fallar_con($q$delete from movimientos_credito$q$, 'permission denied', 'conductora no borra movimientos');
select pg_temp.debe_fallar_con($q$select private.registrar_movimiento('22222222-2222-2222-2222-222222222222', 'ajuste', 50, p_motivo => 'trampa')$q$,
  'permission denied', 'conductora no llama a registrar_movimiento');
select pg_temp.filas($q$update parametros_cobro set cobro_activo = false, comision_viaje = 0$q$) = 0 as conductora_no_cambia_parametros;
select pg_temp.debe_fallar_con($q$select acreditar_credito('22222222-2222-2222-2222-222222222222', 'ajuste', 10, p_motivo => 'trampa')$q$,
  'solo_admin', 'conductora no se acredita créditos');
select pg_temp.debe_fallar_con($q$select * from resumen_creditos('2026-01-01', '2026-12-31')$q$, 'solo_admin', 'conductora no ve el resumen');
select count(*) = 1 as conductora_ve_las_reglas from parametros_cobro;
reset role;
set role service_role;
select pg_temp.debe_fallar_con($q$insert into movimientos_credito (conductor_id, tipo, monto, motivo)
  values ('22222222-2222-2222-2222-222222222222', 'ajuste', 50, 'clave de servicio')$q$,
  'permission denied', 'clave de servicio no inserta en el libro');
reset role;
select pg_temp.debe_fallar_con($q$update movimientos_credito set monto = 99$q$, 'libro_inmutable', 'ni el dueño de la BD edita el libro');
select pg_temp.debe_fallar_con($q$delete from movimientos_credito$q$, 'libro_inmutable', 'ni el dueño de la BD borra el libro');

\echo '--- criterio 9: con el cobro apagado no se descuenta nada ---'
insert into viajes (id, pasajero_id, origen, destino) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
insert into ofertas_viaje (viaje_id, conductor_id, fase, vence_en) values
  ('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'abierta', now() + interval '60 seconds');
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 1 as acepta_con_cobro_apagado from aceptar_viaje('b0000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.saldo('22222222-2222-2222-2222-222222222222') = 2.00
   and not exists (select 1 from movimientos_credito where tipo = 'comision') as sin_comision_con_cobro_apagado;
update viajes set estado = 'en_curso' where id = 'b0000000-0000-0000-0000-000000000001';
update viajes set estado = 'finalizado', finalizado_por = 'conductor' where id = 'b0000000-0000-0000-0000-000000000001';

\echo '--- el administrador activa el cobro ---'
set role authenticated;
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select pg_temp.filas($q$update parametros_cobro set cobro_activo = true$q$) = 1 as admin_activa_cobro;
reset role;

\echo '--- criterios 3 y 4: comisión al aceptar y devolución si cancela el pasajero ---'
insert into viajes (id, pasajero_id, origen, destino) values
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
insert into ofertas_viaje (viaje_id, conductor_id, fase, vence_en) values
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'abierta', now() + interval '60 seconds');
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 1 as acepta_viaje_con_cobro from aceptar_viaje('b0000000-0000-0000-0000-000000000002');
select saldo = 1.90 as descuenta_010_por_viaje from saldos_credito;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
select cancelar_viaje('b0000000-0000-0000-0000-000000000002', 'ya_no_lo_necesito');
reset role;
select pg_temp.saldo('22222222-2222-2222-2222-222222222222') = 2.00 as devuelve_si_cancela_pasajero;
select (select count(*) from movimientos_credito where tipo = 'reintegro' and viaje_id = 'b0000000-0000-0000-0000-000000000002') = 1
   as una_sola_devolucion;
select pg_temp.debe_fallar_con($q$insert into movimientos_credito (conductor_id, tipo, monto, viaje_id)
  values ('22222222-2222-2222-2222-222222222222', 'reintegro', 0.10, 'b0000000-0000-0000-0000-000000000002')$q$,
  'uq_reintegro_por_viaje', 'segunda devolución del mismo viaje');
select estado = 'disponible' as vuelve_disponible_con_saldo from tricimotos where conductor_id = '22222222-2222-2222-2222-222222222222';

\echo '--- criterios 3 y 5: encomienda 0,20 y sin devolución si cancela el conductor ---'
with v as (
  insert into viajes (id, pasajero_id, origen, destino, tipo_servicio) values
    ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
     extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'), 'encomienda')
  returning id)
insert into encomiendas select id, 'Caja de documentos', 'Persona receptora', true from v;
insert into ofertas_viaje (viaje_id, conductor_id, fase, vence_en) values
  ('b0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'abierta', now() + interval '60 seconds');
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
select count(*) = 1 as acepta_encomienda from aceptar_viaje('b0000000-0000-0000-0000-000000000003');
select saldo = 1.80 as descuenta_020_por_encomienda from saldos_credito;
-- La conductora no puede fingir que canceló el pasajero para cobrarse la devolución.
select pg_temp.debe_fallar_con($q$update viajes set estado = 'cancelado', cancelado_por = 'pasajero'
  where id = 'b0000000-0000-0000-0000-000000000003'$q$, 'permission denied', 'conductora no finge cancelación del pasajero');
select cancelar_viaje('b0000000-0000-0000-0000-000000000003', 'otro');
reset role;
select pg_temp.saldo('22222222-2222-2222-2222-222222222222') = 1.80
   and not exists (select 1 from movimientos_credito where tipo = 'reintegro' and viaje_id = 'b0000000-0000-0000-0000-000000000003')
   as sin_devolucion_si_cancela_conductor;

\echo '--- criterio 6: recargas y ajustes del administrador ---'
set role authenticated;
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select acreditar_credito('44444444-4444-4444-4444-444444444444', 'ajuste', -1.90, p_motivo => 'Prueba de saldo bajo') is not null as admin_ajusta;
select saldo = 0.10 as saldo_tras_ajuste from saldos_credito where conductor_id = '44444444-4444-4444-4444-444444444444';
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'ajuste', -1.00, p_motivo => 'Deja saldo negativo')$q$,
  'saldo_insuficiente', 'un ajuste no deja saldo negativo');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 5, 'deuna')$q$,
  'datos_de_recarga_invalidos', 'recarga DeUna sin comprobante');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 5, 'efectivo')$q$,
  'datos_de_recarga_invalidos', 'recarga en efectivo sin motivo');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 0.50, 'deuna', 'DU-001')$q$,
  'monto_fuera_de_rango', 'recarga menor al mínimo');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 60, 'deuna', 'DU-002')$q$,
  'monto_fuera_de_rango', 'recarga mayor al máximo');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 2.005, 'deuna', 'DU-003')$q$,
  'monto_fuera_de_rango', 'monto con más de 2 decimales');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'ajuste', 1, 'deuna', null, 'Ajuste con canal')$q$,
  'canal_solo_en_recarga', 'ajuste con canal');
select pg_temp.debe_fallar_con($q$select acreditar_credito('11111111-1111-1111-1111-111111111111', 'recarga', 5, 'deuna', 'DU-004')$q$,
  'conductor_no_existe', 'recarga a un pasajero');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'bono', 5, null, null, 'Bono manual')$q$,
  'tipo_invalido', 'el admin no crea bonos ni comisiones');
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 5, 'deuna', 'x; drop')$q$,
  'datos_de_recarga_invalidos', 'comprobante con caracteres raros');

\echo '--- criterio 2: saldo mínimo para estar disponible y para aceptar ---'
select pg_temp.como('44444444-4444-4444-4444-444444444444');
update tricimotos set estado = 'inactivo' where conductor_id = '44444444-4444-4444-4444-444444444444';
select pg_temp.debe_fallar_con($q$update tricimotos set estado = 'disponible' where conductor_id = '44444444-4444-4444-4444-444444444444'$q$,
  'saldo_insuficiente', 'conductor con 0,10 no se pone disponible');
reset role;
with v as (
  insert into viajes (id, pasajero_id, origen, destino, tipo_servicio) values
    ('b0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
     extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'), 'encomienda')
  returning id)
insert into encomiendas select id, 'Sobre', 'Receptor', true from v;
insert into ofertas_viaje (viaje_id, conductor_id, fase, vence_en) values
  ('b0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'abierta', now() + interval '60 seconds');
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.debe_fallar_con($q$select * from aceptar_viaje('b0000000-0000-0000-0000-000000000004')$q$,
  'saldo_insuficiente', 'no acepta una encomienda de 0,20 con 0,10');
reset role;
select (select estado from viajes where id = 'b0000000-0000-0000-0000-000000000004') = 'solicitado'
   and (select resultado from ofertas_viaje where viaje_id = 'b0000000-0000-0000-0000-000000000004') = 'pendiente'
   and not exists (select 1 from threads where viaje_id = 'b0000000-0000-0000-0000-000000000004')
   and pg_temp.saldo('44444444-4444-4444-4444-444444444444') = 0.10 as aceptacion_revertida_completa;
update ofertas_viaje set resultado = 'vencida', respondida_en = now() where viaje_id = 'b0000000-0000-0000-0000-000000000004';
insert into viajes (id, pasajero_id, origen, destino) values
  ('b0000000-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333',
   extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
insert into ofertas_viaje (viaje_id, conductor_id, fase, vence_en) values
  ('b0000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'abierta', now() + interval '60 seconds');
set role authenticated;
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select count(*) = 1 as acepta_viaje_con_saldo_justo from aceptar_viaje('b0000000-0000-0000-0000-000000000005');
reset role;
update viajes set estado = 'en_curso' where id = 'b0000000-0000-0000-0000-000000000005';
update viajes set estado = 'finalizado', finalizado_por = 'conductor' where id = 'b0000000-0000-0000-0000-000000000005';
select pg_temp.saldo('44444444-4444-4444-4444-444444444444') = 0
   and (select estado from tricimotos where conductor_id = '44444444-4444-4444-4444-444444444444') = 'inactivo'
   as sin_saldo_queda_inactivo_al_terminar;

\echo '--- criterio 6: recarga con comprobante único por canal ---'
set role authenticated;
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 5, 'deuna', 'DU-123') is not null as recarga_deuna;
select pg_temp.debe_fallar_con($q$select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 5, 'deuna', 'du-123')$q$,
  'comprobante_repetido', 'mismo comprobante DeUna dos veces');
select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 3, 'transferencia', 'DU-123') is not null
   as mismo_numero_en_otro_canal;
select acreditar_credito('44444444-4444-4444-4444-444444444444', 'recarga', 2, 'efectivo', null, 'Pagó en persona') is not null
   as recarga_en_efectivo_con_motivo;
select saldo = 10.00 as saldo_tras_recargas from saldos_credito where conductor_id = '44444444-4444-4444-4444-444444444444';
select bool_and(registrado_por = '55555555-5555-5555-5555-555555555555') as recarga_guarda_quien_la_hizo
  from movimientos_credito where tipo in ('recarga', 'ajuste');
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select pg_temp.filas($q$update tricimotos set estado = 'disponible' where conductor_id = '44444444-4444-4444-4444-444444444444'$q$) = 1
   as con_saldo_se_pone_disponible;

\echo '--- criterio 10: resumen mensual del administrador ---'
select pg_temp.como('55555555-5555-5555-5555-555555555555');
select (select sum(total) from resumen_creditos('2000-01-01', '2100-12-31'))
     = (select sum(monto) from movimientos_credito) as resumen_cuadra_con_el_libro;
select (select total from resumen_creditos('2000-01-01', '2100-12-31') where tipo = 'recarga' and canal = 'deuna') = 5
   as resumen_separa_por_canal;
reset role;
select (select sum(saldo) from saldos_credito)
     = (select sum(monto) from movimientos_credito where conductor_id is not null) as saldos_cuadran_con_el_libro;

\echo 'RLS 009: TODAS LAS PRUEBAS TERMINARON'

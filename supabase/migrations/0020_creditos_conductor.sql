-- 020 · Créditos prepagos del conductor (D-22): libro contable inmutable, saldo que nunca
-- queda negativo, comisión al aceptar, devolución si cancela el pasajero, bono por cédula
-- y recargas manuales acreditadas por el administrador. El cobro empieza apagado.

-- 1. PARÁMETROS (una sola fila; los cambia el administrador) -------------------------
create table public.parametros_cobro (
  id                   boolean primary key default true check (id),
  cobro_activo         boolean not null default false,
  comision_viaje       numeric(5,2) not null default 0.10 check (comision_viaje >= 0),
  comision_encomienda  numeric(5,2) not null default 0.20 check (comision_encomienda >= 0),
  bono_bienvenida      numeric(5,2) not null default 2.00 check (bono_bienvenida >= 0),
  recarga_min          numeric(5,2) not null default 1.00 check (recarga_min > 0),
  recarga_max          numeric(5,2) not null default 50.00,
  actualizado_en       timestamptz not null default now(),
  constraint recarga_rango check (recarga_max >= recarga_min)
);
insert into public.parametros_cobro default values;

create or replace function private.tocar_parametros_cobro()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger parametros_cobro_tocar
  before update on public.parametros_cobro
  for each row execute function private.tocar_parametros_cobro();

alter table public.parametros_cobro enable row level security;
create policy parametros_cobro_select on public.parametros_cobro for select to authenticated
  using (true);
create policy parametros_cobro_update_admin on public.parametros_cobro for update to authenticated
  using (private.rol_actual() = 'admin') with check (private.rol_actual() = 'admin');
revoke all on public.parametros_cobro from anon, authenticated, service_role;
grant select on public.parametros_cobro to authenticated, service_role;
grant update (cobro_activo, comision_viaje, comision_encomienda, bono_bienvenida, recarga_min, recarga_max)
  on public.parametros_cobro to authenticated;

-- 2. LIBRO CONTABLE ----------------------------------------------------------------
-- Positivo suma, negativo resta. conductor_id, viaje_id y registrado_por quedan en NULL
-- si se borra la cuenta o el viaje: los montos se conservan para que el resumen mensual
-- no cambie hacia atrás, sin la identidad de la persona.
create table public.movimientos_credito (
  id              uuid primary key default gen_random_uuid(),
  conductor_id    uuid references public.perfiles(id) on delete set null,
  tipo            text not null check (tipo in ('bono', 'recarga', 'comision', 'reintegro', 'ajuste')),
  monto           numeric(7,2) not null check (monto <> 0),
  viaje_id        uuid references public.viajes(id) on delete set null,
  canal           text check (canal in ('deuna', 'transferencia', 'deposito', 'efectivo', 'cortesia')),
  comprobante     text check (comprobante ~ '^[A-Za-z0-9-]{3,40}$'),
  motivo          text check (char_length(motivo) between 3 and 200),
  registrado_por  uuid references public.perfiles(id) on delete set null,
  creado_en       timestamptz not null default now(),
  constraint signo_por_tipo check (
    (tipo in ('bono', 'recarga', 'reintegro') and monto > 0)
    or (tipo = 'comision' and monto < 0)
    or tipo = 'ajuste'),
  constraint canal_solo_en_recarga check ((tipo = 'recarga') = (canal is not null)),
  constraint recarga_con_respaldo check (
    tipo <> 'recarga'
    or (canal in ('deuna', 'transferencia', 'deposito') and comprobante is not null)
    or (canal in ('efectivo', 'cortesia') and motivo is not null)),
  constraint ajuste_con_motivo check (tipo <> 'ajuste' or motivo is not null)
);
create index idx_movimientos_conductor on public.movimientos_credito (conductor_id, creado_en desc);
create index idx_movimientos_registrado_por on public.movimientos_credito (registrado_por);
create index idx_movimientos_fecha on public.movimientos_credito (creado_en);
-- Idempotencia: una comisión y una devolución por servicio, un bono por conductor y
-- el mismo comprobante de un canal no se acredita dos veces.
create unique index uq_comision_por_viaje on public.movimientos_credito (viaje_id) where tipo = 'comision';
create unique index uq_reintegro_por_viaje on public.movimientos_credito (viaje_id) where tipo = 'reintegro';
create unique index uq_bono_por_conductor on public.movimientos_credito (conductor_id) where tipo = 'bono';
create unique index uq_comprobante_por_canal on public.movimientos_credito (canal, upper(comprobante))
  where tipo = 'recarga' and comprobante is not null;

-- El libro no se edita ni se borra (tampoco con la clave de servicio): se corrige con un
-- ajuste. Única excepción: el ON DELETE SET NULL de una cuenta o viaje borrado, que
-- llega desde el trigger de la llave foránea (pg_trigger_depth() > 1) y solo vacía esas columnas.
create or replace function private.proteger_movimientos()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and (new.conductor_id is null or new.conductor_id = old.conductor_id)
     and (new.viaje_id is null or new.viaje_id = old.viaje_id)
     and (new.registrado_por is null or new.registrado_por = old.registrado_por)
     and (new.id, new.tipo, new.monto, new.canal, new.comprobante, new.motivo, new.creado_en)
         is not distinct from (old.id, old.tipo, old.monto, old.canal, old.comprobante, old.motivo, old.creado_en) then
    return new;
  end if;
  raise exception 'libro_inmutable' using errcode = 'insufficient_privilege';
end;
$$;
create trigger movimientos_inmutables
  before update or delete on public.movimientos_credito
  for each row execute function private.proteger_movimientos();
create trigger movimientos_sin_truncate
  before truncate on public.movimientos_credito
  for each statement execute function private.proteger_movimientos();

-- 3. SALDO (lo mantiene el trigger del libro; el check impide el saldo negativo) -------
create table public.saldos_credito (
  conductor_id    uuid primary key references public.perfiles(id) on delete cascade,
  saldo           numeric(7,2) not null default 0,
  actualizado_en  timestamptz not null default now(),
  constraint saldo_no_negativo check (saldo >= 0)
);

-- El UPDATE bloquea la fila del conductor: dos descuentos simultáneos se hacen en fila
-- y el segundo ve el saldo que dejó el primero. Primero UPDATE y luego INSERT, porque
-- INSERT ... ON CONFLICT evalúa el check sobre la fila propuesta (el monto negativo)
-- antes de detectar el conflicto y rechazaría cualquier descuento.
create or replace function private.aplicar_movimiento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.saldos_credito
     set saldo = saldo + new.monto, actualizado_en = now()
   where conductor_id = new.conductor_id;
  if not found then
    insert into public.saldos_credito as s (conductor_id, saldo, actualizado_en)
    values (new.conductor_id, new.monto, now())
    on conflict (conductor_id) do update
      set saldo = s.saldo + excluded.saldo, actualizado_en = now();
  end if;
  return null;
end;
$$;
create trigger movimientos_aplicar_saldo
  after insert on public.movimientos_credito
  for each row execute function private.aplicar_movimiento();

alter table public.movimientos_credito enable row level security;
alter table public.saldos_credito enable row level security;
create policy movimientos_select_propio_o_admin on public.movimientos_credito for select to authenticated
  using (conductor_id = (select auth.uid()) or private.rol_actual() = 'admin');
create policy saldos_select_propio_o_admin on public.saldos_credito for select to authenticated
  using (conductor_id = (select auth.uid()) or private.rol_actual() = 'admin');
-- Solo lectura desde la API; escriben únicamente las funciones de este archivo.
revoke all on public.movimientos_credito from anon, authenticated, service_role;
revoke all on public.saldos_credito from anon, authenticated, service_role;
grant select on public.movimientos_credito to authenticated, service_role;
grant select on public.saldos_credito to authenticated, service_role;

-- 4. BONO POR CÉDULA (sobrevive a la eliminación de la cuenta, sin la cédula en claro) --
create table private.bonos_por_cedula (
  cedula_hash  text primary key,
  otorgado_en  timestamptz not null default now()
);
alter table private.bonos_por_cedula enable row level security;
revoke all on private.bonos_por_cedula from public, anon, authenticated, service_role;

-- 5. FUNCIONES DEL LIBRO -----------------------------------------------------------
create or replace function private.registrar_movimiento(
  p_conductor uuid, p_tipo text, p_monto numeric, p_viaje uuid default null,
  p_canal text default null, p_comprobante text default null, p_motivo text default null,
  p_registrado_por uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_conductor is null then
    raise exception 'conductor_requerido' using errcode = 'P0001';
  end if;
  if p_tipo in ('comision', 'reintegro') and p_viaje is null then
    raise exception 'viaje_requerido' using errcode = 'P0001';
  end if;
  insert into public.movimientos_credito
    (conductor_id, tipo, monto, viaje_id, canal, comprobante, motivo, registrado_por)
  values (p_conductor, p_tipo, p_monto, p_viaje, p_canal, p_comprobante, p_motivo, p_registrado_por)
  returning id into v_id;
  return v_id;
exception when check_violation then
  if sqlerrm like '%saldo_no_negativo%' then
    raise exception 'saldo_insuficiente' using errcode = 'P0001';
  end if;
  raise;
end;
$$;

create or replace function private.cobro_activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select cobro_activo from public.parametros_cobro), false);
$$;

create or replace function private.saldo_minimo()
returns numeric language sql stable security definer set search_path = '' as $$
  select greatest(comision_viaje, comision_encomienda) from public.parametros_cobro;
$$;

create or replace function private.saldo_de(p_conductor uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select saldo from public.saldos_credito where conductor_id = p_conductor), 0);
$$;

-- Solo las funciones definidas aquí escriben en el libro.
revoke all on function private.registrar_movimiento(uuid, text, numeric, uuid, text, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.aplicar_movimiento() from public, anon, authenticated, service_role;
revoke all on function private.saldo_de(uuid) from public, anon, authenticated, service_role;

-- 6. BONO DE BIENVENIDA (criterio 1) ------------------------------------------------
create or replace function private.otorgar_bono(p_conductor uuid, p_cedula text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_bono numeric := (select bono_bienvenida from public.parametros_cobro);
  v_hash text := encode(sha256(convert_to('crucidrive-bono:' || p_cedula, 'UTF8')), 'hex');
begin
  if coalesce(v_bono, 0) <= 0 then return; end if;
  insert into private.bonos_por_cedula (cedula_hash) values (v_hash) on conflict do nothing;
  if not found then return; end if;  -- esa cédula ya recibió su bono
  if exists (select 1 from public.movimientos_credito where conductor_id = p_conductor and tipo = 'bono') then
    return;
  end if;
  perform private.registrar_movimiento(p_conductor, 'bono', v_bono, p_motivo => 'Bono de bienvenida');
end;
$$;
revoke all on function private.otorgar_bono(uuid, text) from public, anon, authenticated, service_role;

create or replace function private.al_aprobar_conductor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'aprobado' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobado') then
    perform private.otorgar_bono(new.conductor_id, new.cedula);
  end if;
  return null;
end;
$$;
create trigger verificacion_bono_bienvenida
  after insert or update of estado on public.conductores_verificacion
  for each row execute function private.al_aprobar_conductor();

-- Conductores ya aprobados: reciben el bono ahora para no quedar bloqueados al activar el cobro.
do $$
declare r record;
begin
  for r in select cv.conductor_id, cv.cedula from public.conductores_verificacion cv
            where cv.estado = 'aprobado' order by cv.creado_en loop
    perform private.otorgar_bono(r.conductor_id, r.cedula);
  end loop;
end $$;

-- 7. COMISIÓN AL ACEPTAR (criterios 3 y 9) -------------------------------------------
-- Igual que en el 0016, más el descuento dentro de la misma transacción: si el saldo no
-- alcanza, se revierte toda la aceptación.
create or replace function private.aceptar_viaje(p_viaje uuid)
returns table (viaje_id uuid, thread_id uuid)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_viaje public.viajes%rowtype;
  v_thread uuid;
  v_comision numeric;
begin
  if not private.es_conductor_aprobado() then
    raise exception 'conductor_no_aprobado' using errcode = 'insufficient_privilege';
  end if;

  select * into v_viaje from public.viajes v where v.id = p_viaje for update;
  if not found or v_viaje.estado <> 'solicitado' then
    raise exception 'viaje_no_disponible' using errcode = 'P0001';
  end if;

  update public.ofertas_viaje o set resultado = 'aceptada', respondida_en = now()
   where o.viaje_id = p_viaje and o.conductor_id = v_uid
     and o.resultado = 'pendiente' and o.vence_en > now();
  if not found then
    raise exception 'oferta_no_vigente' using errcode = 'P0001';
  end if;

  update public.ofertas_viaje o set resultado = 'tomada', respondida_en = now()
   where o.viaje_id = p_viaje and o.resultado = 'pendiente';

  update public.ofertas_viaje o set resultado = 'liberada', respondida_en = now()
   where o.conductor_id = v_uid and o.viaje_id <> p_viaje and o.resultado = 'pendiente';

  update public.viajes v set conductor_id = v_uid, estado = 'aceptado', aceptado_en = now()
   where v.id = p_viaje;

  if private.cobro_activo() then
    select case when v_viaje.tipo_servicio = 'encomienda' then p.comision_encomienda else p.comision_viaje end
      into v_comision from public.parametros_cobro p;
    if v_comision > 0 then
      perform private.registrar_movimiento(v_uid, 'comision', -v_comision, p_viaje);
    end if;
  end if;

  update public.tricimotos t set estado = 'ocupado' where t.conductor_id = v_uid;

  insert into public.threads (viaje_id, created_by) values (p_viaje, v_uid)
  returning id into v_thread;
  insert into public.thread_members (thread_id, user_id) values
    (v_thread, v_viaje.pasajero_id), (v_thread, v_uid);

  return query select p_viaje, v_thread;
end;
$$;

-- 8. DEVOLUCIÓN SI CANCELA EL PASAJERO (criterios 4 y 5) -------------------------------
-- El nombre empieza por "viajes_a_" para que se ejecute antes que viajes_al_cambiar_estado
-- (los triggers corren por orden alfabético): así, cuando la tricimoto vuelve a
-- "disponible", el saldo ya incluye la devolución.
create or replace function private.devolver_comision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_comision public.movimientos_credito%rowtype;
begin
  select * into v_comision from public.movimientos_credito m
   where m.viaje_id = new.id and m.tipo = 'comision';
  if found and v_comision.conductor_id is not null then
    insert into public.movimientos_credito (conductor_id, tipo, monto, viaje_id, motivo)
    values (v_comision.conductor_id, 'reintegro', -v_comision.monto, new.id, 'El pasajero canceló antes de iniciar')
    on conflict do nothing;
  end if;
  return null;
end;
$$;
create trigger viajes_a_devolver_comision
  after update of estado on public.viajes
  for each row
  when (old.estado = 'aceptado' and new.estado = 'cancelado' and new.cancelado_por = 'pasajero')
  execute function private.devolver_comision();

-- 9. SALDO MÍNIMO PARA ESTAR DISPONIBLE (criterio 2) -----------------------------------
-- En la BD porque el conductor tiene grant update (estado) en tricimotos.
create or replace function private.exigir_saldo_minimo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'disponible'
     and (tg_op = 'INSERT' or old.estado is distinct from 'disponible')
     and private.cobro_activo()
     and private.saldo_de(new.conductor_id) < private.saldo_minimo() then
    if tg_op = 'UPDATE' and old.estado = 'ocupado' then
      new.estado := 'inactivo';  -- terminó o le cancelaron un servicio: no se rompe ese flujo
    else
      raise exception 'saldo_insuficiente' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger tricimotos_exigir_saldo_minimo
  before insert or update of estado on public.tricimotos
  for each row execute function private.exigir_saldo_minimo();

-- 10. RECARGAS Y AJUSTES DEL ADMINISTRADOR (criterio 6) --------------------------------
create or replace function private.acreditar_credito(
  p_conductor uuid, p_tipo text, p_monto numeric,
  p_canal text, p_comprobante text, p_motivo text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_p public.parametros_cobro%rowtype;
begin
  if private.rol_actual() is distinct from 'admin' then
    raise exception 'solo_admin' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.perfiles where id = p_conductor and rol = 'conductor') then
    raise exception 'conductor_no_existe' using errcode = 'P0001';
  end if;
  if p_tipo not in ('recarga', 'ajuste') then
    raise exception 'tipo_invalido' using errcode = 'P0001';
  end if;
  select * into v_p from public.parametros_cobro;
  if p_monto is null or p_monto <> round(p_monto, 2)
     or (p_tipo = 'recarga' and (p_monto < v_p.recarga_min or p_monto > v_p.recarga_max))
     or (p_tipo = 'ajuste' and (p_monto = 0 or abs(p_monto) > v_p.recarga_max)) then
    raise exception 'monto_fuera_de_rango' using errcode = 'P0001';
  end if;
  if p_tipo = 'ajuste' and p_canal is not null then
    raise exception 'canal_solo_en_recarga' using errcode = 'P0001';
  end if;
  return private.registrar_movimiento(
    p_conductor, p_tipo, p_monto, null, p_canal, nullif(btrim(p_comprobante), ''),
    nullif(btrim(p_motivo), ''), (select auth.uid()));
exception
  when unique_violation then
    raise exception 'comprobante_repetido' using errcode = 'P0001';
  when check_violation then
    raise exception 'datos_de_recarga_invalidos' using errcode = 'P0001';
end;
$$;

create or replace function public.acreditar_credito(
  p_conductor uuid, p_tipo text, p_monto numeric,
  p_canal text default null, p_comprobante text default null, p_motivo text default null)
returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.acreditar_credito(p_conductor, p_tipo, p_monto, p_canal, p_comprobante, p_motivo)
$$;

-- 11. RESUMEN MENSUAL (criterio 10) ---------------------------------------------------
create or replace function private.resumen_creditos(p_desde date, p_hasta date)
returns table (mes date, tipo text, canal text, total numeric, cantidad bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.rol_actual() is distinct from 'admin' then
    raise exception 'solo_admin' using errcode = 'insufficient_privilege';
  end if;
  return query
    select date_trunc('month', m.creado_en at time zone 'America/Guayaquil')::date,
           m.tipo, m.canal, sum(m.monto), count(*)
      from public.movimientos_credito m
     where (m.creado_en at time zone 'America/Guayaquil')::date between p_desde and p_hasta
     group by 1, 2, 3
     order by 1, 2, 3;
end;
$$;

create or replace function public.resumen_creditos(p_desde date, p_hasta date)
returns table (mes date, tipo text, canal text, total numeric, cantidad bigint)
language sql stable security invoker set search_path = '' as $$
  select * from private.resumen_creditos(p_desde, p_hasta)
$$;

revoke all on function public.acreditar_credito(uuid, text, numeric, text, text, text) from public, anon;
revoke all on function public.resumen_creditos(date, date) from public, anon;
grant execute on function public.acreditar_credito(uuid, text, numeric, text, text, text) to authenticated;
grant execute on function public.resumen_creditos(date, date) to authenticated;

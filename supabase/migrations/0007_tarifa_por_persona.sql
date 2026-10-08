-- D-08: en Crucita se cobra 0,50 USD por persona; no hay precio fijo por ruta ni por distancia.
-- Se elimina la matriz de tarifas por par de sectores y el precio pasa a calcularse en la BD.

-- Precio unitario por zona (editable por el admin vía service role; otra zona = otro precio).
alter table public.zonas
  add column precio_por_persona numeric(5,2) not null default 0.50
  check (precio_por_persona > 0);

drop function public.obtener_tarifa(text, text);
drop table public.tarifas;

-- Los centros de sector de la semilla original estaban ~19 km al sur de Crucita.
-- El centro es el punto de referencia de la parroquia (GeoNames); el resto conserva su
-- desplazamiento relativo y La Boca es una posición PROVISIONAL (desembocadura del río
-- Portoviejo, al norte del centro). Todos se validan en campo en el paso 0.
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5375 -0.8706)') where id = 'centro';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5428 -0.8728)') where id = 'playa';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5293 -0.8653)') where id = 'las_gilces';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5353 -0.8778)') where id = 'los_arenales';
update public.sectores set centro = extensions.st_geogfromtext('SRID=4326;POINT(-80.5313 -0.8858)') where id = 'san_jacinto';

insert into public.sectores (id, zona_id, nombre, centro, color_marcador) values
  ('la_boca', 'crucita', 'La Boca', extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8350)'), '#38BDF8');

-- Viaje por número de personas, con referencias de texto libre cuando el sector no basta.
-- Sin tope de capacidad por regla de negocio; 20 es solo una barrera técnica anti-abuso.
alter table public.viajes
  add column pasajeros           smallint not null default 1 check (pasajeros between 1 and 20),
  add column origen_descripcion  text check (char_length(origen_descripcion)  between 1 and 200),
  add column destino_descripcion text check (char_length(destino_descripcion) between 1 and 200);

-- La tarifa la fija siempre la BD al crear el viaje: lo que envíe el cliente se descarta.
create or replace function private.fijar_tarifa_viaje()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_precio numeric(5,2);
begin
  select z.precio_por_persona into v_precio
  from public.zonas z
  where z.activa
    and (new.sector_origen_id is null
         or z.id = (select s.zona_id from public.sectores s where s.id = new.sector_origen_id))
  order by z.creado_en
  limit 1;

  if v_precio is null then
    raise exception 'No hay una zona activa con precio configurado' using errcode = 'check_violation';
  end if;

  new.tarifa := v_precio * new.pasajeros;
  return new;
end;
$$;

create trigger viajes_fijar_tarifa
  before insert on public.viajes
  for each row execute function private.fijar_tarifa_viaje();

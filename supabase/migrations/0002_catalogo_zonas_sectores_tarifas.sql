-- Catálogo geográfico y tarifario. Antes vivía en frontend/src/constants/sectors.ts.
create table public.zonas (
  id         text primary key check (id ~ '^[a-z0-9_]+$'),
  nombre     text not null,
  activa     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table public.sectores (
  id              text primary key check (id ~ '^[a-z0-9_]+$'),
  zona_id         text not null references public.zonas(id) on delete restrict,
  nombre          text not null,
  centro          extensions.geography(point, 4326) not null,
  color_marcador  text not null default '#0D9488',
  activo          boolean not null default true
);
create index idx_sectores_zona on public.sectores (zona_id);

-- Una fila por par de sectores (simetría: sector_a < sector_b).
create table public.tarifas (
  id            bigint generated always as identity primary key,
  zona_id       text not null references public.zonas(id) on delete restrict,
  sector_a      text not null references public.sectores(id) on delete restrict,
  sector_b      text not null references public.sectores(id) on delete restrict,
  precio        numeric(5,2) not null check (precio > 0),
  distancia_km  numeric(5,2) not null check (distancia_km > 0),
  tiempo_min    smallint not null check (tiempo_min > 0),
  constraint tarifas_par_ordenado check (sector_a < sector_b),
  constraint tarifas_par_unico unique (sector_a, sector_b)
);
create index idx_tarifas_zona on public.tarifas (zona_id);
create index idx_tarifas_sector_b on public.tarifas (sector_b);

-- Tarifa entre dos sectores en cualquier orden (A->B = B->A).
create or replace function public.obtener_tarifa(p_origen text, p_destino text)
returns setof public.tarifas
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.tarifas
  where sector_a = least(p_origen, p_destino)
    and sector_b = greatest(p_origen, p_destino);
$$;

alter table public.zonas    enable row level security;
alter table public.sectores enable row level security;
alter table public.tarifas  enable row level security;

-- Datos públicos de catálogo: lectura para todos, escritura solo vía migraciones.
create policy zonas_lectura    on public.zonas    for select to anon, authenticated using (true);
create policy sectores_lectura on public.sectores for select to anon, authenticated using (true);
create policy tarifas_lectura  on public.tarifas  for select to anon, authenticated using (true);

-- Semilla: Crucita (mismos valores que tenía sectors.ts).
insert into public.zonas (id, nombre) values ('crucita', 'Crucita');

insert into public.sectores (id, zona_id, nombre, centro, color_marcador) values
  ('centro',       'crucita', 'Centro de Crucita', extensions.st_geogfromtext('SRID=4326;POINT(-80.5432 -1.0448)'), '#0D9488'),
  ('playa',        'crucita', 'Malecón / Playa',   extensions.st_geogfromtext('SRID=4326;POINT(-80.5485 -1.0470)'), '#14B8A6'),
  ('las_gilces',   'crucita', 'Las Gilces',        extensions.st_geogfromtext('SRID=4326;POINT(-80.5350 -1.0395)'), '#F59E0B'),
  ('los_arenales', 'crucita', 'Los Arenales',      extensions.st_geogfromtext('SRID=4326;POINT(-80.5410 -1.0520)'), '#FBBF24'),
  ('san_jacinto',  'crucita', 'San Jacinto',       extensions.st_geogfromtext('SRID=4326;POINT(-80.5370 -1.0600)'), '#10B981');

insert into public.tarifas (zona_id, sector_a, sector_b, precio, distancia_km, tiempo_min)
select 'crucita', least(a, b), greatest(a, b), precio, km, minutos
from (values
  ('centro',       'playa',        1.50, 1.2,  5),
  ('centro',       'las_gilces',   2.00, 2.0,  8),
  ('centro',       'los_arenales', 1.75, 1.5,  6),
  ('centro',       'san_jacinto',  2.40, 3.2, 10),
  ('playa',        'las_gilces',   2.50, 3.0, 12),
  ('playa',        'los_arenales', 1.50, 1.0,  4),
  ('playa',        'san_jacinto',  2.20, 2.8,  9),
  ('las_gilces',   'los_arenales', 2.00, 2.2,  8),
  ('las_gilces',   'san_jacinto',  3.00, 4.0, 15),
  ('los_arenales', 'san_jacinto',  1.50, 1.3,  5)
) as t(a, b, precio, km, minutos);

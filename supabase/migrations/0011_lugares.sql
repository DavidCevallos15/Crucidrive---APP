-- Paso 003 · Catálogo de lugares (D-09; plan R15, R16, R19, R20).
-- Búsqueda local por nombre, sin tildes y tolerante a errores leves, sin API de pago.
-- Lo leen todos (también visitantes sin cuenta); solo el administrador lo modifica.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Minúsculas, sin tildes y con espacios simples. Se usa el diccionario con schema
-- explícito: la forma de un argumento falla cuando search_path está vacío.
create or replace function private.normalizar(p_texto text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, ''))),
    '\s+', ' ', 'g'))
$$;

-- Sector cuyo centro está más cerca del punto (no hay polígonos de sector; spec, fuera de alcance).
create or replace function private.sector_mas_cercano(p_punto extensions.geography)
returns text language sql stable set search_path = '' as $$
  select s.id from public.sectores s
  where s.centro is not null
  order by extensions.st_distance(s.centro, p_punto)
  limit 1
$$;

create table public.lugares (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null check (char_length(btrim(nombre)) between 2 and 120),
  nombre_norm        text not null,
  categoria          text not null default 'otro'
                     check (categoria in ('comida', 'hospedaje', 'tienda', 'salud', 'educacion', 'religion',
                                          'gobierno', 'turismo', 'transporte', 'poblado', 'otro')),
  ubicacion          extensions.geography(point, 4326) not null,
  sector_id          text references public.sectores(id) on delete set null,
  fuente             text not null default 'admin' check (fuente in ('osm', 'admin', 'david')),
  osm_id             text unique check (osm_id ~ '^(node|way|relation)/[0-9]+$'),
  editado_por_admin  boolean not null default false,
  visible            boolean not null default true,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  constraint lugares_osm_con_id check (fuente <> 'osm' or osm_id is not null)
);
create index idx_lugares_nombre_trgm on public.lugares using gin (nombre_norm extensions.gin_trgm_ops);
create index idx_lugares_ubicacion on public.lugares using gist (ubicacion);
create index idx_lugares_sector on public.lugares (sector_id);

-- Calcula el nombre normalizado y el sector. Si quien escribe es un usuario de la app
-- (solo puede ser un admin, por RLS), el lugar queda marcado como suyo: una nueva
-- importación de OSM no lo pisa (criterio 22).
create or replace function private.preparar_lugar()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.nombre := btrim(new.nombre);
  new.nombre_norm := private.normalizar(new.nombre);
  new.sector_id := private.sector_mas_cercano(new.ubicacion);
  new.actualizado_en := now();
  if current_user = 'authenticated' then
    new.editado_por_admin := true;
    if tg_op = 'INSERT' then
      new.fuente := 'admin';
      new.osm_id := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger lugares_preparar
  before insert or update on public.lugares
  for each row execute function private.preparar_lugar();

alter table public.lugares enable row level security;

-- Una política por rol (sin políticas permisivas duplicadas): anon no tiene acceso
-- al schema private, así que no puede evaluar rol_actual().
create policy lugares_select_anon on public.lugares for select to anon
  using (visible);
create policy lugares_select on public.lugares for select to authenticated
  using (visible or private.rol_actual() = 'admin');
create policy lugares_insert_admin on public.lugares for insert to authenticated
  with check (private.rol_actual() = 'admin');
create policy lugares_update_admin on public.lugares for update to authenticated
  using (private.rol_actual() = 'admin')
  with check (private.rol_actual() = 'admin');

-- Sin DELETE: un lugar se oculta (visible = false). Los demás campos los fija el trigger.
revoke all on public.lugares from anon, authenticated;
grant select on public.lugares to anon, authenticated;
grant insert (nombre, categoria, ubicacion, visible) on public.lugares to authenticated;
grant update (nombre, categoria, ubicacion, visible) on public.lugares to authenticated;

-- Búsqueda (criterio 18): hasta 20 lugares, primero los que contienen el texto tal cual
-- y luego los parecidos. Respeta RLS (security invoker): los ocultos no salen.
-- La normalización repite la de private.normalizar porque anon no accede a private.
create or replace function public.buscar_lugares(q text)
returns table (id uuid, nombre text, categoria text, sector_id text, lat double precision, lng double precision)
language sql stable security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = '0.45'
as $$
  with consulta as (
    select btrim(regexp_replace(
      lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(q, ''))),
      '\s+', ' ', 'g')) as t
  )
  select l.id, l.nombre, l.categoria, l.sector_id,
         extensions.st_y(l.ubicacion::extensions.geometry) as lat,
         extensions.st_x(l.ubicacion::extensions.geometry) as lng
  from public.lugares l, consulta c
  where char_length(c.t) >= 2
    and char_length(c.t) <= 80
    and (l.nombre_norm like '%' || c.t || '%'
         or c.t operator(extensions.<%) l.nombre_norm)
  order by (l.nombre_norm like c.t || '%') desc,
           (l.nombre_norm like '%' || c.t || '%') desc,
           extensions.word_similarity(c.t, l.nombre_norm) desc,
           l.nombre
  limit 20
$$;
revoke all on function public.buscar_lugares(text) from public;
grant execute on function public.buscar_lugares(text) to anon, authenticated;

revoke all on function private.normalizar(text) from public, anon;
revoke all on function private.sector_mas_cercano(extensions.geography) from public, anon;
revoke all on function private.preparar_lugar() from public, anon;
grant execute on function private.normalizar(text) to authenticated;
grant execute on function private.sector_mas_cercano(extensions.geography) to authenticated;

-- Semilla: puntos que marcó David en Google Maps (specs/003-despacho/notas-lugares.md, criterio 23).
insert into public.lugares (nombre, categoria, ubicacion, fuente) values
  ('Muelle de Crucita', 'turismo', extensions.st_geogfromtext('SRID=4326;POINT(-80.53351033 -0.84791035)'), 'david'),
  ('Los Ranchos',       'otro',    extensions.st_geogfromtext('SRID=4326;POINT(-80.53151531 -0.84971288)'), 'david');

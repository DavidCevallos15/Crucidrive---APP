create table public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  rol        text not null check (rol in ('pasajero', 'conductor', 'admin')),
  nombre     text not null check (char_length(nombre) between 2 and 100),
  telefono   text not null unique check (telefono ~ '^\+?[0-9]{7,15}$'),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table public.tricimotos (
  id                uuid primary key default gen_random_uuid(),
  conductor_id      uuid not null unique references public.perfiles(id) on delete cascade,
  placa             text not null unique check (placa ~ '^[A-Z0-9-]{3,10}$'),
  estado            text not null default 'inactivo' check (estado in ('disponible', 'ocupado', 'inactivo')),
  ubicacion_actual  extensions.geography(point, 4326),
  sector_id         text references public.sectores(id) on delete set null,
  updated_at        timestamptz not null default now()
);
create index idx_tricimotos_sector_estado on public.tricimotos (sector_id, estado);
create index idx_tricimotos_ubicacion on public.tricimotos using gist (ubicacion_actual);

create trigger tricimotos_updated_at
  before update on public.tricimotos
  for each row execute function private.tocar_updated_at();

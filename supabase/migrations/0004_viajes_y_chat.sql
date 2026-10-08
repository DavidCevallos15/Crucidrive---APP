create table public.viajes (
  id                 uuid primary key default gen_random_uuid(),
  pasajero_id        uuid references public.perfiles(id) on delete set null,
  conductor_id       uuid references public.perfiles(id) on delete set null,
  origen             extensions.geography(point, 4326) not null,
  destino            extensions.geography(point, 4326) not null,
  sector_origen_id   text references public.sectores(id) on delete set null,
  sector_destino_id  text references public.sectores(id) on delete set null,
  estado             text not null default 'solicitado'
                     check (estado in ('solicitado', 'aceptado', 'en_curso', 'finalizado', 'cancelado')),
  tarifa             numeric(5,2) check (tarifa >= 0),
  creado_en          timestamptz not null default now(),
  aceptado_en        timestamptz,
  finalizado_en      timestamptz,
  updated_at         timestamptz not null default now()
);
create index idx_viajes_pasajero on public.viajes (pasajero_id);
create index idx_viajes_conductor on public.viajes (conductor_id);
create index idx_viajes_sector_origen on public.viajes (sector_origen_id);
create index idx_viajes_sector_destino on public.viajes (sector_destino_id);
create index idx_viajes_solicitados on public.viajes (creado_en) where estado = 'solicitado';

create trigger viajes_updated_at
  before update on public.viajes
  for each row execute function private.tocar_updated_at();

create table public.threads (
  id          uuid primary key default gen_random_uuid(),
  viaje_id    uuid unique references public.viajes(id) on delete set null,
  created_by  uuid references public.perfiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_threads_created_by on public.threads (created_by);

create table public.thread_members (
  thread_id   uuid not null references public.threads(id) on delete cascade,
  user_id     uuid not null references public.perfiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index idx_thread_members_user on public.thread_members (user_id);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads(id) on delete cascade,
  sender_id   uuid references public.perfiles(id) on delete set null,
  content     text not null check (char_length(content) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index idx_messages_thread_created on public.messages (thread_id, created_at);
create index idx_messages_sender on public.messages (sender_id);

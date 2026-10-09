-- Imitación mínima de Supabase (roles, auth.users, auth.uid()) para probar migraciones en un Postgres local con PostGIS.
-- Uso: ver supabase/tests/README.md
-- Imitación mínima del entorno de Supabase
-- Los roles son del servidor, no de la base: se crean solo si faltan (varias bases de prueba comparten servidor).
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema extensions; grant usage on schema extensions to anon, authenticated, service_role;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Storage: tablas y función mínimas que usan las políticas de buckets.
create schema storage; grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(regexp_replace(name, '/[^/]*$', ''), '/') $$;
grant select on storage.buckets to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
-- Como en Supabase, service_role (la clave de servicio) también recibe permisos sobre public.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter database postgres set search_path = "$user", public, extensions;

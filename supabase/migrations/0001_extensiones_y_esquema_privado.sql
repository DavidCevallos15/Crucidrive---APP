-- PostGIS en el schema "extensions" (no expuesto por la API REST),
-- así spatial_ref_sys y las funciones st_* no quedan accesibles para anon.
create extension if not exists postgis with schema extensions;

-- Schema privado para funciones auxiliares de RLS (no expuesto por PostgREST).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Mantiene updated_at al día en cada UPDATE.
create or replace function private.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

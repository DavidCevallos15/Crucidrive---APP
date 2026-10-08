-- Imitación mínima de Supabase (roles, auth.users, auth.uid()) para probar migraciones en un Postgres local con PostGIS.
-- Uso: ver supabase/tests/README.md
-- Imitación mínima del entorno de Supabase
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; grant usage on schema extensions to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter database postgres set search_path = "$user", public, extensions;

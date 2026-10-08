-- Ejecutado UNA sola vez el 2026-10-08 sobre el proyecto Supabase "Crucidrive - APP".
-- Motivo: el esquema real no coincidía con el código (ver specs/001-cimientos/spec.md).
-- Todas las tablas tenían 0 filas y auth.users estaba vacío: no se perdieron datos.
-- No forma parte de la cadena de migraciones; una BD nueva no lo necesita.
drop table if exists public.messages, public.thread_members, public.threads,
  public.viajes, public.tricimotos, public.perfiles cascade;
drop extension if exists postgis cascade;

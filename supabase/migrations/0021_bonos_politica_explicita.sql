-- 020 · Cierra el aviso "RLS Enabled No Policy" del linter de Supabase sobre
-- private.bonos_por_cedula (0020). La tabla ya no tenía permisos para nadie fuera del
-- dueño; la política deja escrito que ningún rol de la API la lee ni la escribe.
create policy bonos_por_cedula_sin_acceso on private.bonos_por_cedula
  as restrictive for all to public
  using (false) with check (false);

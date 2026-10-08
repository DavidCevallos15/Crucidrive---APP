-- La función rls_auto_enable() la crea Supabase para el event trigger "ensure_rls"
-- (activa RLS automáticamente en tablas nuevas). Se conserva, pero no debe
-- poder invocarse vía /rest/v1/rpc por anon ni authenticated.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

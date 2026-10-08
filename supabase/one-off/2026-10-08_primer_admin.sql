-- Ejecutado UNA sola vez el 2026-10-08 sobre el proyecto Supabase "Crucidrive - APP".
-- Convierte a David (jimdav1506ceva@gmail.com) en el primer administrador (spec 002, D-04).
-- Esa cuenta era el conductor de la prueba de humo: primero se borran los datos de la
-- prueba (1 viaje, 1 chat, 1 mensaje y su tricimoto), que no son datos reales.
-- No forma parte de la cadena de migraciones: nadie se hace admin desde la app.
do $$
declare
  v_admin uuid;
begin
  select id into v_admin from auth.users where email = 'jimdav1506ceva@gmail.com';
  if v_admin is null then
    raise exception 'No existe la cuenta jimdav1506ceva@gmail.com';
  end if;

  delete from public.threads;          -- arrastra miembros y mensajes (ON DELETE CASCADE)
  delete from public.viajes;
  delete from public.tricimotos where conductor_id = v_admin;

  update public.perfiles set rol = 'admin' where id = v_admin;
end;
$$;

-- Paso 007, PR 2 (plan P6 y P7), segunda mitad: se cierra la lectura directa.
-- Aplicar DESPUÉS de desplegar el backend y publicar la app que leen el teléfono con las funciones
-- de la 0018: el código anterior pide la columna con select y recibiría «permission denied».
-- 1. perfiles.telefono deja de leerse directo. El nombre se sigue viendo como hoy (E1): perfiles_select no cambia.
-- 2. consentimientos.id deja de leerse (criterio 15): el número interno dejaba contar los registros.

-- RLS no limita columnas: se quita el select de la tabla y se da por columna (como en 0005 con update).
revoke select on public.perfiles from anon, authenticated;
grant select (id, rol, nombre, activo, creado_en) on public.perfiles to authenticated;

revoke select on public.consentimientos from anon, authenticated;
grant select (user_id, version, aceptado_en) on public.consentimientos to authenticated;

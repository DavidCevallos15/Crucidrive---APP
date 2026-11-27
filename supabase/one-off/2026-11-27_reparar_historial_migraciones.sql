-- Ejecutado UNA sola vez el 2026-11-27 sobre el proyecto Supabase "Crucidrive - APP".
-- Equivale a `supabase migration repair`: no cambia el esquema, solo el registro de
-- supabase_migrations.schema_migrations para que coincida con supabase/migrations/.
-- No forma parte de la cadena de migraciones; una BD nueva no lo necesita.
--
-- Motivo: las migraciones aplicadas con la herramienta apply_migration (MCP) quedaron con
-- versión de fecha en vez del número del archivo, y 0014 a 0017 se aplicaron sin quedar
-- registradas. Cualquier comparación repo ↔ producción (supabase db push, la integración de
-- GitHub con despliegue) habría intentado correr otra vez 0007 a 0021.
--
-- Comprobado antes de ejecutar (ver REGISTRO_CAMBIOS.md 1.95.0):
--  * Las 11 filas con versión de fecha tienen el mismo SQL que su archivo del repo
--    (md5 igual sin comentarios ni espacios).
--  * Los objetos de 0014 a 0017 existen en producción, con el mismo cuerpo en las funciones.
--
-- Historial antes de la reparación (versión → nombre):
--   0001..0006 (bien) · 20261008203835 tarifa_por_persona · 20261008205605 centros_sectores_reales ·
--   20261008212459 sectores_definitivos · 20261008222333 identidad · 20261009001358 lugares ·
--   20261009004013 lugares_osm · 20261009010738 despacho · (0014 a 0017 sin fila) ·
--   20261119173549 telefono_por_funcion · 20261119180813 cerrar_telefono_y_consentimientos ·
--   20261127123547 0020_creditos_conductor · 20261127123836 0021_bonos_politica_explicita
--
-- Un solo bloque: o se aplica todo o nada. Se puede volver a correr (si ya está reparado, no
-- cambia nada). Las filas renombradas conservan su SQL (statements) y quién las aplicó.
do $$
declare
  esperado text[] := array['0001','0002','0003','0004','0005','0006','0007','0008','0009','0010',
                           '0011','0012','0013','0014','0015','0016','0017','0018','0019','0020','0021'];
  actual text[];
begin
  -- 1. Versiones de fecha → número del archivo, y nombre sin el número.
  update supabase_migrations.schema_migrations m
     set version = v.nueva, name = v.nombre
    from (values
      ('20261008203835', '0007', 'tarifa_por_persona'),
      ('20261008205605', '0008', 'centros_sectores_reales'),
      ('20261008212459', '0009', 'sectores_definitivos'),
      ('20261008222333', '0010', 'identidad'),
      ('20261009001358', '0011', 'lugares'),
      ('20261009010738', '0012', 'despacho'),
      ('20261009004013', '0013', 'lugares_osm'),
      ('20261119173549', '0018', 'telefono_por_funcion'),
      ('20261119180813', '0019', 'cerrar_telefono_y_consentimientos'),
      ('20261127123547', '0020', 'creditos_conductor'),
      ('20261127123836', '0021', 'bonos_politica_explicita')
    ) as v(vieja, nueva, nombre)
   where m.version = v.vieja;

  -- 2. Las que se aplicaron sin quedar registradas. Sin statements: no se guardó el SQL
  --    exacto que corrió; created_by deja constancia de que es una reparación.
  insert into supabase_migrations.schema_migrations (version, name, created_by)
  values ('0014', 'avisos_y_privacidad', 'reparacion-historial-2026-11-27'),
         ('0015', 'encomiendas', 'reparacion-historial-2026-11-27'),
         ('0016', 'varias_ofertas', 'reparacion-historial-2026-11-27'),
         ('0017', 'viaje_en_curso', 'reparacion-historial-2026-11-27')
  on conflict (version) do nothing;

  -- 3. Comprobación: el historial es exactamente 0001 a 0021. Si no, se revierte todo.
  select array_agg(version order by version) into actual from supabase_migrations.schema_migrations;
  if actual is distinct from esperado then
    raise exception 'Historial inesperado tras la reparación: %', actual;
  end if;
end $$;

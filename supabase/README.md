# Base de datos de CruciDrive (Supabase)

| Carpeta | Qué hay |
| --- | --- |
| `migrations/` | La cadena de migraciones `NNNN_nombre.sql`. Es la fuente de verdad del esquema. |
| `tests/` | Pruebas de RLS y concurrencia en un Postgres local (ver `tests/README.md`). |
| `one-off/` | Scripts que se corrieron una sola vez en producción. No son migraciones. |
| `templates/` | Plantillas de correo de Supabase Auth. |

## El historial de producción debe coincidir con `migrations/`

Supabase guarda en `supabase_migrations.schema_migrations` qué migraciones se aplicaron. Cada fila
lleva la **versión** (el número del archivo, por ejemplo `0021`) y el **nombre** sin el número
(`bonos_politica_explicita`). Si el historial no coincide con los archivos, `supabase db push` o
cualquier despliegue que compare el repo con producción intentará correr otra vez migraciones ya
aplicadas.

La integración de Supabase con GitHub **no aplica migraciones** en este proyecto: el check
«Supabase Preview» sale *skipping* porque no hay ramas de Supabase. Las migraciones se aplican a
mano, después de probarlas en local, con uno de estos dos caminos.

### Camino A (recomendado): Supabase CLI

Registra la versión con el número del archivo sin pasos extra. Todavía no se ha usado en este repo:
la primera vez, revisa que `migration list` muestre 0001 a 0021 en las dos columnas antes de
correr `db push`. Si el CLI pide `supabase init`, crea solo `config.toml`; no toques `migrations/`.

```bash
npx supabase login                       # una vez por equipo
npx supabase link --project-ref mofhviqvyndxoxcxhaiw
npx supabase migration list              # local y remoto deben coincidir antes de empezar
npx supabase db push                     # aplica solo las nuevas
```

### Camino B: herramienta `apply_migration` (MCP)

`apply_migration` registra la migración con una versión de fecha (`20261127123547`), no con el
número del archivo. Por eso, **en la misma sesión**, después de aplicarla:

```sql
-- Sustituye NNNN y nombre por los del archivo; el name que se pasó a apply_migration era NNNN_nombre.
update supabase_migrations.schema_migrations
   set version = 'NNNN', name = 'nombre'
 where name = 'NNNN_nombre' and version ~ '^\d{14}$';
```

### Comprobación después de cada migración

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Debe listar exactamente los archivos de `migrations/`, en orden y sin huecos. La prueba
`backend/tests/migraciones.test.js` vigila en el CI que los archivos sigan esa numeración.

Historial reparado el 27 nov 2026 (`one-off/2026-11-27_reparar_historial_migraciones.sql`):
0007 a 0013 y 0018 a 0021 tenían versión de fecha, y 0014 a 0017 se habían aplicado sin quedar registradas.

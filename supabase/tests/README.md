# Pruebas de base de datos

Validan las migraciones de `supabase/migrations/` y sus políticas RLS sin tocar el proyecto real.

Requisitos: PostgreSQL 16+ con PostGIS (en Fedora: `sudo dnf install postgresql-server postgis`).

```bash
createdb crucidrive_test
psql -d crucidrive_test -v ON_ERROR_STOP=1 -f supabase/tests/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -d crucidrive_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d crucidrive_test -X -f supabase/tests/rls_001.sql
dropdb crucidrive_test
```

Resultado esperado: cada intento indebido aparece como `NOTICE: OK ... (bloqueado ...)`, todas las comprobaciones devuelven `t` y el script termina con `RLS: TODAS LAS PRUEBAS TERMINARON`.
Última ejecución: 8 oct 2026, PostgreSQL 16 + PostGIS 3, 6 migraciones aplicadas, 21 comprobaciones en verde.

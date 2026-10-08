#!/usr/bin/env bash
# Prueba las migraciones y las políticas RLS en un Postgres 16 + PostGIS desechable (Docker).
# Uso, desde la raíz del repo:   bash supabase/tests/run-docker.sh
# Resultado: cuenta de comprobaciones en verde (t) y en rojo (f) por cada archivo rls_*.sql.
set -euo pipefail

NAME=crucidb
IMAGE=postgis/postgis:16-3.4
cd "$(git rev-parse --show-toplevel)"

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=x "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

# El servidor reinicia una vez tras inicializar: hay que esperar el segundo "ready".
for _ in $(seq 1 60); do
  [ "$(docker logs "$NAME" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ] && break
  sleep 2
done

status=0
for test in supabase/tests/rls_*.sql; do
  db="t_$(basename "$test" .sql)"
  # La imagen trae PostGIS en public; las migraciones lo esperan en "extensions": base limpia desde template0.
  docker exec "$NAME" psql -U postgres -c "create database $db template template0" >/dev/null
  psql_db() { docker exec -i "$NAME" psql -U postgres -d "$db" -X "$@"; }
  psql_db -v ON_ERROR_STOP=1 -q < supabase/tests/00_stub_supabase.sql >/dev/null
  for migration in supabase/migrations/*.sql; do psql_db -v ON_ERROR_STOP=1 -q < "$migration"; done
  out=$(psql_db < "$test" 2>&1) || true   # un fallo ya se ve en "ERROR" y en el conteo
  ok=$(echo "$out" | grep -cE '^ t\s*$' || true)
  bad=$(echo "$out" | grep -cE '^ f\s*$' || true)
  errs=$(echo "$out" | grep -E 'ERROR|FALLO' || true)
  echo "$(basename "$test"): $ok en verde, $bad en rojo"
  [ -n "$errs" ] && { echo "$out" | tail -12; status=1; }
  [ "$bad" -ne 0 ] && status=1
  echo "$out" | tail -1
done
exit $status

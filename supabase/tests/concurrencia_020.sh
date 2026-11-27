#!/usr/bin/env bash
# Paso 020, criterio 3: dos descuentos simultáneos sobre el mismo saldo nunca lo dejan negativo.
# Carla tiene 2,00; dos sesiones intentan restar 1,50 a la vez. La primera mantiene la
# transacción abierta 2 s; la segunda espera el bloqueo de la fila del saldo y, al
# liberarse, ve 0,50 y falla con saldo_insuficiente.
# Uso: lo llama run-docker.sh con el nombre del contenedor (también: bash concurrencia_020.sh <contenedor>).
set -euo pipefail

NAME=${1:?falta el nombre del contenedor}
DB=t_concurrencia_020
cd "$(git rev-parse --show-toplevel)"

docker exec "$NAME" psql -U postgres -c "create database $DB template template0" >/dev/null
psql_db() { docker exec -i "$NAME" psql -U postgres -d "$DB" -X "$@"; }
psql_db -v ON_ERROR_STOP=1 -q < supabase/tests/00_stub_supabase.sql >/dev/null
for migration in supabase/migrations/*.sql; do psql_db -v ON_ERROR_STOP=1 -q < "$migration"; done

psql_db -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
insert into auth.users values ('22222222-2222-2222-2222-222222222222'), ('55555555-5555-5555-5555-555555555555');
insert into consentimientos (user_id, version) select id, 'prueba' from auth.users;
insert into perfiles (id, rol, nombre, telefono) values
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('55555555-5555-5555-5555-555555555555', 'admin', 'Admin', '0995555555');
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado)
values ('22222222-2222-2222-2222-222222222222', '1700000022', '22222222-2222-2222-2222-222222222222/conductor.jpg',
        '22222222-2222-2222-2222-222222222222/cedula.jpg', '22222222-2222-2222-2222-222222222222/vehiculo.jpg', 'aprobado');
SQL

descontar() {  # $1 = segundos que mantiene abierta la transacción
  psql_db -v ON_ERROR_STOP=1 -q <<SQL 2>&1
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select acreditar_credito('22222222-2222-2222-2222-222222222222', 'ajuste', -1.50, p_motivo => 'Prueba de concurrencia');
select pg_sleep($1);
commit;
SQL
}

salida_a=$(mktemp); salida_b=$(mktemp)
descontar 2 > "$salida_a" &
sleep 0.5
descontar 0 > "$salida_b" &
wait

segundo=$(cat "$salida_b")
rm -f "$salida_a" "$salida_b"

resultado=$(psql_db -At <<'SQL'
select (select saldo from saldos_credito where conductor_id = '22222222-2222-2222-2222-222222222222') = 0.50
   and (select count(*) from movimientos_credito where tipo = 'ajuste') = 1;
SQL
)

docker exec "$NAME" psql -U postgres -c "drop database $DB" >/dev/null
if [ "$resultado" = "t" ] && echo "$segundo" | grep -q 'saldo_insuficiente'; then
  echo "concurrencia_020: 1 en verde, 0 en rojo (solo un descuento pasa; el otro recibe saldo_insuficiente)"
else
  echo "concurrencia_020: FALLO"
  echo "estado final correcto: $resultado"
  echo "segunda sesión: $segundo"
  exit 1
fi

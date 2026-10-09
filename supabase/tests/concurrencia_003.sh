#!/usr/bin/env bash
# Paso 003, criterio 8: dos conductores aceptan el mismo viaje a la vez y solo uno gana.
# Dos sesiones psql en paralelo: la primera acepta y mantiene la transacción abierta 2 s;
# la segunda intenta aceptar mientras tanto, espera el bloqueo y, al liberarse, pierde.
# Uso: lo llama run-docker.sh con el nombre del contenedor (también: bash concurrencia_003.sh <contenedor>).
set -euo pipefail

NAME=${1:?falta el nombre del contenedor}
DB=t_concurrencia_003
cd "$(git rev-parse --show-toplevel)"

docker exec "$NAME" psql -U postgres -c "create database $DB template template0" >/dev/null
psql_db() { docker exec -i "$NAME" psql -U postgres -d "$DB" -X "$@"; }
psql_db -v ON_ERROR_STOP=1 -q < supabase/tests/00_stub_supabase.sql >/dev/null
for migration in supabase/migrations/*.sql; do psql_db -v ON_ERROR_STOP=1 -q < "$migration"; done

psql_db -v ON_ERROR_STOP=1 -q <<'SQL' >/dev/null
insert into auth.users values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('44444444-4444-4444-4444-444444444444');
insert into consentimientos (user_id, version) select id, 'prueba' from auth.users;
insert into perfiles (id, rol, nombre, telefono) values
  ('11111111-1111-1111-1111-111111111111', 'pasajero', 'Pedro', '0991111111'),
  ('22222222-2222-2222-2222-222222222222', 'conductor', 'Carla', '0992222222'),
  ('44444444-4444-4444-4444-444444444444', 'conductor', 'Diego', '0994444444');
insert into conductores_verificacion (conductor_id, cedula, foto_conductor, foto_cedula, foto_vehiculo, estado)
select id, '17000000' || right(id::text, 2), id || '/conductor.jpg', id || '/cedula.jpg', id || '/vehiculo.jpg', 'aprobado'
from auth.users where id <> '11111111-1111-1111-1111-111111111111';
insert into tricimotos (conductor_id, placa, estado, ubicacion_actual) values
  ('22222222-2222-2222-2222-222222222222', 'ABC-123', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5401 -0.8700)')),
  ('44444444-4444-4444-4444-444444444444', 'DEF-456', 'disponible', extensions.st_geogfromtext('SRID=4326;POINT(-80.5402 -0.8700)'));
insert into viajes (id, pasajero_id, origen, destino) values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  extensions.st_geogfromtext('SRID=4326;POINT(-80.5400 -0.8700)'), extensions.st_geogfromtext('SRID=4326;POINT(-80.5300 -0.8500)'));
set role service_role;
select crear_ofertas('a0000000-0000-0000-0000-000000000001',
  array['22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444']::uuid[], 'abierta', now() + interval '60 seconds');
SQL

aceptar() {  # $1 = conductor, $2 = segundos que mantiene abierta la transacción
  psql_db -v ON_ERROR_STOP=1 -q <<SQL 2>&1
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '$1', true);
select * from aceptar_viaje('a0000000-0000-0000-0000-000000000001');
select pg_sleep($2);
commit;
SQL
}

salida_a=$(mktemp); salida_b=$(mktemp)
aceptar 22222222-2222-2222-2222-222222222222 2 > "$salida_a" &
sleep 0.5
aceptar 44444444-4444-4444-4444-444444444444 0 > "$salida_b" &
wait

segundo=$(cat "$salida_b")
rm -f "$salida_a" "$salida_b"

resultado=$(psql_db -At <<'SQL'
select (select count(*) from viajes where estado = 'aceptado' and conductor_id = '22222222-2222-2222-2222-222222222222') = 1
   and (select count(*) from ofertas_viaje where resultado = 'aceptada') = 1
   and (select count(*) from ofertas_viaje where resultado = 'tomada' and conductor_id = '44444444-4444-4444-4444-444444444444') = 1
   and (select count(*) from threads) = 1
   and (select count(*) from tricimotos where estado = 'ocupado') = 1;
SQL
)

docker exec "$NAME" psql -U postgres -c "drop database $DB" >/dev/null
if [ "$resultado" = "t" ] && echo "$segundo" | grep -q 'viaje_no_disponible'; then
  echo "concurrencia_003: 1 en verde, 0 en rojo (solo un conductor gana; el otro recibe viaje_no_disponible)"
else
  echo "concurrencia_003: FALLO"
  echo "estado final correcto: $resultado"
  echo "segundo conductor: $segundo"
  exit 1
fi

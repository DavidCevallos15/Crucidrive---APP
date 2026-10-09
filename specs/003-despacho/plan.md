# 003 · Plan técnico

Spec aprobada al fusionar el PR #18 (8 oct 2026). Este plan dice **cómo**; la spec dice qué y por qué. Los números entre paréntesis son criterios de la spec.

## Decisiones de diseño

| # | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- |
| R1 | El **despachador vive en el backend** (`src/despacho/`), con temporizadores en memoria, y la BD es la fuente de verdad de cada oferta (`ofertas_viaje` con `vence_en`) | Lógica de despacho en la BD con `pg_cron`, o una cola en Redis | Un solo proceso Node basta para el piloto y la constitución prohíbe Redis sin spec (regla 8). Como el estado está en la BD, un reinicio no pierde nada: se reconstruye desde las filas (14) |
| R2 | Aceptar es una **RPC atómica** `public.aceptar_viaje(p_viaje)`: bloquea el viaje con `FOR UPDATE`, exige una oferta propia `pendiente` y vigente, y en la misma transacción asigna el conductor, pone la tricimoto `ocupado`, crea el chat con los 2 miembros y marca como `tomada` las demás ofertas (8, 9, 10) | El flujo actual en 3 llamadas REST con rollback manual | El rollback manual puede fallar a medias (lo dice el propio código) y con dos conductores a la vez ambos pasan la comprobación previa |
| R3 | Las RPC expuestas son `security invoker` en `public` y llaman a una función `security definer` en `private` (`search_path = ''`) | `security definer` directamente en `public` | El linter de Supabase avisa de funciones `security definer` ejecutables por `authenticated` en un schema expuesto; con el envoltorio el linter queda en 0 y `private` sigue fuera del API |
| R4 | **Se cierra el hueco de columnas** en `viajes`: se revoca `update (conductor_id, aceptado_en)` a `authenticated` y se quita de `viajes_update` la rama "conductor tomando un viaje libre". Un trigger `private.controlar_transicion_viaje` valida las transiciones cuando `current_user = 'authenticated'` | Dejar la validación solo en el backend (riesgo anotado en el 001) | Hoy un conductor aprobado puede tomar un viaje por la API REST de Supabase sin oferta, y un pasajero puede escribir `conductor_id` en su propio viaje. Dentro de las funciones `security definer`, `current_user` es el dueño, así que el trigger no frena al sistema |
| R5 | Candidatos con una función SQL `private.candidatos_despacho(p_viaje, p_ubicacion_max_seg)` ordenada por `floor(distancia / 50)` y luego por `disponible_desde` (4, 5). Filtra: tricimoto `disponible`, conductor aprobado y activo, `ubicacion_en` dentro del umbral, sin viaje activo, sin oferta pendiente y sin oferta previa para ese viaje (2, 3, 6, 7) | Ordenar en JavaScript tras leer todas las tricimotos | PostGIS ya tiene el índice GiST y así la regla se prueba en SQL; JavaScript solo decide el momento |
| R6 | Además del filtro de la BD, el despachador solo ofrece a conductores con **socket conectado** (mapa en memoria `conductorId → sockets`) | Pasar la tricimoto a `inactivo` al desconectarse | Con señal 3G inestable, una microcaída dejaría al conductor fuera hasta que vuelva a activar el interruptor. Basta con no ofrecerle mientras está desconectado (2) |
| R7 | **Una oferta pendiente por conductor** con índice único parcial `(conductor_id) where resultado = 'pendiente'` y **un viaje activo por pasajero** con índice único parcial `(pasajero_id) where estado in ('solicitado','aceptado','en_curso')` (7, 13) | Comprobarlo en el backend | El índice es la garantía bajo concurrencia; el backend solo da el mensaje claro |
| R8 | Estado nuevo `sin_conductor` en `viajes.estado` (11) | Reusar `cancelado` con un motivo | Para medir el piloto hay que distinguir "nadie pudo" de "el pasajero se arrepintió" |
| R9 | `tricimotos.ubicacion_en` y `tricimotos.disponible_desde` los mantiene un trigger, no el cliente (2, 5) | Usar `updated_at` | `updated_at` cambia con cualquier columna; el desempate necesita saber desde cuándo está disponible |
| R10 | `update_location` deja de cambiar `estado` (hoy lo pone en `disponible` por defecto). La disponibilidad se cambia con `PATCH /api/conductores/disponibilidad` (1) | Seguir mandando `estado` en cada envío de ubicación | Hoy el interruptor nunca llega al servidor y cada envío de ubicación pisaría el estado `ocupado` |
| R11 | Al pasar un viaje a `finalizado`, `cancelado` o `sin_conductor`, un trigger devuelve la tricimoto del conductor a `disponible` si estaba `ocupado` (3) | Esperar a que el conductor active el interruptor | Si no, el conductor queda fuera del despacho sin saberlo. Las pantallas del viaje son del 005 |
| R12 | Ofertas en salas `usuario:{id}` (cada socket se une a la suya al conectar). Eventos: `oferta_viaje`, `oferta_retirada`, `viaje_aceptado`, `viaje_sin_conductor`, `viaje_cancelado`; del conductor al servidor: `rechazar_oferta` | Notificar por sector (`sector:{id}`) | La regla mixta ofrece a personas concretas y el despacho no depende del sector (4) |
| R13 | El payload de la oferta lleva solo: `viajeId`, `pasajeros`, `tarifa`, origen y destino (nombre o sector y referencia), `distanciaM`, `fase` y `venceEn`. **No lleva** teléfono, nombre completo ni coordenadas del pasajero (15, 27) | Enviar la fila del viaje | Menos de 2 KB (cerca de 400 B) y nada personal antes de aceptar. El conductor ve el punto de recogida al aceptar (005) |
| R14 | La cuenta regresiva del conductor se calcula con `venceEn` del servidor, corregida por el desfase de reloj medido al conectar | Un contador local fijo de 15 s, como hoy | Si la oferta llega con 2 s de retraso, el contador local engaña; con `venceEn` coinciden pantalla y BD |
| R15 | Catálogo en la tabla `lugares` con `nombre_norm` (minúsculas y sin tildes, mantenida por trigger) e índice GIN `gin_trgm_ops`. La búsqueda es `public.buscar_lugares(q)` (`security invoker`, `stable`, máximo 20) con `word_similarity` y que la **app llama directamente con supabase-js** (18, 26) | `GET /api/lugares` en el backend | Son datos públicos y el visitante sin cuenta también busca. El backend no tendría JWT y usar el cliente anon para leer tablas está prohibido (CLAUDE.md). La RLS de `lugares` permite `select` a `anon` solo si `visible` |
| R16 | `pg_trgm` y `unaccent` en el schema `extensions` | Extensiones en `public` | Igual que PostGIS (P3 del 001); el linter avisa de extensiones en `public` |
| R17 | Semilla de OSM como **migración generada**: `backend/scripts/importar-lugares.js` consulta Overpass, filtra, quita duplicados y escribe `supabase/migrations/NNNN_lugares_osm.sql` con `insert ... on conflict (osm_id) do update ... where not editado_por_admin` (22) | Que el guion escriba directo en producción con la clave de servicio | La migración se revisa en el PR, se prueba en Docker, recrea la BD vacía (regla 9) y no exige la clave de servicio en el PC. Volver a importar es otra migración generada |
| R18 | Filtro de importación: dentro de un polígono aproximado de la parroquia que se define en el guion (sur de la desembocadura del río Portoviejo hasta pasar La Loma), descarta calles, nombres genéricos (`Hospedaje`, `Panadería`, `Tienda`, de una sola letra…) y fusiona nombres iguales normalizados a menos de 150 m. Overpass se llama con `User-Agent` propio (sin él, `overpass-api.de` responde 406) | Importar todo lo que tenga nombre en el rectángulo | La consulta del 8 oct trajo Charapotó, duplicados y genéricos |
| R19 | Al crear un viaje, un trigger `private.completar_viaje` toma coordenadas y nombre del lugar si llegan `lugar_origen_id` o `lugar_destino_id`, y rellena el sector con el **centro más cercano** (`private.sector_mas_cercano`) cuando falta (19). El backend acepta `lugarOrigenId` / `lugarDestinoId` en `POST /api/viajes/solicitar` | Que la app envíe las coordenadas del lugar | El servidor es la fuente de verdad (regla 2); el cliente no puede mover un lugar |
| R20 | Lugares del administrador: `GET/POST/PATCH /api/admin/lugares` con `req.supabase` y `roleMiddleware(['admin'])`; RLS de `insert`/`update` solo para `admin`; no hay `delete` (se oculta con `visible = false`). Cualquier edición del admin marca `editado_por_admin` (24, 22) | Editar desde el panel de Supabase | David no es el único admin a futuro, y el panel salta la trazabilidad |
| R21 | Parámetros por `.env`: `DESPACHO_SECUENCIALES=3`, `DESPACHO_OFERTA_SEG=15`, `DESPACHO_MAX_SEG=120`, `DESPACHO_UBICACION_MAX_SEG=60`, `DESPACHO_BARRIDO_SEG=15` | Constantes en el código | D-11 pide ajustarlos en el piloto sin publicar la app |
| R22 | Barrido de seguridad cada `DESPACHO_BARRIDO_SEG` y al arrancar: `private.cerrar_vencidos(p_max_seg)` vence ofertas pasadas de `vence_en` y pasa a `sin_conductor` los viajes `solicitado` más viejos que `DESPACHO_MAX_SEG`; luego el despachador retoma los que sigan vivos (14) | Confiar solo en los `setTimeout` | Un temporizador se pierde si el proceso cae; el barrido lo repara |

## Esquema

### `0011_lugares.sql`
- `create extension pg_trgm with schema extensions; create extension unaccent with schema extensions;`
- `private.normalizar(text)`: `lower(extensions.unaccent(...))`, `immutable` (envoltorio con diccionario explícito).
- `lugares`: `id uuid pk`, `nombre text check (2..120)`, `nombre_norm text not null`, `categoria text check in ('comida','hospedaje','tienda','salud','educacion','religion','gobierno','turismo','transporte','poblado','otro')`, `ubicacion extensions.geography(point,4326) not null`, `sector_id text → sectores`, `fuente text check in ('osm','admin','david')`, `osm_id text unique`, `editado_por_admin boolean default false`, `visible boolean default true`, `creado_en`, `actualizado_en`. Índices: GIN trigram en `nombre_norm`, GiST en `ubicacion`.
- Trigger `private.preparar_lugar`: calcula `nombre_norm` y `sector_id` (centro más cercano) y marca `editado_por_admin` si quien edita es `authenticated`.
- `private.sector_mas_cercano(geography)`.
- RLS: `select` para `anon, authenticated` si `visible` o admin; `insert`/`update` solo admin; `grant update (nombre, categoria, ubicacion, visible)`.
- `public.buscar_lugares(q text)` → `id, nombre, categoria, sector_id, lat, lng`; exige 2 caracteres o más.
- Semilla de David (Muelle de Crucita, Los Ranchos; `notas-lugares.md`) con `fuente = 'david'` (23).

### `0012_despacho.sql`
- Cierre previo: el viaje `solicitado` que quedó de las pruebas en producción se pasa a `sin_conductor` si tiene más de 2 minutos (sin esto no se puede crear el índice de viaje activo).
- `viajes`: `estado` acepta `sin_conductor`; `+ lugar_origen_id`, `+ lugar_destino_id` (→ `lugares`, `on delete set null`); índice único parcial de viaje activo por pasajero; trigger `completar_viaje` (R19) y `controlar_transicion_viaje` (R4). Transiciones permitidas a `authenticated`: pasajero `solicitado→cancelado` y `aceptado→cancelado`; conductor asignado `aceptado→en_curso`, `en_curso→finalizado` y `aceptado→cancelado`. `aceptado` y `sin_conductor` solo los ponen las funciones del sistema.
- `viajes_update` sin la rama del conductor libre; `revoke update (conductor_id, aceptado_en)`.
- `tricimotos`: `+ ubicacion_en timestamptz`, `+ disponible_desde timestamptz` (trigger R9) y trigger de liberación R11.
- `ofertas_viaje`: `id uuid pk`, `viaje_id → viajes on delete cascade`, `conductor_id → perfiles`, `fase text check in ('secuencial','abierta')`, `enviada_en`, `vence_en`, `respondida_en`, `resultado text check in ('pendiente','aceptada','rechazada','vencida','cancelada','tomada')`, `distancia_m integer` (17: **sin coordenadas**); `unique (viaje_id, conductor_id)`; índice único parcial R7. RLS: `select` del propio conductor y del admin; sin `insert/update/delete` para `authenticated` (todo pasa por funciones).
- Funciones del sistema (`security invoker`, ejecutables solo por `service_role`, que salta RLS): `public.candidatos_despacho(p_viaje, p_ubicacion_max_seg)` (R5), `public.crear_ofertas(p_viaje, p_conductores, p_fase, p_vence_en)`, `public.cerrar_vencidos(p_max_seg)` y `public.cerrar_sin_conductor(p_viaje)`; las dos últimas devuelven `(tipo, viaje_id, usuario_id)` para que el despachador avise a cada uno.
- Funciones del conductor (envoltorio R3): `public.aceptar_viaje(p_viaje) returns (viaje_id, thread_id)` y `public.rechazar_oferta(p_viaje)`.
- Triggers que reemplazan a `cancelar_solicitud` y `vencer_oferta` (enmienda de la T3): al pasar un viaje de `solicitado` a `cancelado` o `sin_conductor` se cierran sus ofertas pendientes (`cancelada` o `vencida`), y cuando la tricimoto deja de estar `disponible` la oferta pendiente de su conductor queda `rechazada`. Así el pasajero cancela con el mismo `PATCH` de siempre y nada depende de que el backend se acuerde.
- `viajes_select`: un conductor ve un viaje `solicitado` solo si tiene una oferta pendiente de ese viaje (antes lo veía cualquier conductor aprobado, con las coordenadas del pasajero).
- Transiciones (R4): `en_curso` y `finalizado` los puede poner cualquiera de los dos participantes, como hoy (la prueba de humo finaliza desde el pasajero); se revisa en el 005.

## Backend

- `src/despacho/config.js`: lee y valida R21.
- `src/despacho/conexiones.js`: mapa de sockets por usuario (R6).
- `src/despacho/despachador.js`: `iniciar(viajeId)`, `alResponder(viajeId)`, `cancelar(viajeId)`, `recuperar()` y `barrer()`. Fase secuencial: pide candidatos, toma el primero conectado, crea su oferta (`vence_en = ahora + 15 s`), emite `oferta_viaje` y programa el vencimiento; al vencer o al rechazar pasa al siguiente. Tras 3 ofertas pasa a la fase abierta: crea ofertas para el resto de candidatos conectados con `vence_en = creado_en + 120 s`. Cada 15 s en la fase abierta vuelve a pedir candidatos para sumar a los que se conectaron después. Usa `getAdminClient()` solo para las funciones del sistema (CLAUDE.md lo permite para el despacho).
- `solicitarViaje`: acepta `lugarOrigenId` y `lugarDestinoId` (UUID validado); responde 409 si el pasajero ya tiene un viaje activo; al crear, `despachador.iniciar`.
- `aceptarViaje`: llama a `req.supabase.rpc('aceptar_viaje')`; responde 409 "Este viaje ya fue tomado" o "La oferta venció"; borra `revertirAceptacion`. Notifica `viaje_aceptado` al pasajero (nombre, placa y teléfono del conductor) y `oferta_retirada` a los demás.
- `cambiarEstadoViaje`: con `cancelado` sobre un `solicitado`, el trigger cierra las ofertas y el backend llama a `despachador.cancelar` para retirar la oferta de la pantalla del conductor (12).
- `PATCH /api/conductores/disponibilidad` `{ disponible: boolean }` (1). Al pasar a no disponible con una oferta pendiente, la oferta se da por rechazada.
- Sockets: unión automática a `usuario:{id}`; `rechazar_oferta` con `socket.supabase`; `update_location` sin `estado` (R10); al conectar se envía `hora_servidor` para R14.
- `index.js`: `despachador.recuperar()` al arrancar y `setInterval(barrer)`.

## Frontend

- `utils/texto.ts`: `normalizar()` igual que `private.normalizar` (para resaltar coincidencias y validar 2 letras).
- `hooks/useBuscarLugares.ts`: llama a `supabase.rpc('buscar_lugares')` con 250 ms de espera entre teclas, cancela la búsqueda anterior y devuelve como mucho 20 resultados.
- `MapScreen`: ficha de destino con buscador de lugares, lista de sectores y referencia libre como respaldo (20), atribución "© OpenStreetMap" (25) y origen por GPS o por lugar o sector si no hay permiso (21). Estados del viaje: "Buscando tricimoto…" con Cancelar (16, 12), "No hay tricimotos disponibles ahora" con "Volver a pedir", que reusa la última solicitud de `useRideStore` (11), y "aceptado" con los datos del conductor (10).
- `useSocket`: eventos de R12 y desfase de reloj.
- `DriverConsoleScreen`: el interruptor llama al endpoint de disponibilidad; la oferta entrante viene de `oferta_viaje`, con cuenta regresiva desde `venceEn` y distancia; Rechazar emite `rechazar_oferta`; `oferta_retirada` cierra el modal; botones de al menos 56 px de alto, contraste AA, sin blur en modo ligero y aviso de sin conexión (28).
- `AdminPlacesScreen` y `AdminPlaceFormScreen`: buscar, crear, corregir y ocultar. La ubicación se toma tocando el mapa en Android o, en web, desde "mi ubicación" o con campos de latitud y longitud (24).

## Pruebas

| Capa | Archivo | Cubre |
| --- | --- | --- |
| BD | `supabase/tests/rls_003.sql` | 2, 3, 5, 7, 9, 13, 17, 19, 22, 23, 24, 26; transiciones (R4); un pasajero ya no escribe `conductor_id`; `ofertas_viaje` invisible para otros |
| BD | `supabase/tests/concurrencia_003.sh` (lo llama `run-docker.sh`) | 8: dos sesiones `psql` en paralelo aceptan el mismo viaje y solo una gana |
| Backend | `tests/despachador.test.js` (temporizadores falsos de jest y clientes simulados) | 4, 6, 7, 11, 12, 14 y el orden secuencial, luego abierto |
| Backend | `tests/spec003.test.js` | 1, 10, 13, 15, 27 (tamaño del payload y sin teléfono), endpoints de lugares del admin |
| Backend | `tests/importarLugares.test.js` | 22: filtro, genéricos, duplicados y SQL idempotente |
| Frontend | `tests/despacho.test.ts` | normalización, estados de `useRideStore`, cuenta regresiva desde `venceEn` |
| Humo | `npm run smoke` | flujo real: oferta al conductor, rechazo, `sin_conductor`, nueva solicitud, aceptación, chat |

Datos (27): se mide con el guion de humo el tamaño de la oferta y de cada envío de ubicación y se proyecta una jornada de 10 h. El envío cada 5 s ya existe; si la proyección pasa de 15 MB, se sube el intervalo en reposo, no el de la oferta.

## Riesgos

- **Linter:** después de 0011 y 0012, `get_advisors(security)` debe quedar como estaba (solo D-10). Si avisa por `unaccent` o por las funciones, se corrige antes de fusionar.
- **Un solo proceso:** si un día hay 2 instancias del backend, los temporizadores se duplican. El índice R7 evita ofertas dobles, pero escalar exige otra spec.
- **Migración de producción:** 0012 cierra el viaje `solicitado` que quedó de las pruebas. Se revisa con `select` justo antes de fusionar.
- **Conductores en la prueba de humo:** con una sola cuenta de conductor no se prueba la fase abierta en vivo; esa parte queda en las pruebas de jest y de SQL.

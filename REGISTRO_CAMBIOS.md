# Registro de Cambios - CruciDrive (Backend & Frontend)

## HISTORIAL DE LOGS:

## [1.29.0] - 2026-10-09 (Hora Local)

### Paso 003 · T11, oferta y lugares del administrador
- `/api/admin/lugares` (solo admin, con el JWT del usuario):
  - `GET ?q=&visible=`: busca sin tildes y devuelve `lat` y `lng`.
  - `POST`: crea un lugar con nombre, categoría y ubicación; la BD fija fuente, sector y la marca del admin.
  - `PATCH /:id`: corrige, mueve u oculta con `visible: false`. No hay borrado.
- `utils/geo.js`: `puntoDesdeEwkb` lee la ubicación tal como la devuelve Supabase; probada con un punto real de producción.
- `utils/texto.js`: `normalizar`, compartida con el importador de OSM.
- `utils/validation.js`: categorías y largo del nombre, iguales a los CHECK de 0011.

### Pruebas
- 10 nuevas en `spec003.test.js`. La oferta del peor caso pesa menos de 2 KB y no lleva teléfono, identidad ni coordenadas del pasajero. Backend 195/195.

### Estado del backend del 003
- T7 a T11 completas. Siguen las pantallas de la app (T12 a T16), el linter (T17) y la prueba de humo (T18).

---

## [1.28.0] - 2026-10-09 (Hora Local)

### Producción
- **`0012_despacho.sql` aplicada al proyecto real** con la herramienta de Supabase (autorizada por David).
  - El viaje `solicitado` que quedaba de las pruebas del 8 oct quedó `sin_conductor`.
  - Linter de seguridad: solo el aviso conocido de D-10.
  - Comprobado: `authenticated` no ejecuta las funciones del despachador ni puede escribir `conductor_id`, `anon` no ejecuta `aceptar_viaje` y `cerrar_vencidos` corre sin errores.

### Paso 003 · T10, disponibilidad y rechazo
- `PATCH /api/conductores/disponibilidad` `{ disponible }`:
  - Pone la tricimoto en `disponible` o `inactivo`.
  - Responde 403 si el conductor no está aprobado y 409 si tiene un viaje en curso (la tricimoto está `ocupado` y vuelve sola al terminar).
  - Al dejar de estar disponible con una oferta abierta, el despachador pasa al siguiente sin esperar los 15 s.
- Socket `rechazar_oferta` `{ viajeId }`: el conductor rechaza con su propio JWT (`rechazar_oferta` de la 0012) y el despachador pasa al siguiente candidato.

### Pruebas
- 10 nuevas en `spec003.test.js`. Backend 185/185.
- Arranque real contra la BD con la 0012 durante 20 s: despachador iniciado y 4 barridos sin errores.

---

## [1.27.0] - 2026-10-09 (Hora Local)

### Paso 003 · T9, solicitar y aceptar con el despacho
- `POST /api/viajes/solicitar`:
  - Acepta `lugarOrigenId` y `lugarDestinoId`; con un lugar no hace falta enviar coordenadas ni sector, porque la BD los toma del lugar.
  - Responde 409 si el pasajero ya tiene un viaje activo, y 400 claro si el lugar ya no está disponible.
  - Al crear la solicitud arranca el despachador, sin esperar la primera oferta.
- `POST /api/viajes/aceptar`:
  - Usa la RPC atómica `aceptar_viaje` en lugar de los 3 pasos con rollback manual.
  - Responde 409 si el viaje ya fue tomado o la oferta venció, y 403 si el conductor no está aprobado.
  - Avisa al pasajero (`viaje_aceptado`) con nombre, placa y teléfono del conductor, y retira la oferta de los demás.
- `PATCH /api/viajes/:id/estado`: cancelar una solicitud que busca conductor avisa al despachador para retirar las ofertas; un viaje `sin_conductor` ya no se puede cancelar.

### Pruebas
- `tests/spec003.test.js` (13 nuevas). Se quitaron las pruebas del flujo viejo de aceptación en 3 pasos (`viajeController.test.js`, `spec001.test.js`). Backend 175/175.

### Pendiente
- Aplicar `0012` a producción: sin ella, la RPC `aceptar_viaje` no existe.

---

## [1.26.0] - 2026-10-09 (Hora Local)

### Paso 003 · T8, despachador
- `src/despacho/despachador.js`, regla mixta de D-11:
  - Ofrece de uno en uno a los 3 candidatos más cercanos y conectados, 15 s cada uno.
  - Si ninguno acepta, avisa a la vez a los demás hasta los 2 minutos y vuelve a mirar cada 15 s por si se conectó alguien.
  - Cierra como "sin conductor" si no hay candidatos, si todos rechazan o al cumplirse el máximo.
  - Avisa por socket: `oferta_viaje`, `oferta_retirada`, `viaje_aceptado` y `viaje_sin_conductor`.
  - Las tareas de un mismo viaje van en cola, porque el temporizador, el rechazo y el barrido pueden coincidir.
  - Espera lo que le falta a cada oferta según la BD, para no perder 15 s si los relojes difieren.
- `src/despacho/oferta.js`: lo que ve el conductor (personas, total, origen, destino, distancia y vencimiento), sin teléfono ni coordenadas del pasajero.
- `src/despacho/index.js`: arranca con el servidor, retoma las solicitudes pendientes (cierra las de más de 2 minutos) y barre cada 15 s. Sin `SUPABASE_SERVICE_ROLE_KEY` el servidor no arranca.

### Pruebas
- `tests/despachador.test.js` (13 nuevas) con temporizadores falsos y una BD falsa que imita la 0012. Backend 165/165.
- `spec001.test.js` ya no depende de que el `.env` local tenga o no la clave de servicio.

### Pendiente
- Contra producción, el barrido registra errores hasta que se aplique `0012` (no existe `cerrar_vencidos`). Se aplica con la T9.

---

## [1.25.0] - 2026-10-09 (Hora Local)

### Paso 003 · T7, base del despacho en el backend
- `src/despacho/config.js`: lee `DESPACHO_SECUENCIALES` (3), `DESPACHO_OFERTA_SEG` (15), `DESPACHO_MAX_SEG` (120), `DESPACHO_UBICACION_MAX_SEG` (60) y `DESPACHO_BARRIDO_SEG` (15). Un valor fuera de rango, o una fase secuencial que no deja tiempo para el aviso abierto, impide arrancar el servidor. Documentadas en `.env.example`.
- `src/despacho/conexiones.js`: registro de quién tiene un socket abierto (el despachador solo ofrece a conductores conectados).
- Sockets: cada usuario entra a su sala `usuario:{id}` y recibe `hora_servidor` al conectar; `update_location` ya no cambia el estado de la tricimoto (antes la ponía en `disponible` en cada envío, pisando `ocupado`) y avisa al sector con el estado real de la BD.

### Pruebas
- `tests/despachador.test.js` (14 nuevas); `hardening.test.js` ajustada a la sala personal. Backend 152/152.

### Pendiente
- Mientras no llegue `PATCH /api/conductores/disponibilidad` (T10), un conductor no puede ponerse disponible desde la app: T7 a T11 se fusionan juntas.

---

## [1.24.0] - 2026-10-09 (Hora Local)

### Paso 003 · T5, importación de lugares desde OpenStreetMap
- `backend/scripts/importar-lugares.js` (`npm run lugares:importar`):
  - Consulta Overpass con `User-Agent` propio y servidor de respaldo, o lee una respuesta guardada (`--entrada`).
  - Toma la parroquia Crucita más 1,5 km alrededor de cada sector: el límite de OSM no llega a La Boca.
  - Descarta calles, ríos, casas, bosques, divisiones administrativas y nombres genéricos.
  - Asigna categoría y fusiona el mismo lugar mapeado dos veces (mismo nombre a menos de 150 m).
  - Pasa a minúsculas los nombres escritos todo en mayúsculas.
  - Genera una migración idempotente.
- `0013_lugares_osm.sql`: 108 lugares (datos de OSM al 2026-10-09), todos con sector: Malecón 80, Los Arenales 13, Las Gilces 12, La Loma 3, La Boca 2.
- Algunos lugares que existían en OSM en mayo (Cevichería El Manaba, Licorería La Bodega…) ya no están en los datos actuales; el administrador puede añadirlos.

### Pruebas
- `tests/importarLugares.test.js` 14 en verde; backend 138/138. SQL: rls_001 20, rls_002 18, rls_003 60 y concurrencia 1, todo en verde; `0013` aplicada dos veces sin duplicar y respetando una edición del admin.

### Producción
- T6: David aprobó la lista. `0013` aplicada al proyecto real con la herramienta de Supabase: 108 lugares de OSM y 2 de David, todos con sector; `buscar_lugares('farmacia')` devuelve las 4 farmacias.
- `0012` sigue sin aplicar a propósito: va con el backend (T9). Al fusionar el #20 y el #21, la integración de GitHub no aplicó ninguna migración.

---

## [1.23.0] - 2026-10-08 (Hora Local)

### Paso 003 · T3 y T4, despacho (BD)
- `0012_despacho.sql`:
  - Estado `sin_conductor`; `lugar_origen_id` y `lugar_destino_id`, de los que el viaje toma coordenadas, nombre y sector (el cliente no puede mover el lugar).
  - Un viaje activo por pasajero, impuesto por un índice único.
  - Tabla `ofertas_viaje` (sin coordenadas, con distancia en metros) y una oferta pendiente por conductor.
  - `ubicacion_en` y `disponible_desde` en `tricimotos`, mantenidos por triggers.
  - Funciones del sistema `candidatos_despacho`, `crear_ofertas`, `cerrar_vencidos` y `cerrar_sin_conductor` (solo la clave de servicio).
  - Funciones del conductor `aceptar_viaje` (atómica: asigna, ocupa la tricimoto, crea el chat y retira las demás ofertas) y `rechazar_oferta`.
- **Hueco cerrado:** un conductor ya no puede tomar un viaje sin oferta ni un pasajero escribir `conductor_id`. Un trigger valida las transiciones de estado y un conductor solo ve un viaje solicitado si tiene su oferta.
- Al cerrar un viaje, la tricimoto vuelve a `disponible`; al cancelar o quedar sin conductor se cierran sus ofertas; si el conductor deja de estar disponible, suelta su oferta.

### Pruebas
- `rls_003.sql` 60 en verde; `rls_001` (20) y `rls_002` (18) actualizadas: ahora se acepta con oferta y un pasajero no tiene dos viajes activos.
- `concurrencia_003.sh`: dos sesiones aceptan a la vez y solo una gana. `run-docker.sh` la ejecuta.
- La imitación de Supabase da permisos a `service_role`, como en Supabase.

### Pendiente
- `0012` **no** está aplicada al proyecto real: el `POST /api/viajes/aceptar` actual dejaría de funcionar. Se aplica junto con el backend (T9).

---

## [1.22.0] - 2026-10-08 (Hora Local)

### Paso 003 · T2, catálogo de lugares (BD)
- `0011_lugares.sql`: `pg_trgm` y `unaccent` en `extensions`; tabla `lugares` (nombre normalizado, categoría, ubicación, sector por el centro más cercano, fuente `osm`/`admin`/`david`, `osm_id` único, `editado_por_admin`, `visible`); RLS (todos leen lo visible, también visitantes; solo el admin crea, corrige u oculta; nadie borra); `buscar_lugares(q)` con hasta 20 resultados, sin tildes y tolerante a errores leves; semilla de David (Muelle de Crucita, Los Ranchos).
- Una edición del admin queda marcada y una nueva importación de OSM no la pisa.

### Pruebas
- `supabase/tests/rls_003.sql`: 21 en verde en Docker (Postgres 16 + PostGIS). rls_001 (17) y rls_002 (16) siguen en verde.

### Producción
- `0011` aplicada al proyecto real con la herramienta de Supabase (autorizado por David). Linter de seguridad: solo el aviso conocido de D-10. `buscar_lugares('muelle')` responde.

---

## [1.21.0] - 2026-10-08 (Hora Local)

### Paso 003 · plan y tareas (en revisión)
- Spec aprobada al fusionar el PR #18.
- `plan.md`: despachador en el backend con la BD como fuente de verdad (`ofertas_viaje`), aceptación atómica por RPC, catálogo `lugares` con búsqueda por trigramas sin tildes y semilla de OSM como migración generada y revisable.
- **Hueco que se cierra en 0012:** hoy un conductor aprobado puede tomar un viaje libre por la API REST de Supabase sin oferta, y un pasajero puede escribir `conductor_id` en su propio viaje. Se revoca la columna y un trigger valida las transiciones.
- `tasks.md`: 18 tareas, cada una con su prueba.

---

## [1.20.0] - 2026-10-08 (Hora Local)

### Paso 003 · spec de despacho y catálogo de lugares (en revisión)
- `specs/003-despacho/spec.md`: disponibilidad real del conductor, asignación por distancia, aceptación atómica, cierre "sin conductor" a los 2 minutos, cancelación mientras busca, registro de ofertas sin coordenadas y catálogo de lugares desde OpenStreetMap con búsqueda tolerante a tildes y errores (D-09).
- **D-11** (David): asignación mixta, de uno en uno a los 3 más cercanos (15 s cada uno) y luego aviso abierto a los demás disponibles. Añadida a la constitución.
- Consulta a OpenStreetMap: unos 180 lugares con nombre en Crucita y alrededores, con duplicados y lugares fuera de la parroquia que hay que filtrar.

---

## [1.19.0] - 2026-10-08 (Hora Local)

### Cierre del paso 002
- **Prueba de humo con 3 cuentas (pasajero, conductor y administrador): 28 de 28 pasos OK.** Cubre consentimiento obligatorio, fotos privadas (y que nadie sube a la carpeta de otro), cédula con dígito verificador, conductor sin aprobar que no puede aceptar viajes ni usar el panel, aprobación del administrador con enlace firmado, viaje de 3 pasajeros con tarifa 1,50, chat en vivo y finalizado.
- La primera ejecución falló en cascada por un error del guion: el conductor de prueba usaba el teléfono `0990000002`, que el administrador conserva de una prueba anterior (`perfiles.telefono` es único). Ahora usa `0990000003`.
- La cuenta del conductor se había creado con "Invite user" y por eso no tenía contraseña; se recreó con "Create new user" y "Auto Confirm User".
- El perfil del administrador se renombró de "Conductor Prueba" a "Administrador".

### Pendiente (no es del 002)
- La consola del conductor aún no recibe solicitudes de viaje (`setIncomingRequest` nunca se alimenta) y no hay despacho: eso es el paso 003.

---

## [1.18.0] - 2026-10-08 (Hora Local)

### Paso 002 · pantallas de identidad (frontend)
- **Cuenta:** inicio de sesión y creación de cuenta con correo y contraseña (mínimo 8, validado en la app y exigido por Supabase Auth); reemplaza el SMS. Tras crear la cuenta, "Completa tu perfil": rol, nombre, teléfono, placa (conductor) y consentimiento LOPDP con el aviso de privacidad v0.1 a la vista.
- **Verificación del conductor:** cédula validada con dígito verificador y 3 fotos (tomadas con la cámara o de la galería) que se reducen a ≤ 1280 px y JPEG 0,6 antes de subirse al bucket privado; estados sin enviar, pendiente, rechazado con motivo (y reenvío) y aprobado.
- **Panel del administrador:** lista de solicitudes pendientes, detalle con las 3 fotos (enlaces de 5 min), aprobar con confirmación y rechazar con motivo.
- **Navegación por rol** (`app/_layout.tsx` + `utils/routing.ts`): sin sesión solo mapa y login; sin perfil, "Completa tu perfil"; un conductor sin aprobar solo ve su verificación; un pasajero no ve los paneles de conductor ni de administrador. El mapa público muestra "Entrar" o "Mi cuenta" y pedir un viaje sin cuenta lleva al login.
- **Corrección:** `fetchProfile` pedía columnas que no existen (`estado_operativo`, `calificacion`, `avatar_url`), así que el perfil nunca cargaba y nadie podía pasar del login.
- **Hook de sesión:** el arranque (restaurar sesión y escuchar cambios) corre una sola vez, en el layout raíz; antes cada pantalla creaba su propia suscripción.
- **Dependencias:** `expo-image-picker` y `expo-image-manipulator` (SDK 57) con permisos de cámara y galería en `app.json`.

### Pruebas
- Frontend 114/114, sin errores de tipos en `src/` ni `app/`. Revisado en el navegador: login, crear cuenta y perfil (conductor, aviso de privacidad, errores de validación), sin errores en consola.

### Pendiente
- T14: ejecutar `npm run smoke` con 3 cuentas (el conductor `jcevallos6547@utm.edu.ec` debe confirmar su correo) y revisar las pantallas del conductor y del administrador con sesiones reales.

---

## [1.17.0] - 2026-10-08 (Hora Local)

### Paso 002 · identidad y aprobación de conductores (BD y backend)
- **BD (`0010_identidad.sql`, aplicada al proyecto real):** tabla `consentimientos` (de solo anexar; la fecha la fija la BD; sin consentimiento no hay perfil), `conductores_verificacion` (cédula única, rutas de fotos dentro de la carpeta del conductor, estado pendiente/aprobado/rechazado, quién y cuándo revisó), funciones `es_conductor_aprobado` y un trigger que devuelve a "pendiente" una solicitud rechazada que el conductor corrige.
- **Un conductor sin aprobar no opera, y lo impide la BD**, no solo el backend: no puede ponerse disponible, actualizar ubicación, ver viajes solicitados ni aceptar.
- **Storage:** bucket privado `verificacion` (1 MB, solo JPEG); el conductor sube a su carpeta y el administrador lee todo. Nadie más.
- **Backend:** registro con consentimiento obligatorio; `POST/GET /api/conductores/verificacion`; `/api/admin/conductores` (listar, detalle con enlaces firmados de 5 min, aprobar, rechazar con motivo); validación de cédula ecuatoriana; el socket avisa si un conductor no está aprobado.
- **Primer administrador:** `jimdav1506ceva@gmail.com` (`supabase/one-off/2026-10-08_primer_admin.sql`). Se borraron los datos de la prueba de humo anterior (1 viaje, 1 chat, 1 mensaje y la tricimoto de esa cuenta).
- **Pruebas:** `supabase/tests/run-docker.sh` ejecuta las suites SQL en Docker (rls_001: 17 en verde; rls_002: 16 en verde, más los bloqueos esperados). La prueba detectó y corrigió un fallo real: un conductor rechazado no podía reenviar sus datos. Backend 124/124.
- **Prueba de humo:** `npm run smoke` ahora cubre todo el 002 (reemplaza a `smoke-001.js`) y necesita 3 cuentas.

### Pendiente
- T8 a T10 (pantallas de registro, verificación y panel de administrador), T12 (contraseña mínima en Supabase, la hace David) y T14 (ejecutar la prueba de humo con 3 cuentas).

---

## [1.16.0] - 2026-10-08 (Hora Local)

### Frontend: pulido de interfaz (impeccable + design-taste + emil-design-eng)
- **Legibilidad:** el cristal pasa de blanco al 7 % a `glassSurface` (negro azulado al 82 %), que cumple contraste AA sobre cualquier mapa. Mapa nativo con estilo nocturno de Google; versión web con OpenStreetMap y velo oscuro (sin filtro CSS, que era costoso de pintar) y atribución visible.
- **Honestidad de la interfaz:** la barra "¿A dónde vas?" era texto decorativo; ahora es una píldora de estado ("Estás en …" / "Activa tu ubicación") y la pregunta vive en la ficha de destinos.
- **SOS:** sube arriba a la derecha (ya no se monta sobre la ficha), relleno de progreso mientras se mantiene (2 s lineal, 200 ms al soltar), un solo anillo de latido lento y apagado con "reducir movimiento".
- **Movimiento:** entradas de 220 ms con ease-out y salidas de 140 ms (antes 400 a 500 ms con retardos de 200 a 400 ms); `PressableScale` con respuesta táctil asimétrica 100/160 ms.
- **Botones accesibles:** `GlassButton` ya no depende de `Gesture.Tap` (no respondía al clic ni al teclado en web); usa `PressableScale`.
- **Layout:** márgenes de zona segura arriba y abajo, ficha centrada con ancho máximo 520 en pantallas anchas, numerales tabulares en precio y contador.
- **Corrección:** la región inicial del mapa (`config.ts`) seguía en las coordenadas viejas, ~19 km al sur de Crucita; ahora enmarca los 5 sectores.
- Sin guiones largos en el texto visible; `absoluteFillObject` (inexistente en RN 0.86) reemplazado.
- Recuperado de la rama anterior: registro 1.14.0 y cierre de T16 en `tasks.md` y `specs/README.md` (no habían llegado a `main`); la entrada 1.15.0 no se había escrito.

### Pruebas
- Frontend 72/72; sin errores de tipos en `src/` ni `app/`. Verificado en el navegador integrado a tamaño de teléfono y de escritorio.

---

## [1.15.0] - 2026-10-08 (Hora Local)

### Corregido (frontend web, detectado al abrir la app en el navegador; PR #12)
- `#root` medía 0 de alto: los paneles pegados abajo (selector de destino y ficha del viaje) quedaban fuera de la pantalla. `public/index.html` ahora da altura completa a `html`, `body` y `#root`.
- Las fuentes se registraban como `Outfit-Regular`, `Inter-Medium`… pero los estilos piden `Outfit` e `Inter`: todo el texto caía a serif. Se añadieron los alias en `app/_layout.tsx`.
- El service worker de la PWA servía el paquete viejo en desarrollo; ya no se registra en `localhost`.

### Añadido
- `.claude/launch.json` con `backend` (puerto 3000) y `frontend-web` (puerto 8081) para previsualizar.

---

## [1.14.0] - 2026-10-08 (Hora Local)

### Verificado (T16, cierra el paso 001)
- Prueba de humo `npm run smoke` con 2 usuarios reales contra Supabase: 11/11 pasos OK (registro de pasajero y conductor, solicitud de 3 pasajeros con tarifa 1,50 fijada por la BD, aceptación, chat por socket e historial REST, `en_curso`, `finalizado`).
- Datos de prueba que quedan en la BD: 2 perfiles, 1 tricimoto, 1 viaje finalizado, 1 hilo de chat con 1 mensaje.
- Pendiente del 001: solo T18 (deuda de tipos del frontend), que pasa a `007-hardening`.

---

## [1.13.0] - 2026-10-08 (Hora Local)

### Cambiado
- **Sectores definitivos** (`0009_sectores_definitivos.sql`, aplicada al proyecto real): La Boca, Las Gilces, Los Arenales, Malecón de Crucita (las letras) y La Loma (parapente), con pines reales de Google Maps. Se retiran Centro, Playa y San Jacinto. Frontend (`sectors.ts`) y pruebas alineados.
- Puntos extra para el catálogo de lugares del paso 003 (D-09): Los Ranchos (−0,84971; −80,53152) y Muelle de Crucita (−0,84791; −80,53351).
- El guion de humo muestra un mensaje claro cuando el backend no está corriendo.

---

## [1.12.0] - 2026-10-08 (Hora Local)

### Corregido
- **Centros de sector con pines reales de Google Maps** (`0008_centros_sectores_reales.sql`, aplicada al proyecto real): Crucita (−0,86298; −80,53691), La Boca (−0,80148; −80,52098) y Las Gilces (−0,82141; −80,52406). Las Gilces y La Boca están ~4 y ~7 km al norte del centro; mi ubicación provisional de la 1.11.0 era incorrecta. Playa, Los Arenales y San Jacinto siguen provisionales.

### Decidido
- **D-09** Selector de negocios con catálogo propio desde OpenStreetMap, sin API de pago (se especifica en 003). **D-10** Protección de contraseñas filtradas de Supabase: pospuesta para no pagar plan; queda abierta.

---

## [1.11.0] - 2026-10-08 (Hora Local)

### Cambiado (decisión D-08: 0,50 USD por persona, sin precio por ruta)
- **BD (`0007_tarifa_por_persona.sql`, aplicada al proyecto real):** se eliminan `tarifas` y `obtener_tarifa`; `zonas.precio_por_persona` (0,50); `viajes.pasajeros`, `origen_descripcion` y `destino_descripcion`; trigger `private.fijar_tarifa_viaje` que fija `tarifa = precio × pasajeros` e ignora lo que envíe el cliente; sector nuevo `la_boca`.
- **Coordenadas de sectores corregidas:** estaban ~19 km al sur de Crucita (lat −1,04). Ahora giran en torno al punto de la parroquia (−0,8706; −80,5375). **Son provisionales**; La Boca es aproximada. Pendiente T22b.
- **Backend:** `POST /api/viajes/solicitar` acepta `pasajeros` (1–20), `sectorOrigenId`, `sectorDestinoId`, `origenDescripcion`, `destinoDescripcion`; ya no inserta `tarifa` (antes fijaba 1,50 para todos).
- **Frontend:** `MapScreen` con selector de pasajeros, total en vivo y referencia de destino en texto; `sectors.ts` sin matriz de tarifas (`calculateFare`, `PRICE_PER_PERSON_USD`); consola del conductor muestra personas y referencia.

### Corregido
- `MapScreen` enviaba `sector_origen`/`sector_destino`, pero el backend exige `origen`/`destino` con coordenadas: toda solicitud de viaje devolvía 400. Ahora envía el payload correcto.

### Pruebas
- Backend 89/89, frontend 71/71, SQL/RLS 17/17 (Postgres 16 + PostGIS en Docker). `get_advisors(security)`: solo avisa "Leaked Password Protection" (ajuste del panel de Supabase).

---

## [1.10.0] - 2026-10-08 (Hora Local)

### Verificado en producción (Supabase)
- Limpieza única ejecutada y migraciones 0001–0006 aplicadas por la integración Supabase–GitHub al fusionar #7.
- 9 tablas con RLS, 20 políticas, semilla de Crucita (5 sectores, 10 tarifas), `obtener_tarifa` simétrica, PostGIS en `extensions`.
- Linter de seguridad de Supabase: 0 hallazgos (antes 1 ERROR y 2 WARN).

### Seguridad
- `npm audit fix` en backend: 0 vulnerabilidades en dependencias de producción (proxy-addr crítica, engine.io, socket.io-parser, qs). CI con `npm audit --omit=dev --audit-level=high`.

### Añadido
- `CLAUDE.md`: reglas de la constitución, flujo por specs, reglas de BD/backend y comandos para Claude Code.

---

## [1.9.0] - 2026-10-08 (Hora Local)

### Integrado (sustituye a los PR #1 y #2, que tenían conflictos con `main`)
- **PR #1 · manejo de errores:** frontend envía `viajeId` (antes `viaje_id`) y lee `data.data` (antes `data.viaje`/`data.messages`); alertas al usuario en solicitar/aceptar viaje; `useSocket` no emite si no hay conexión; rollbacks registran su propio fallo; 404 y manejador global de errores; sockets sin perfil se rechazan en vez de asumir "pasajero".
- **PR #2 · endurecimiento:** helmet, CORS con lista blanca (`ALLOWED_ORIGINS`), límite de cuerpo, rate limiting, `errorResponse` sin detalles internos, validación de coordenadas, UUID, nombre, teléfono, placa, sector y longitud de mensajes (REST y sockets).
- **Ajustes propios:** límites de rate limit holgados por CGNAT y configurables; `TRUST_PROXY`; placa validada con el mismo patrón que la BD (el formato ecuatoriano `ABC-1234` del PR #2 no aplica a todas las tricimotos); app Express separada en `src/app.js` para probarla.

### Pruebas
- Nuevo `tests/hardening.test.js`. Backend 80/80, frontend 69/69.

---

## [1.8.0] - 2026-10-08 (Hora Local)

### Añadido
- **Paso 001 (spec aprobada):** `plan.md` y `tasks.md`; migraciones `supabase/migrations/0001` a `0006` (PostGIS en `extensions`, catálogo `zonas`/`sectores`/`tarifas` con semilla de Crucita, `tricimotos`, RLS con permisos por columna); limpieza única en `supabase/one-off/`.
- **CI:** `.github/workflows/ci.yml` (tests de backend y frontend) y `supabase-keepalive.yml` (lectura cada 3 días).
- **Backend:** `createUserClient(jwt)` y `getAdminClient()` en `config/supabase.js`; `authMiddleware` adjunta `req.supabase`; sockets usan `socket.supabase`. Nuevo `tests/spec001.test.js`.
- `backend/.env.example`.

### Corregido
- `asyncHandler` no devolvía la promesa: 18 tests fallaban en `main`. Ahora backend 56/56 y frontend 69/69.
- Código alineado al esquema: `thread_members` sin columna `id`, `threads.created_by`, sin `updated_at` manual (trigger), `aceptado_en`/`finalizado_en`, placa normalizada, validación de `destino.lng`.

### Decidido
- D-02 Google Maps · D-03 solo tricimotos · D-04 conductores aprobados por admin · D-05 SOS llama al 911 · D-06 cliente por usuario (ver `specs/constitution.md`).

### Pendiente
- Ejecutar la limpieza única y aplicar las migraciones en Supabase (requiere confirmación). `backend/database.sql` marcado como obsoleto.

---

## [1.7.0] - 2026-10-08 (Hora Local)

### Añadido
- **Spec-Driven Development:** creada carpeta `specs/` con `README.md` (índice de los 8 pasos), `constitution.md` y `001-cimientos/spec.md` (borrador).
- **EAS:** `frontend/app.json` enlazado al proyecto de Expo (`extra.eas.projectId`); creado `frontend/eas.json` con perfiles `development`, `preview` (APK) y `production`.

### Analizado
- **Auditoría de Supabase** (proyecto reactivado tras pausa por inactividad): falta la tabla `tricimotos`, `perfiles` y `viajes` con RLS sin políticas, backend con clave anon sin JWT de usuario, columna `messages.body` vs `content` en código, 0 migraciones. Detalle en `specs/001-cimientos/spec.md`.
- **Estado:** pendiente de aprobación de la spec 001. Sin cambios aplicados a la BD.

---

## [1.6.0] - 2026-07-01 20:30 (Hora Local)

### Añadido
- **Implementación Completa de la UI y Lógica del Frontend (Expo / React Native / TypeScript):**
  - **Sistema de Diseño (Glassmorphism & Componentes Visuales):**
    - Centralizados los tokens de diseño (colores, fuentes Outfit/Inter, espaciado de 4/8dp, formas, sombras, efectos visuales y constantes de animación) en el archivo de constantes [theme.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/constants/theme.ts).
    - Creados componentes reutilizables de cristal con soporte de desenfoque (`expo-blur`) y gradientes (`expo-linear-gradient`): [GlassCard.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/GlassCard.tsx), [GlassButton.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/GlassButton.tsx), [GlassInput.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/GlassInput.tsx), [BlurContainer.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/BlurContainer.tsx), [PanicButton.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/PanicButton.tsx) (con animación de pulsación y retención de 2 segundos para emergencias SOS) y [LoadingSpinner.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/LoadingSpinner.tsx).
  - **Manejo de Estado Global (Zustand Stores):**
    - [useAuthStore.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/store/useAuthStore.ts): Gestión de sesión, autenticación y persistencia local mediante AsyncStorage.
    - [useLocationStore.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/store/useLocationStore.ts): Almacenamiento de geolocalización en tiempo real, sector identificado y estado de disponibilidad del conductor.
    - [useRideStore.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/store/useRideStore.ts): Ciclo de vida y estados del viaje (`solicitado`, `aceptado`, `en_ruta`, `completado`, `cancelado`).
  - **Hooks de Integración (Supabase, WebSockets, Geolocalización y Tarifas):**
    - [useSupabaseAuth.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useSupabaseAuth.ts): Flujo de autenticación telefónica sin contraseña (OTP simulado) contra Supabase.
    - [useSocket.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useSocket.ts): Conectividad bidireccional en tiempo real con Socket.io del backend para chat, seguimiento de ubicación e interacciones de viaje.
    - [useLocation.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useLocation.ts): Rastreo de geolocalización en primer plano y en segundo plano (optimizado para batería) con detección y mapeo de geocercas locales.
    - [useTariff.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useTariff.ts): Cálculo de tarifa fija según la geocerca de origen y destino basándose en el mapeo de sectores en [sectors.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/constants/sectors.ts).
  - **Pantallas Clave de la Aplicación:**
    - [LoginScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/LoginScreen.tsx): Pantalla de acceso mediante número de teléfono con diseño Glassmorphic.
    - [MapScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/MapScreen.tsx): Mapa a pantalla completa, caja flotante de destino, Bottom Sheet translúcido con cálculo de tarifa/búsqueda de conductor y botón de pánico SOS integrado.
    - [DriverConsoleScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/DriverConsoleScreen.tsx): Consola del conductor con switch de disponibilidad, recibidor de solicitudes entrantes de viajes con contador de 15 segundos y control de estados del servicio.
    - [ChatScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/ChatScreen.tsx): Panel de mensajería en tiempo real y persistente entre conductor y pasajero, suscrito a salas de WebSocket exclusivas.
  - **Enrutamiento y Navegación Dinámica con Expo Router (File-Based):**
    - Configurado el layout raíz [_layout.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/app/_layout.tsx) para cargar fuentes de Google Fonts (Outfit, Inter) y proveer el contexto global de la sesión.
    - Definidas rutas para autenticación en `(auth)` y flujos protegidos diferenciados por rol en `(app)/(passenger)` y `(app)/(driver)`.
  - **Configuración de Proyecto y Dependencias:**
    - Inicializado el proyecto con Expo SDK 57, configurando [app.json](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/app.json), [tsconfig.json](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/tsconfig.json), [package.json](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/package.json), [.env.example](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/.env.example) e [index.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/index.ts).
  - **Archivos Modificados:** `/REGISTRO_CAMBIOS.md`.
  - **Archivos Creados (Frontend):** Todos los archivos bajo `/frontend` detallados arriba.
  - **Estado:** Completado y listo para pruebas de integración de punta a punta (End-to-End).

## [1.5.0] - 2026-07-01 18:10 (Hora Local)

### Añadido
- **Definición del Sistema de Diseño (Glassmorphism & Google Stitch):**
  - Creado archivo `DESIGN.md` en la raíz del proyecto para definir los tokens del tema (colores translúcidos, tipografía, bordes de cristal, sombras, efectos de desenfoque e intensidades) y guías visuales de componentes clave (Login, Mapa, Ficha de Viaje, Botón de Pánico y Chat).
  - Actualizado `masterPrompt.md` en la raíz del proyecto para establecerlo como el Master Prompt definitivo e integrar la directriz del frontend, instruyendo el uso de `DESIGN.md` para evitar el desplazamiento de estilos.
  - **Archivos Modificados:** `/DESIGN.md`, `/masterPrompt.md`, `/REGISTRO_CAMBIOS.md`.
  - **Estado:** Completado y listo para que cualquier agente de IA o diseñador proceda a generar la UI móvil.

## [1.4.0] - 2026-07-01 17:40 (Hora Local)

### Añadido
- **Implementación completa de API REST y WebSockets para MVP:**
  - Instalado `socket.io` como dependencia del backend.
  - Creado `backend/database.sql` conteniendo el script de creación de tablas, PostGIS e índices.
  - Creados middlewares de seguridad `authMiddleware.js` (validación JWT Supabase) y `roleMiddleware.js` (RBAC).
  - Creados controladores `authController.js`, `viajeController.js`, `chatController.js` y expuestas sus respectivas rutas REST protegidas.
  - Creado `socketHandler.js` para gestionar eventos en tiempo real (Tracking GPS de conductores, suscripción a geocercas locales y chat instantáneo).
  - Reestructurado `index.js` para iniciar el servidor Express acoplado de forma híbrida con Socket.io.
  - **Verificación:** Ejecución de pruebas locales de conexión a Supabase y peticiones HTTP completada exitosamente.
  - **Estado:** Completado y listo para integración con el frontend.

## [1.3.0] - 2026-07-01 17:30 (Hora Local)

### Analizado
- **Análisis de preparación de Backend para Frontend:**
  - Realizado un escaneo del monorepo y contrastado con las directrices de `ESTRUCTURA.md`, `PLAN.md`, `SEGURIDAD.md`, y `BASE_DE_DATOS_Y_BACKEND.md`.
  - Creado reporte de análisis en `backend_analysis.md`.
  - **Estado:** Completado (Pendiente de decisión sobre Prisma/Supabase y estado de BD en Supabase).


## [1.2.0] - 2026-06-30 13:20 (Hora Local)

### Reestructurado
- **Reorganización del monorepo según `ESTRUCTURA.md`:**
  - Migrado todo el código backend (`src/`, `package.json`, `package-lock.json`, `.env`, `.env.example`) desde la raíz a `./backend/`.
  - Eliminado `node_modules/` de la raíz y reinstalado dependencias dentro de `./backend/`.
  - Creados directorios faltantes del backend: `src/middlewares/`, `src/models/`, `src/sockets/` (con `.gitkeep`).
  - Creado scaffolding completo del frontend en `./frontend/src/` con 9 subdirectorios: `assets/`, `components/`, `constants/`, `hooks/`, `navigation/`, `screens/`, `store/`, `styles/`, `utils/` (todos con `.gitkeep`).
  - Actualizado `.gitignore` de raíz para cubrir rutas de monorepo (`backend/.env`, `frontend/.expo/`, etc.) y exclusiones de Expo/React Native.
  - **Verificación:** Backend carga correctamente desde `./backend/` con `npm install` y conexión a Supabase validada.
  - **Estado:** Completado.

---

## [1.1.0] - 2026-06-30 13:12 (Hora Local)

### Añadido
- **Documentación base del proyecto desde `masterPrompt.md`:**
  - Creado `ARQUITECTURA.md` — Definición técnica del stack, patrones de diseño y directriz de UI (Glassmorphism).
  - Creado `PLAN.md` — Fases de ejecución iterativa del MVP (Fase 1 a Fase 5).
  - Creado `CASOSDEUSO.md` — Requerimientos funcionales por actor (Pasajero, Conductor, Administrador).
  - Creado `ESTRUCTURA.md` — Árbol de directorios del monorepo (`/backend`, `/frontend`) con convenciones.
  - Creado `SKILLS.md` — Reglas técnicas obligatorias para el agente de IA.
  - Creado `SEGURIDAD.md` — Directrices de seguridad y cumplimiento LOPDP (Ecuador).
  - **Archivos Modificados:** `REGISTRO_CAMBIOS.md` (actualizado con esta entrada).
  - **Estado:** Completado.

---

## [1.0.0] - 2026-06-30 13:08 (Hora Local)

### Añadido
- **FASE 1: Inicialización de Git y GitHub:**
  - Repositorio Git inicializado localmente (`git init`).
  - Configurado `user.name` como "DavidCevallos15" y `user.email` como "jimdav1506ceva@gmail.com".
  - Creado y configurado el archivo `README.md` inicial.
  - Subido el commit inicial a la rama `main` del repositorio remoto `https://github.com/DavidCevallos15/Crucidrive---APP.git`.
- **FASE 2: Estructura de Node.js y Dependencias:**
  - Proyecto Node.js inicializado (`npm init -y`).
  - Instaladas dependencias principales de producción: `express`, `cors`, `dotenv`, `@supabase/supabase-js`.
  - Instalada dependencia de desarrollo: `nodemon`.
  - Configurado script de desarrollo `"dev": "nodemon src/index.js"` en `package.json` para facilitar la ejecución interactiva.
- **FASE 3: Arquitectura y Conexiones:**
  - Creado archivo `.gitignore` para excluir estrictamente `.env`, `node_modules` y directorios temporales de editores.
  - Creado `.env.example` como plantilla para configuración de puerto y Supabase.
  - Creado `.env` con las claves reales suministradas para el desarrollo local (nunca subidas a Git).
  - Estructurado el archivo de conexión `src/config/supabase.js` que inicializa el cliente de Supabase usando variables de entorno.
  - Creados los directorios de arquitectura limpia `src/controllers/` y `src/routes/` con archivos `.gitkeep` correspondientes.
  - Creado punto de entrada `src/index.js` para levantar el servidor Express en el puerto 3000 con un endpoint de health check `/` que verifica la conectividad a la API de Supabase.

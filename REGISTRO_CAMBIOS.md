# Registro de Cambios - CruciDrive (Backend & Frontend)

## HISTORIAL DE LOGS:

## [1.46.0] - 2026-10-09 (Hora Local)

### Paso 004 · T10, ubicación del conductor en segundo plano
- `src/tareas/ubicacionFondo.ts`: tarea de `expo-location` con servicio en primer plano y aviso permanente ("CruciDrive está usando tu ubicación"). Se define en `index.ts`, antes de Expo Router, para que exista si Android relanza la app sin interfaz.
- Frecuencia adaptativa (`src/utils/seguimiento.ts`, D-13): pide una posición cada `fondoMovSeg` y solo la envía si se movió más de 15 m o si pasaron `fondoQuietoSeg`. Las frecuencias llegan en la respuesta de disponibilidad; si no son válidas se usan las de por defecto.
- `src/servicios/canalUbicacion.ts`: un solo canal para la consola y la tarea. Usa el socket si está conectado y, si no, `POST /api/conductores/ubicacion` con el JWT guardado. Un 403 o la falta de sesión apagan el seguimiento.
- Arranque y parada (`useSeguimientoFondo`): sigue con `disponible` u `ocupado` y se detiene con `inactivo` y al cerrar sesión.
- `PermisoUbicacionScreen`: explicación propia antes del diálogo del sistema (qué, para qué, cuándo se detiene). Si el conductor no concede el permiso, la consola muestra "Solo recibirás ofertas con la app abierta" con un botón a los ajustes.
- Cambio en la consola: con la app abierta ahora también envía la ubicación cuando está **ocupado**, para que el pasajero vea a su conductor. La frecuencia la fija el servidor (`abiertaSeg`).
- `app.json`: `isAndroidForegroundServiceEnabled` y el texto del permiso "todo el tiempo".

### Pruebas
- 26 nuevas en `tests/avisos.test.ts`. Frontend 218/218. Sin errores de tipos en `src/` ni `app/`.

### Pendiente
- Revisión en el APK de los criterios 1, 3 y 4: necesita la T8 y va con la T17. En Expo Go no hay ubicación en segundo plano; la consola muestra el aviso de "solo con la app abierta".

---

## [1.45.0] - 2026-10-09 (Hora Local)

### Paso 004 · T9, avisos en la app
- Dependencias nuevas con `npx expo install` (las justifica el plan del 004): `expo-notifications` y `expo-task-manager` (esta la usa la T10). `npm audit --omit=dev` lista los mismos paquetes que antes.
- `app.config.js` extiende `app.json` (P21):
  - `android.googleServicesFile` sale de la variable de archivo `GOOGLE_SERVICES_JSON` de EAS o, en local, de `frontend/google-services.json` si existe. Sin ninguno, la app compila sin avisos.
  - Plugin `expo-notifications` con el ícono monocromo y el color de la marca.
  - `google-services.json` va en `.gitignore`.
- `src/servicios/avisos.ts`: canales de Android `ofertas` (importancia máxima) y `viaje`, y token de Expo. En la web y en Expo Go no hay token, y la app sigue igual.
- `src/servicios/registroAvisos.ts`: registro y borrado del token (criterio 11). Se registra al tener sesión con perfil y se borra al cerrar sesión, antes de invalidar el JWT. Las dos operaciones van en cola para que un inicio y un cierre seguidos no se crucen.

### Pruebas
- `tests/avisos.test.ts`: 12 pruebas con una API simulada. Frontend 192/192. `npx expo config --type public` sin errores, con y sin `google-services.json`.

### Pendiente
- Para que lleguen avisos al APK falta la T8 de David (Firebase y clave FCM V1 en EAS).

---

## [1.44.0] - 2026-10-09 (Hora Local)

### Paso 004 · T7, consentimiento 0.2
- Texto 0.2 en `consentimiento-lopdp.md`, `consent.js` y `consentimiento.ts`:
  - Ubicación del conductor en segundo plano mientras está disponible, con un aviso permanente en el teléfono.
  - Identificador del teléfono para avisos, que se borra al cerrar sesión.
  - Durante el viaje, el pasajero ve a su conductor y nadie más.
  - Expo y Google entregan los avisos, sin datos del pasajero.
  - **Corrección:** la 0.1 decía que se guardaba un historial de ubicaciones con un identificador anónimo. En realidad solo se guarda la última posición.
- `PATCH /api/conductores/disponibilidad` con `disponible: true` responde 428 si el conductor no aceptó la versión vigente. Dejar de estar disponible no lo exige.
- `POST /api/auth/consentimiento { consentimiento: true }` registra la versión que fija el servidor.
- `npm run smoke` acepta la 0.2 antes de probar la disponibilidad.

### Pruebas
- 6 nuevas en `spec004.test.js`. Las pruebas de disponibilidad del 003 incluyen la consulta de consentimiento. Backend 275/275 y frontend 180/180.

### Pendiente
- La pantalla de la app que pide la 0.2 es la T13. Hasta entonces, un conductor con la 0.1 recibe 428 al ponerse disponible desde la app.

---

## [1.43.0] - 2026-10-09 (Hora Local)

### Paso 004 · T6, el despacho envía avisos
- **Candidato (P5, enmienda de R6 del 003):** socket conectado **o** teléfono registrado para avisos. La ubicación de menos de 60 s la sigue exigiendo la BD.
  - Solo se consulta quién tiene teléfono cuando hay candidatos sin socket.
- Cada oferta sale por socket y por aviso (P6; la app descarta el aviso si está abierta).
- Avisos de retirada al vencer, al cancelar el pasajero o al perder la carrera; al pasajero, avisos de aceptado y de sin conductor.
- Los avisos se envían sin esperar el resultado. Si fallan, o falla la lectura de teléfonos, el despacho sigue por el socket (criterio 12).

### Pruebas
- 9 nuevas en `despachador.test.js`. Backend 269/269.

---

## [1.42.0] - 2026-10-09 (Hora Local)

### Paso 004 · T5, avisos de Expo en el backend
- `src/avisos/expo.js`: cliente de la API de Expo con `fetch`, sin SDK (regla 8).
  - Lotes de 100, límite de 5 s y sin reintentos.
  - `EXPO_ACCESS_TOKEN` opcional (seguridad reforzada).
  - Devuelve los tokens con `DeviceNotRegistered` para borrarlos.
- `src/avisos/mensajes.js`: oferta (personas, total, origen y destino, sin datos del pasajero; caduca con la oferta), retirada (aviso de datos, sin texto), aceptado y sin conductor.
- `src/avisos/index.js`: lee los tokens con la clave de servicio, envía sin que el despacho espere (criterio 12) y borra los tokens muertos (11).
- `POST /api/dispositivos` y `DELETE /api/dispositivos/:token`, con el JWT del usuario.
- `.env.example`: `EXPO_ACCESS_TOKEN` y `AVISOS_ACTIVOS`.

### Pruebas
- `tests/avisos.test.js`: 25 nuevas. Backend 260/260.

---

## [1.41.0] - 2026-10-09 (Hora Local)

### Paso 004 · T4, el pasajero ve a su conductor
- Con el conductor `ocupado`, cada envío de ubicación (socket o REST) va como `conductor_ubicacion { viajeId, lat, lng, en }` **solo** a la sala del pasajero de su viaje `aceptado` o `en_curso` (criterios 13 y 14).
- **Cambio de comportamiento (criterio 14):** la posición de un conductor ocupado ya no se reenvía a todo el sector, con su nombre, como pasaba desde el 001.
- `inactivo`: no se reenvía a nadie. Al terminar el viaje la tricimoto vuelve a `disponible` y el pasajero deja de recibirla (15).

### Pruebas
- 6 nuevas en `spec004.test.js`. Backend 235/235.
- `despachador.test.js` (R10 del 003) ahora usa un conductor disponible, porque el caso ocupado cambió por el criterio 14.

---

## [1.40.0] - 2026-10-09 (Hora Local)

### Paso 004 · T3, ubicación del conductor por socket y por REST
- `src/ubicacion/servicio.js`: un solo camino para guardar la última posición y reenviarla al sector. Lo usan el socket (`update_location`, la vía normal) y el nuevo `POST /api/conductores/ubicacion` (respaldo cuando la app está en segundo plano y el socket se cayó).
  - Este respaldo responde 204 sin cuerpo.
  - Tiene un límite de 2 envíos cada 5 s por conductor (no por IP, por el CGNAT).
- `src/ubicacion/config.js`: `UBICACION_ABIERTA_SEG=5`, `UBICACION_FONDO_MOV_SEG=10` y `UBICACION_FONDO_QUIETO_SEG=30` (D-13).
  - La app los recibe en la respuesta de `PATCH /api/conductores/disponibilidad`.
  - El servidor no arranca si el valor de detenido no cabe en la ventana de 60 s del despacho.
- `app.set('io', io)`: los controladores REST pueden reenviar por socket.

### Pruebas
- `tests/spec004.test.js`: 18 nuevas, entre ellas que el socket y el REST dan el mismo resultado y que el tercer envío en 5 s recibe 429. Backend 229/229.

---

## [1.39.0] - 2026-10-09 (Hora Local)

### Paso 004 · T2, migración 0014 (avisos y privacidad de la ubicación)
- `dispositivos_push`: los tokens de avisos solo se escriben con `registrar_dispositivo` y `olvidar_dispositivo`.
  - Si el teléfono cambia de cuenta, el token pasa a la nueva (criterio 11).
  - Como mucho 3 teléfonos por cuenta.
  - El sistema los lee con la clave de servicio.
- **Privacidad (criterio 14):** se cerró la lectura de `tricimotos.ubicacion_actual` con permisos por columna. Antes cualquier usuario autenticado podía seguir por la API REST a un conductor durante un viaje ajeno.
- `ubicacion_conductor_viaje(viaje)`: el pasajero de un viaje `aceptado` o `en_curso` ve a su conductor; nadie más, y al terminar el viaje deja de verse (13, 15, 17). No se guarda historial (16).
- Ajustes necesarios por el cierre de la columna:
  - `authController.registerProfile` insertaba la tricimoto con `.select()` (todas las columnas). Ahora pide columnas explícitas; sin el cambio, el registro de conductores habría fallado.
  - `rls_003` refrescaba la ubicación leyendo la misma columna; ahora usa un valor literal.

### Pruebas
- `rls_004.sql`: 21 en verde. `rls_001` (20), `rls_002` (18) y `rls_003` (60) siguen en verde, en Postgres 16 + PostGIS 3 local.
- Backend 211/211; la prueba del registro falla con el código anterior.

---

## [1.38.0] - 2026-10-09 (Hora Local)

### Paso 004 · plan y tareas
- `specs/004-tracking-push/plan.md`: 21 decisiones (P1 a P21), cada una con la alternativa descartada.
  - Avisos por la API HTTP de Expo, sin SDK nuevo en el backend.
  - El token del teléfono se reasigna si el teléfono cambia de cuenta.
  - Un conductor es candidato con socket **o** token de avisos, siempre con ubicación de menos de 60 s.
  - La ubicación en segundo plano se envía por socket, con REST como respaldo, para cuidar los 15 MB.
- Hallazgo de privacidad que el plan corrige (criterio 14): hoy cualquier usuario autenticado puede leer `tricimotos.ubicacion_actual` por la API REST de Supabase, y el servidor reenvía la posición de un conductor **ocupado** a todo su sector.
  - La 0014 cierra la columna con permisos por columna.
  - Durante un viaje, la posición va solo al pasajero.
- `tasks.md`: T1 a T17. T8 (Firebase, EAS y Expo) y T17 (prueba en campo) le tocan a David.

---

## [1.37.0] - 2026-10-09 (Hora Local)

### Paso 004 · borrador de la spec
- `specs/004-tracking-push/spec.md`: avisos con la app cerrada (conductor y pasajero), ubicación del conductor en segundo plano y seguimiento del conductor en el mapa del pasajero.
- 20 criterios en total, incluidos el permiso y la explicación de la ubicación en segundo plano, una nueva versión del consentimiento, nada de recorridos guardados y el presupuesto de 15 MB.
- Decisiones abiertas para David:
  - D-12: servicio de avisos (Expo, Firebase directo o un tercero).
  - D-13: frecuencia de ubicación (fija o adaptativa).
- Sin código hasta que la spec esté aprobada.
- David resolvió D-12 (A: servicio de avisos de Expo) y D-13 (B: frecuencia adaptativa), anotadas en la constitución.

---

## [1.36.0] - 2026-10-09 (Hora Local)

### Paso 003 completo · T18, prueba de humo real
- `npm run smoke` contra la BD y el backend reales: **TODO OK, 29 de 29**.
- Recorrido:
  - Disponibilidad del conductor y una oferta de 270 B, sin datos del pasajero, que vence en 15 s según el servidor (desfase de -1 ms).
  - Una segunda solicitud responde 409; tras el rechazo, el viaje queda "sin conductor".
  - "Volver a pedir", aceptación con chat y aviso al pasajero con placa `SMK-001`; una segunda aceptación responde 409.
  - Con un viaje en curso no puede cambiar su disponibilidad (409); la tricimoto vuelve sola a disponible al terminar.
- Datos (criterio 27): ubicación de 91 B cada 5 s y 40 ofertas en 10 h → 1,27 MB con margen x2 (límite: 15 MB).
- Paso 003 cerrado (T1 a T18). Sigue el 004: avisos push y tracking.

---

## [1.35.1] - 2026-10-08 (Hora Local)

### Paso 003 · T18, sincronización y limpieza de la prueba de humo
- La conexión espera `connect` y `hora_servidor`, con listeners registrados antes de conectar y un límite de espera; el desfase se mide al recibir la hora.
- Se comprueba en la BD que el GPS se guardó antes de solicitar el viaje; una oferta ausente o de otro viaje detiene el guion antes de aceptar.
- La limpieza comprueba las respuestas y solo cierra viajes de las cuentas de prueba con referencia "Prueba de humo". Un viaje ajeno bloquea la corrida sin modificarlo.
- Tras un fallo intermedio se cierran los viajes de prueba, se desactiva la disponibilidad y se desconectan los sockets. Las peticiones HTTP tienen límite de tiempo.
- `.env.example` documenta las seis credenciales del guion y aclara que la clave de servicio es obligatoria desde el 003.
- Validación local: sintaxis válida y **211/211 pruebas de backend**, incluidas 16 de sincronización, vencimientos y limpieza. **T18 permanece pendiente:** faltan las credenciales SMOKE locales para ejecutar contra Supabase. La medición de datos se identifica como proyección de ubicación y ofertas.

## [1.35.0] - 2026-10-09 (Hora Local)

### Paso 003 · T18, prueba de humo ampliada (guion listo, falta correrlo)
- `npm run smoke` fallaba con 409 en la aceptación: aceptaba el viaje directo, como en el 002, y desde la 0012 la BD exige una oferta vigente (criterio 9).
- El guion ahora recorre el despacho:
  - Limpia los viajes activos que dejaron corridas anteriores.
  - Verifica `hora_servidor` y el cambio de disponibilidad (criterio 1).
  - Oferta al conductor conectado: menos de 2 KB, sin datos del pasajero y unos 15 s según el servidor (criterios 4, 15 y 27; R14).
  - Una segunda solicitud responde 409 (criterio 13).
  - Rechazo y luego "sin conductor" (criterios 6 y 11).
  - "Volver a pedir", aceptación con chat y aviso al pasajero con nombre, placa y teléfono (criterios 10 y 16).
  - Aceptar dos veces responde 409 (criterio 8) y con un viaje en curso no puede cambiar la disponibilidad (criterio 3).
  - Chat, `en_curso`, `finalizado` y la tricimoto vuelve a disponible (R11).
  - Proyección de datos de una jornada de 10 h con margen x2 (criterio 27).
- En la rama del conductor sin aprobar, el viaje de prueba puede quedar como `sin_conductor` antes de que el pasajero lo cancele; ambos estados se aceptan.

---

## [1.34.0] - 2026-10-09 (Hora Local)

### Paso 003 · T16 y T17, verificación
- T16: `npx tsc --noEmit` sin errores en `src/` ni `app/` con todo el frontend del 003. Solo queda el aviso de `baseUrl` (deuda conocida, paso 007).
- T17: las migraciones 0011, 0012 y 0013 están en el historial del proyecto real. El linter de seguridad de Supabase muestra solo `auth_leaked_password_protection` (D-10, pospuesta).

### Pendiente del 003
- T18: prueba de humo de punta a punta. Necesita el backend con `SUPABASE_SERVICE_ROLE_KEY` y cuentas reales de pasajero y conductor.

---

## [1.33.0] - 2026-10-09 (Hora Local)

### Paso 003 · T15, lugares del administrador
- Botón "Lugares" en el panel del administrador.
- Lista (`GET /api/admin/lugares`):
  - Búsqueda por nombre con espera de 300 ms y sin respuestas viejas; filtro Todos / Visibles / Ocultos.
  - Cada lugar con su categoría, sector y fuente, e insignias "Oculto" y "Editado".
- Formulario de nuevo lugar y de corrección (`POST` y `PATCH /api/admin/lugares`):
  - Nombre, categoría y ubicación. La ubicación se marca tocando el mapa en Android, con "Usar mi ubicación" o escribiendo latitud y longitud (también con coma decimal).
  - "Visible en la búsqueda" para ocultar un lugar; no hay borrado.
  - `PATCH` envía solo lo que cambió; la BD fija el sector y marca el lugar como editado, así OSM no lo pisa (criterio 22).
  - Validación igual a la BD (nombre de 2 a 120, categorías del CHECK). Además, un punto a más de ~11 km de los sectores se rechaza, porque casi siempre es latitud y longitud cruzadas.
- `src/utils/lugaresAdmin.ts`: lógica sin React, para probarla.

### Pruebas
- `tests/despacho.test.ts`: 12 nuevas (frontend 180/180, sin errores de tipos nuevos).
- Navegador a 390 px con lugares de ejemplo: lista con filtros, edición sin cambios ("No hay cambios que guardar") y un punto fuera de Crucita rechazado. Falta con sesión de admin y backend reales (T18).

---

## [1.32.0] - 2026-10-09 (Hora Local)

### Paso 003 · T14, consola del conductor
- Interruptor de disponibilidad real: llama a `PATCH /api/conductores/disponibilidad` y muestra lo que responde el servidor (criterio 1).
  - Estado inicial leído de `tricimotos.estado` (antes se leía `perfiles.estado_operativo`, que no existe en la BD).
  - Con un viaje en curso muestra "En un viaje" y el interruptor queda bloqueado (409).
- Oferta por socket (`oferta_viaje`):
  - Personas, total, origen y destino con referencia y sector, distancia al pasajero y aviso si es la fase abierta (criterio 15).
  - Cuenta regresiva desde `venceEn` corregida con `hora_servidor`; antes era un contador local fijo de 15 s (R14).
  - Rechazar emite `rechazar_oferta`; `oferta_retirada` y el vencimiento cierran el modal (criterios 6 y 12).
  - Aceptar usa la RPC atómica; si otro ganó, se muestra "ya fue tomado". El hilo del chat queda listo en la pestaña Chat.
- Regla 6 (criterio 28, enmienda R24 del plan): modal opaco y sin blur, botones de 64 px con contraste AA y aviso "Sin conexión" en la consola y en el modal. Sin conexión no se puede aceptar.
- La ubicación se envía al ponerse disponible y luego cada 5 s, sin `estado` (R10).

### Pruebas
- `tests/despacho.test.ts`: 19 nuevas (frontend 168/168, sin errores de tipos nuevos).
- Navegador a 360 px con la oferta inyectada en el estado local: cuenta regresiva, Rechazar, cierre al vencer y aviso sin conexión. Falta con backend y conductor reales (T18).

### Pendiente
- Un modo ligero global (sin blur en toda la app) aún no existe. Se propone para el paso 007.

---

## [1.31.0] - 2026-10-09 (Hora Local)

### Paso 003 · T13, origen y estados de la solicitud del pasajero
- Origen del viaje (criterio 21):
  - Con GPS se usa la ubicación del pasajero; si no hay GPS, la ficha dice "Sin GPS: elige desde dónde sales".
  - "Cambiar" o "Elegir" abre "¿Desde dónde sales?" con el mismo buscador de lugares, los sectores y "Usar mi ubicación".
  - Con un sector como origen aparece "¿Dónde te recogen?" para la referencia que ve el conductor.
- Estados tras pedir:
  - "Buscando tricimoto…" con "Cancelar solicitud" (criterios 12 y 16).
  - "No hay tricimotos disponibles ahora" con "Volver a pedir", que reenvía la misma solicitud con la posición actual del GPS, y "Cambiar el viaje" (criterio 11).
  - "Tu tricimoto va en camino" con nombre, placa, "Llamar" y "Abrir chat" (criterio 10).
- `useViajePasajero`: escucha `viaje_aceptado` y `viaje_sin_conductor` y vuelve a leer el viaje de la BD (con RLS) al conectar y cada 30 s mientras busca (enmienda R23 del plan). Con un 409 muestra el viaje activo.
- Los avisos que llegan antes que la respuesta de `/solicitar` (sin candidatos, el cierre es inmediato) se guardan y se aplican al crear el viaje local.
- `useSocket`: los listeners se vuelven a enganchar si el socket se recrea (antes se perdían al cambiar el token) e `isConnected` es reactivo.
- `src/utils/solicitud.ts` y `src/utils/viaje.ts`: lógica sin React para probarla. El cuerpo de la solicitud no lleva precio.

### Pruebas
- `tests/despacho.test.ts`: 23 nuevas. Frontend 149/149, sin errores de tipos nuevos en `src/` ni `app/`.
- Navegador a 390 px como visitante sin GPS: elegir origen por búsqueda ("muelle") y destino por sector. Los tres estados se revisaron forzando el estado local; sin errores en la consola. Falta el flujo real con backend y sesión (T18).

---

## [1.30.0] - 2026-10-09 (Hora Local)

### Paso 003 · T12, buscador de lugares en la app
- Ficha "¿A dónde vas?":
  - Buscador de lugares que llama a `buscar_lugares` directamente con supabase-js, también sin sesión, sin API de pago ni descarga de mapa.
  - Espera 250 ms entre teclas, descarta respuestas viejas y muestra un aviso si no hay conexión.
  - Cada resultado lleva ícono por categoría y su sector, y se muestra la atribución "© OpenStreetMap".
  - Sin coincidencias, el pasajero elige el sector y escribe una referencia, como antes.
- Al elegir un lugar, la solicitud envía `lugarDestinoId` y el servidor toma coordenadas, nombre y sector.
- `src/utils/texto.ts` (`normalizar`, igual que en la BD) y `src/utils/lugares.ts`: buscador sin React, para poder probarlo.
- `.claude/launch.json`: `frontend-web-2` en el puerto 8082, para previsualizar cuando otra sesión ocupa el 8081.

### Pruebas
- `tests/despacho.test.ts` (12 nuevas). Frontend 126/126, sin errores de tipos nuevos en `src/` ni `app/`.
- Navegador, como visitante y contra la BD real:
  - "farmacia" devuelve las 4 farmacias.
  - "muele crusita" encuentra el Muelle.
  - Sin coincidencias aparece el aviso.
  - Elegir "Letras Crucita" abre la ficha con el destino por nombre.
  - Sin errores en la consola.

---

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

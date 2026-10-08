# Registro de Cambios - CruciDrive (Backend & Frontend)

## HISTORIAL DE LOGS:

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

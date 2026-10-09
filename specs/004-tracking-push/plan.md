# 004 · Plan técnico

La spec se aprobó al fusionar el PR #35 (9 oct 2026), con D-12 = A (servicio de avisos de Expo) y D-13 = B (frecuencia adaptativa). Este plan dice **cómo**; la spec dice qué y por qué. Los números entre paréntesis son criterios de la spec.

## Lo que ya existe y cambia

- `update_location` (socket) guarda la última posición en `tricimotos` y la reenvía con `location_updated` a la sala `sector:{id}`, **también cuando el conductor está ocupado** y con su nombre. Lo recibe cualquier usuario autenticado que entre a esa sala.
- La RLS de `tricimotos` deja leer filas con `estado <> 'inactivo'` a cualquier autenticado, **con `ubicacion_actual` incluida**. Así, por la API REST de Supabase se puede seguir a un conductor durante un viaje ajeno, cosa que el criterio 14 prohíbe.
- El despachador solo ofrece a conductores con socket conectado (R6 del 003). Con la app en segundo plano el socket puede caerse, y el conductor dejaría de recibir ofertas aunque tenga avisos.
- El consentimiento se guarda en `consentimientos` (versión y fecha) y la versión vigente es `0.1` (`backend/src/config/consent.js` y `frontend/src/constants/consentimiento.ts`).

## Decisiones de diseño

| # | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- |
| P1 | Avisos por la **API HTTP de Expo** (`https://exp.host/--/api/v2/push/send`) con `fetch` de Node, en `src/avisos/expo.js`. Mensajes en lotes de hasta 100, con 5 s de límite, sin reintentos y sin esperar el resultado desde el despacho (12) | El paquete `expo-server-sdk` | Una dependencia menos (regla 8). La API es un POST con JSON y Node ya trae `fetch` |
| P2 | Si `EXPO_ACCESS_TOKEN` está definido, se envía como `Authorization` (seguridad reforzada de Expo activada en el panel). Sin él, los avisos salen igual | Avisos sin token | Con la seguridad reforzada, alguien que conozca un identificador de teléfono no puede mandarle avisos haciéndose pasar por CruciDrive |
| P3 | Tabla `dispositivos_push (token pk, usuario_id, creado_en, actualizado_en)`. Se escribe solo con la RPC `registrar_dispositivo(p_token)`, que hace upsert y **reasigna** el token si el teléfono cambia de cuenta (11), y `olvidar_dispositivo(p_token)` al cerrar sesión. El backend lee los tokens con la clave de servicio, solo para el despacho | Guardar el token en `perfiles` | Un usuario puede tener dos teléfonos y un teléfono puede cambiar de cuenta; la reasignación tiene que ser atómica. Leer tokens es tarea del sistema (CLAUDE.md lo permite para el despacho) |
| P4 | Si Expo responde `DeviceNotRegistered` para un token, el backend lo borra (11) | Dejar tokens muertos | Los tokens de apps desinstaladas se acumulan y cada aviso fallido gasta tiempo |
| P5 | **Candidato** = socket conectado **o** token de avisos registrado, siempre con ubicación de menos de 60 s en la BD (enmienda de R6 del 003) | Exigir socket | Con la app en segundo plano el socket puede caer. El aviso es el canal que despierta al conductor; la ubicación fresca sigue siendo obligatoria (criterio 2 del 003) |
| P6 | En cada oferta se emite por socket (como hoy) **y** se envía un aviso al conductor. La app decide si mostrarlo: en primer plano con la consola abierta lo descarta, porque ya muestra el modal (9) | Que el servidor adivine si la app está en primer plano | El servidor no lo sabe con certeza y equivocarse cuesta una oferta perdida. Descartar en el cliente es barato y seguro |
| P7 | El aviso de oferta lleva solo `{ tipo: 'oferta', viajeId, venceEn }` en `data`. En el texto: personas, total, origen y destino (nombre de lugar o sector). Sin teléfono, nombre ni coordenadas del pasajero (6). `ttl` = segundos hasta `venceEn`, `priority: 'high'` y `channelId: 'ofertas'` | Mandar el payload completo de la oferta | Expo y Google ven el contenido; cuanto menos, mejor (LOPDP). El `ttl` evita que el aviso llegue después de vencida la oferta |
| P8 | Retirada (8): (a) en el mejor caso, un aviso de datos sin texto `{ tipo: 'oferta_retirada', viajeId }` que la app recibe en segundo plano y usa para borrar la notificación con `dismissNotificationAsync`; (b) siempre, al tocar el aviso la app consulta su oferta en la BD (`ofertas_viaje`, RLS: la propia) y, si no está `pendiente` y vigente, muestra "Esta oferta ya no está disponible" (7) | Confiar solo en (a) | Android no garantiza entregar los avisos de datos con el teléfono en reposo. La comprobación al abrir es la garantía |
| P9 | Avisos al pasajero: `viaje_aceptado` y `viaje_sin_conductor` (10), con `channelId: 'viaje'`. Al tocarlo, el mapa se sincroniza con R23 del 003, que ya existe | Un canal nuevo de estado | R23 ya lee el viaje de la BD al abrir o reconectar |
| P10 | **Ubicación en segundo plano** con `expo-location` (`startLocationUpdatesAsync`) y `expo-task-manager`, con servicio en primer plano y aviso permanente (3). La tarea se define al cargar la app (`src/tareas/ubicacionFondo.ts`, importada en `app/_layout.tsx`) | Un servicio nativo propio | Es la vía soportada por Expo y no exige código nativo. `isAndroidBackgroundLocationEnabled` ya está activo en `app.json` |
| P11 | La tarea envía por **socket si está conectado** (91 B por envío, medido en el 003) y, si no, por `POST /api/conductores/ubicacion` con el JWT de la sesión guardada (`supabase.auth.getSession()`) | Siempre por REST | Por REST, cada envío lleva unos 1,5 KB de cabeceras y JWT. Con un envío cada 10 s se acercaría al límite de 15 MB (18). El servicio en primer plano mantiene viva la conexión casi siempre; REST es el respaldo |
| P12 | Frecuencia adaptativa (D-13, 19): la tarea pide posiciones cada `UBICACION_FONDO_MOV_SEG` (10 s) y **solo envía** si se movió más de 15 m o si pasaron `UBICACION_FONDO_QUIETO_SEG` (30 s) desde el último envío. Con la app abierta se sigue enviando cada `UBICACION_ABIERTA_SEG` (5 s), como hoy. Los tres valores salen del servidor en la respuesta de `PATCH /api/conductores/disponibilidad` | Valores fijos en la app | D-13 los quiere ajustables sin publicar la app. La decisión de enviar es una función pura que se puede probar (`debeEnviar`) |
| P13 | Al ponerse no disponible, cerrar sesión o recibir un 403 o un 409 del servidor, la app llama a `stopLocationUpdatesAsync` (2) | Dejar que el servidor ignore los envíos | El aviso permanente y el GPS tienen que apagarse de verdad (LOPDP y batería) |
| P14 | Un **servicio de ubicación** compartido (`src/ubicacion/servicio.js`) atiende el socket y el REST: valida, guarda la última posición en `tricimotos` y decide el reenvío. Si el conductor está `disponible`, reenvía `location_updated` al sector como hoy. Si está `ocupado` con un viaje `aceptado` o `en_curso`, **no** lo reenvía al sector y manda `conductor_ubicacion { viajeId, lat, lng, en }` solo a la sala del pasajero de ese viaje (13, 14) | Que el pasajero entre a una sala del viaje | La sala `usuario:{id}` ya existe y solo la tiene ese usuario. Ningún otro puede pedirla |
| P15 | **Se cierra la lectura de `ubicacion_actual`**: `revoke select on tricimotos from authenticated` y `grant select` solo sobre las demás columnas. La posición del conductor de mi viaje se lee con la RPC `ubicacion_conductor_viaje(p_viaje)` (envoltorio en `public` más función `security definer` en `private`, como R3 del 003), que exige ser el pasajero y que el viaje esté `aceptado` o `en_curso` (14, 15, 17) | Filtrar por la RLS | La RLS no limita columnas (CLAUDE.md) |
| P16 | No se guarda historial: la tabla sigue teniendo una sola fila por tricimoto con la última posición; los eventos de socket no se registran (16) | — | Regla 4 |
| P17 | El mapa del pasajero muestra el marcador del conductor con el último `conductor_ubicacion`; al abrir o reconectar usa la RPC de P15. Distancia en línea recta al origen del viaje (haversine en `utils/geo.ts`) y "Última posición hace X s" si pasaron más de 15 s (13, 17) | Ruta por calles | Fuera de alcance (D-08, D-09) |
| P18 | **Consentimiento 0.2**: se actualiza el texto (sección de ubicación: "mientras estés disponible, también con la app en segundo plano; se detiene al ponerte no disponible") en `consentimiento-lopdp.md`, `consent.js` y `consentimiento.ts`. `PATCH /api/conductores/disponibilidad` con `disponible: true` responde 428 `consentimiento_pendiente` si la última aceptación del conductor es anterior a 0.2, y `POST /api/auth/consentimiento` registra la nueva (5) | Pedirlo de nuevo a todos los usuarios | Solo cambia el tratamiento para el conductor disponible. Al pasajero no le cambia nada |
| P19 | Explicación propia antes del diálogo de permiso (5) y mensaje de "solo recibirás ofertas con la app abierta" si el conductor niega el permiso en segundo plano (4): pantalla `PermisoUbicacionScreen` antes del primer `requestBackgroundPermissionsAsync` | Pedir el permiso directamente | Google Play exige una explicación visible dentro de la app |
| P20 | "Estuviste fuera del despacho" (20): la app guarda la hora del último envío correcto. Al volver a primer plano, si el conductor sigue disponible y pasaron más de 60 s, muestra el aviso con un enlace a los ajustes de la app (`Linking.openSettings()`) | Una librería de optimización de batería | Sin dependencias nuevas; desde los ajustes de la app se quita el ahorro de batería |
| P21 | `app.json` pasa a `app.config.js`, que lo extiende para leer `GOOGLE_SERVICES_JSON` (variable de tipo archivo en EAS) como `android.googleServicesFile`. `google-services.json` va en `.gitignore` | Subir `google-services.json` al repo | CLAUDE.md: ninguna clave en el repo. Con una variable de archivo en EAS, la compilación la obtiene sin subirla a git |

## Esquema: `0014_avisos_y_privacidad.sql`

- `dispositivos_push`: `token text primary key check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$')`, `usuario_id uuid not null → perfiles on delete cascade`, `creado_en`, `actualizado_en`. RLS activo: `select` del propio usuario; sin `insert/update/delete` directos para `authenticated`.
- `public.registrar_dispositivo(p_token text)` y `public.olvidar_dispositivo(p_token text)`: envoltorios `security invoker` que llaman a `private.*` (`security definer`, `search_path = ''`). Upsert con reasignación (P3).
- `public.ubicacion_conductor_viaje(p_viaje uuid) returns (lat, lng, actualizado_en)`: envoltorio más `private`, con la validación de P15.
- `tricimotos`: `revoke select ... from authenticated; grant select (id, conductor_id, placa, estado, sector_id, ubicacion_en, disponible_desde, updated_at) to authenticated`. Antes de aplicarlo se revisa que ningún cliente lea `ubicacion_actual` por REST (búsqueda en `frontend/` y `backend/`).
- Linter de seguridad sin hallazgos nuevos (solo D-10).

## Backend

- `src/avisos/expo.js`: `enviar(mensajes)` (P1, P2, P4).
- `src/avisos/mensajes.js`: `avisoOferta`, `avisoRetirada`, `avisoAceptado` y `avisoSinConductor` (P7, P9), funciones puras.
- `src/avisos/index.js`: `avisarUsuario(userId, mensaje)` lee tokens con la clave de servicio y envía sin `await` en el despacho (12).
- `despachador.js`: `candidatosConectados` aplica P5 (`conexiones.estaConectado || tieneToken`, con los tokens consultados una vez por paso); `ofrecer` envía además `avisoOferta`; las retiradas envían `avisoRetirada`; `aceptado` y `cerrarSinConductor` avisan al pasajero.
- `src/ubicacion/servicio.js` (P14), usado por `update_location` y por `POST /api/conductores/ubicacion` (rate limit propio por usuario: 1 cada 3 s).
- `POST /api/dispositivos` y `DELETE /api/dispositivos/:token` con `req.supabase.rpc` (P3).
- `PATCH /api/conductores/disponibilidad`: puerta de consentimiento 0.2 (P18) y parámetros de ubicación en la respuesta (P12).
- `POST /api/auth/consentimiento` (P18).
- `.env.example`: `EXPO_ACCESS_TOKEN`, `AVISOS_ACTIVOS=true`, `UBICACION_ABIERTA_SEG=5`, `UBICACION_FONDO_MOV_SEG=10`, `UBICACION_FONDO_QUIETO_SEG=30`.

## Frontend

- Dependencias nuevas, justificadas por esta spec (regla 8): `expo-notifications` y `expo-task-manager`, instaladas con `npx expo install` para que coincidan con el SDK.
- `app.config.js` (P21), con el plugin `expo-notifications` (ícono y color) y `isAndroidForegroundServiceEnabled: true` en `expo-location`.
- `src/servicios/avisos.ts`: canales Android `ofertas` (importancia máxima, sonido y vibración) y `viaje`; registro del token al iniciar sesión y borrado al cerrarla (11); manejador en primer plano que descarta `oferta` si la consola está abierta (9, P6); respuesta al toque, que navega a la consola o al mapa (7, 10).
- `src/tareas/ubicacionFondo.ts`: `defineTask`, `debeEnviar` (P12) y envío por socket o REST (P11).
- `DriverConsoleScreen` y `useConsolaConductor`: arranque y parada de la tarea con la disponibilidad (1, 2, P13); `PermisoUbicacionScreen` (4, 5); oferta abierta desde un aviso con comprobación en la BD (7, 8); aviso "Estuviste fuera del despacho" (20); re-aceptación del consentimiento 0.2 (5).
- `MapScreen` y `useViajePasajero`: `conductor_ubicacion`, RPC inicial, marcador, distancia y "hace X s" (13, 15, 17).

## Pruebas

| Capa | Archivo | Cubre |
| --- | --- | --- |
| BD | `supabase/tests/rls_004.sql` | `dispositivos_push` solo propios; reasignación del token (11); nadie lee `ubicacion_actual` por REST (14); `ubicacion_conductor_viaje` solo para el pasajero y con el viaje `aceptado` o `en_curso` (14, 15); sin historial (16) |
| Backend | `tests/avisos.test.js` | Mensajes sin datos del pasajero, `ttl` y canal (6, 7); lotes; `DeviceNotRegistered` borra el token (11); un fallo de Expo no frena el despacho (12) |
| Backend | `tests/spec004.test.js` | Candidato por token sin socket (P5); oferta, retirada, aceptado y sin conductor también por aviso (6, 8, 10); servicio de ubicación por socket y REST; `conductor_ubicacion` solo al pasajero y sin reenvío al sector con el conductor ocupado (13, 14, 15); puerta de consentimiento 0.2 (5); rate limit de REST |
| Frontend | `tests/avisos.test.ts` | `debeEnviar` (19); descarte en primer plano (9); validez de la oferta al tocar el aviso (7, 8); detección de "fuera del despacho" (20); distancia y "hace X s" (13, 17) |
| Humo | `npm run smoke` | Registro del token; `conductor_ubicacion` llega al pasajero y no a otro usuario; envío por REST; bytes por envío y proyección de 10 h (18) |
| Campo | **David**, APK `preview` en 2 teléfonos | 1 (10 min en segundo plano), 3 (aviso permanente), 6 (aviso en menos de 5 s, cronometrado), 20 (teléfono con ahorro de batería) |

## Trabajo de David (fuera del código)

1. **Firebase**: crear un proyecto, registrar la app Android `com.crucidrive.app` y descargar `google-services.json`.
2. **EAS**:
   - Subir la clave de cuenta de servicio de FCM V1 (`npx eas-cli credentials`, Android, Push Notifications: FCM V1).
   - Crear la variable de archivo `GOOGLE_SERVICES_JSON` con el `google-services.json`.
3. **Expo**: activar la seguridad reforzada de los avisos, crear un token de acceso y ponerlo en `EXPO_ACCESS_TOKEN` del `backend/.env` y del servidor.
4. **Google Play** (antes de publicar en la tienda, no para el APK de prueba): declarar la ubicación en segundo plano con el video que muestra la explicación de P19.

## Riesgos

- **El JS en segundo plano.** Si Android detiene la tarea pese al servicio en primer plano, el conductor sale del despacho (lo cubre el criterio 20) y no hay nada más que la app pueda hacer. Se mide en campo (tarea de David).
- **Retraso de los avisos.** Si en campo superan los 5 s, se sube `DESPACHO_OFERTA_SEG` (riesgo de la spec).
- **El revoke de `ubicacion_actual`** puede romper una lectura olvidada. Se busca en el código antes de la migración y la prueba de humo lo cubre.
- **Expo Go no sirve** para avisos ni para la ubicación en segundo plano: hace falta un APK de desarrollo o `preview`.

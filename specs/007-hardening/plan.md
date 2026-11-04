# 007 · Plan

Spec aprobada por David el 4 nov 2026, con las propuestas de E1 a E6. Se entrega en **4 PR**, en el orden de la spec. Cada PR deja el CI en verde y su entrada en `REGISTRO_CAMBIOS.md`.

## Decisiones de David (4 nov 2026)
| | Decisión |
| --- | --- |
| E1 | Cuando el viaje termina, cada parte sigue viendo **solo el nombre** de la otra. El teléfono no |
| E2 | Tope de cancelaciones: **5 del pasajero en 60 min dejan 30 min sin pedir**. Cuentan las que hace mientras busca y después de aceptado |
| E3 | El registro de acceso se guarda **14 días** en el servidor |
| E4 | Contraseñas de **mínimo 10 caracteres, con letras y números**. Sin el plan de pago (D-10 cerrada) |
| E5 | El backend **sigue en JavaScript**, con JSDoc y revisión de tipos en el CI (D-01 cerrada) |
| E6 | Límites por usuario cada 15 min: **pedir 10, cancelar 10, aceptar 30** |

---

## PR 1 · Brecha 1: sockets de sector (criterios 1 a 6)

**P1 · Una sola sala por conexión.**
- `join_sector` primero valida el formato con `isSectorId` y después que el sector exista y esté activo en `public.sectores`.
- El catálogo de sectores se guarda en memoria durante 10 min (`sockets/sectores.js`) y se lee con `socket.supabase`.
- La conexión guarda su sector en `socket.data.sector`. Si es el mismo, no hace nada; si es otro, sale de la sala anterior antes de entrar a la nueva.
- Los cambios de sector tienen un tope por minuto y por conexión: `SOCKET_CAMBIOS_SECTOR_MIN`, entre 1 y 60, por defecto 6, validado al arrancar como `ubicacion/config.js`. Los cambios de más se ignoran con un mensaje genérico.
- Descartado: consultar la BD en cada `join_sector`. Son 5 sectores y caben en memoria.

**P2 · Marcador efímero.**
- `ubicacion/marcador.js` calcula `marcador = HMAC-SHA256(claveDelDía, conductorId)` y usa los primeros 16 caracteres hexadecimales. `claveDelDía = HMAC-SHA256(MARCADOR_SECRETO, 'AAAA-MM-DD')`, con la fecha en America/Guayaquil.
- No se guarda nada: el marcador cambia solo a medianoche. Durante unos 60 s después de medianoche el mapa puede mostrar el marcador viejo y el nuevo, hasta que el viejo caduque (P4).
- `MARCADOR_SECRETO` es obligatorio y de 32 caracteres o más. El servidor no arranca sin él. Se agrega a `backend/.env.example` y a `deploy/vm/api.env.ejemplo`, sin valor.
- Descartados:
  - un mapa aleatorio en memoria, porque se pierde al reiniciar y crece sin límite;
  - mantener el UUID y solo redondear las coordenadas, porque igual se puede seguir a una persona.

**P3 · Contenido de `location_updated`.**
- Pasa a ser `{ marcador, coords: { lat, lng }, estado }`, con las coordenadas redondeadas a 3 decimales.
- Sin `conductorId` y sin `nombre`.
- `conductor_ubicacion`, que va a la sala personal del pasajero del viaje, no cambia: sigue con las coordenadas exactas.

**P4 · App.**
- `NearbyDriver` pasa a ser `{ marcador, coords, estado, lastUpdate }`, sin nombre.
- El `Marker` usa `key={marcador}` y su `title` es «Tricimoto disponible».
- El store suma `podarConductores(ahora, 60_000)`. `MapScreen` lo llama cada 10 s y vacía la lista al cambiar de sector.
- Compatibilidad: un APK viejo recibe el contenido nuevo sin `conductorId` y muestra una sola tricimoto, sin cerrarse. El cambio de la app se publica por EAS Update (D-17) junto con el backend.

**P5 · Logs del socket.** Cambian `socketHandler.js` L66, L81 y L204: se registra `usuario=<uuid> rol=<rol>`, sin el nombre.

**Pruebas:**
- Nuevas: `backend/tests/socketSector.test.js` y `backend/tests/marcador.test.js`.
- Se ajustan `spec004.test.js` L102 y `despachador.test.js` L142.
- Nueva en la app: `frontend/tests/conductoresCercanos.test.ts`.

---

## PR 2 · Brechas 2 a 5 y criterios 21 y 22

**P6 · El teléfono solo con un viaje activo (brecha 2, E1).** Migración `0018_endurecimiento.sql`:
- `revoke select on public.perfiles from authenticated`, y después `grant select (id, rol, nombre, activo, creado_en)`. El teléfono deja de leerse directo. `perfiles_select` no cambia, así que el nombre sigue visible para quien compartió un viaje (E1).
- `private.telefono_contraparte(p_viaje uuid) returns text`: security definer y `search_path = ''`. Devuelve el teléfono de la otra parte solo si `auth.uid()` es el pasajero o el conductor y el viaje está `aceptado` o `en_curso`. Si no, devuelve null. Su envoltura `public.telefono_contraparte` es security invoker, como `ubicacion_conductor_viaje` en la 0014.
- `public.mi_perfil()`: devuelve id, nombre, teléfono, rol y activo del propio usuario.
- `public.telefonos_admin(p_ids uuid[])`: devuelve id y teléfono solo si `private.rol_actual() = 'admin'`.
- Lugares que cambian:
  - `useViajePasajero.ts` L67, `useViajeConductor.ts` L48 y `viajeController.js` L126: el nombre con `select` y el teléfono con `telefono_contraparte`;
  - `useSupabaseAuth.ts` L61: pasa a `mi_perfil`;
  - `authController.js` L60: `.select('id, rol, nombre, activo')`, porque `.select()` sin columnas pediría el teléfono;
  - `adminController.js` L24 y L61: el nombre y después `telefonos_admin`;
  - `backend/scripts/smoke.js`.
- Descartados:
  - una tabla aparte de contacto, porque obliga a migrar datos y a escribir en dos tablas al registrarse;
  - limitar las filas de `perfiles` a los viajes activos, porque esconde también el nombre y contradice E1.

**P7 · Consentimientos (brecha 4).** En la misma migración: `revoke select on public.consentimientos from authenticated` y `grant select (user_id, version, aceptado_en)`. `conductorController.js` L128 pasa a `.select('version')`.

**P8 · Tope de cancelaciones (brecha 3, E2).**
- `backend/src/viaje/limiteCancelaciones.js`, con la misma forma que `sancion.js`. Variables: `CANCELACIONES_MAX` (1 a 50, por defecto 5), `CANCELACIONES_VENTANA_MIN` (5 a 1440, por defecto 60) y `CANCELACIONES_BLOQUEO_MIN` (5 a 1440, por defecto 30).
- Cuenta los viajes del pasajero con `estado = 'cancelado'`, `cancelado_por = 'pasajero'` y `finalizado_en` dentro de la ventana. Usa el índice `idx_viajes_finalizados_por_pasajero` de la 0017.
- `solicitarViaje` lo revisa junto a `revisarSancion` y responde 429 con `Retry-After` y la hora local.
- Hay que comprobar que el `PATCH /:id/estado` heredado también deje `cancelado_por`. Si no lo deja, una cancelación con `cancelado_por` nulo en estado `solicitado` cuenta como del pasajero.
- **Riesgo aceptado:** la política `viajes_insert_pasajero` deja insertar un viaje directo por la API sin pasar por el backend. Ese viaje no genera ofertas ni avisos, porque el despacho lo arranca el backend, así que no sirve para molestar a conductores. Llevar la regla a la BD queda fuera de este paso.

**P9 · Límites por usuario (brecha 5, E6).**
- `middlewares/limitePorUsuario.js` arma limitadores con `keyGenerator: req.user.id` y una ventana de 15 min. Variables: `RATE_LIMIT_USUARIO_PEDIR` (10), `RATE_LIMIT_USUARIO_CANCELAR` (10) y `RATE_LIMIT_USUARIO_ACEPTAR` (30).
- Van después de `authMiddleware` en `POST /solicitar`, `POST /:id/cancelar`, `PATCH /:id/estado` y `POST /aceptar`.
- La prueba comprueba que todo 429 (por IP, por usuario y `/ubicacion`) lleve `Retry-After`. Si `express-rate-limit` no lo pone en algún caso, un `handler` propio lo agrega.

**P10 · No revelar quién tiene cuenta (21 y 22).**
- `mensajesAuth.ts` L13: «already registered» se trata como un registro normal. `LoginScreen` muestra «Si el correo es válido, te enviamos un enlace para confirmar» y pasa a «Entrar», igual que con `requiereConfirmarCorreo`.
- El inicio de sesión ya responde «Correo o contraseña incorrectos» en los dos casos, y se agrega la prueba.
- Lo que no se puede evitar: el teléfono es único (`telefono unique`), así que un registro con un teléfono repetido falla. El mensaje es genérico y no dice por qué; para intentarlo hace falta una cuenta con sesión, y hay límite de 60 por 15 min en `/api/auth`.

**Pruebas:**
- BD: `supabase/tests/rls_008.sql`. Teléfono por estado del viaje (aceptado, en curso, finalizado, cancelado y un tercero), propio, admin, y nombre visible después del viaje; `consentimientos.id` denegado.
- Backend: `limiteCancelaciones.test.js`, `limitePorUsuario.test.js` y los ajustes de `viajeController` y `adminController`.
- App: pruebas de `mensajesAuth`, `useViajePasajero` y `useViajeConductor`.

---

## PR 3 · Registro de acceso, contraseñas, tipos y D-01 (criterios 19, 20, 23, 24 y 27)

**P11 · Registro de acceso.**
- `middlewares/registroAcceso.js` va antes de las rutas. Al terminar la respuesta (`res.on('finish')`) escribe una línea JSON en la salida estándar: `{ t, uid, m, ruta, st, ms, ip, ua }`.
  - `uid` es `req.user?.id` o `'anonimo'`;
  - `ruta` es `req.originalUrl` sin la consulta (`?…`);
  - `ua` se corta en 200 caracteres.
- El socket escribe el mismo formato al conectar y al desconectar.
- En la VM, journald guarda 14 días (`deploy/vm/journald-crucidrive.conf` con `MaxRetentionSec=14day`), y se documenta en `deploy/vm/README`.
- Descartado: guardar el registro en una tabla de Supabase, porque mete datos de uso en la BD y gasta cuota.

**P12 · Contraseñas (E4).**
- `validarPassword` de la app pide 10 caracteres o más, con al menos una letra y un número.
- En el panel de Supabase Auth: longitud mínima 10 y requisito «letras y dígitos». Lo cambia David.
- Las cuentas que ya existen no tienen que cambiar su contraseña.

**P13 · Tipos (T18).** El job del frontend en `ci.yml` suma `npx tsc --noEmit`.

**P14 · Backend en JS con revisión de tipos (E5).**
- `backend/jsconfig.json` con `checkJs` activado solo por archivo, con `// @ts-check`.
- `typescript` como dependencia de desarrollo del backend; esta spec la justifica.
- `npm run typecheck` y un paso nuevo en el CI.
- Este paso marca con `// @ts-check` los archivos nuevos y los que toca.
- En la constitución, D-01 pasa a decidida.

---

## PR 4 · Auditoría del APK (D-20, criterios 25 y 26)

**P15 · Auditoría con REA.**
- En la PC de David (Node 24.15 y Java 26 ya están; JADX lo instala `npx rea-agents setup`), sobre el último APK `preview` de EAS.
- Resultado en `auditoria-apk.md`: permisos con su justificación (incluido `ACCESS_BACKGROUND_LOCATION` con el texto para la Play Store), componentes exportados, firma y la key de Maps del manifest.
- La restricción de la key al paquete y al SHA-1 se comprueba en Google Cloud Console. El SHA-1 sale de `eas credentials`.
- No se intenta decompilar el JS, que va en bytecode Hermes (D-20).

## Lo que hace David
- Confirmar en Supabase Auth que «Confirm email» está activo (criterio 21) y aplicar E4 en el panel.
- Ver en Google Cloud Console las restricciones de la key de Maps (P15).
- Después del PR 1, la prueba de campo del 004 T17 con el mapa ya sin datos personales.

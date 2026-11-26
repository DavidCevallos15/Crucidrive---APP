# 019 · Plan de implementación

## Decisiones técnicas

- **P1 · Documentos legales como HTML estático en `web/` (`tricimoto.app`):**
  - Se crean `web/privacidad.html`, `web/terminos.html`, `web/reembolsos.html` y `web/eliminar-cuenta.html`, servidos en rutas limpias (`/privacidad`, `/terminos`, `/reembolsos`, `/eliminar-cuenta`) gracias a `"cleanUrls": true` en `web/vercel.json`.
  - Se actualiza `web/index.html` solo añadiendo el pie con enlaces legales sin alterar la lógica de confirmación de correo de Supabase Auth.
  - *Descartado:* generar PDFs pesados o incrustar el texto completo en un servicio externo (Termly/Notion), porque suma dependencias de terceros, rompe la estética de CruciDrive y puede caer o cambiar de URL.

- **P2 · Cabeceras de seguridad en `web/vercel.json` y `frontend/vercel.json`:**
  - En ambos archivos se agrega `Strict-Transport-Security: max-age=31536000; includeSubDomains` y `Content-Security-Policy` explícita.
  - En `frontend/vercel.json`, la CSP permite `maps.googleapis.com`, `maps.gstatic.com`, `fonts.googleapis.com`, `fonts.gstatic.com`, `openstreetmap.org` en `frame-src`, `worker-src 'self'` y `connect-src 'self' https: wss:`, manteniendo `object-src 'none'` y `frame-ancestors 'none'`.
  - *Descartado:* `Content-Security-Policy: default-src 'self'` sin permisos de mapas/fuentes, que rompería Google Maps JS, OpenStreetMap y las conexiones HTTPS/WSS hacia Supabase y la VM de Azure.

- **P3 · Versión de consentimiento `1.0` sincronizada en app y servidor:**
  - `backend/src/config/consent.js` y `frontend/src/constants/consentimiento.ts` suben de `'0.3'` a `'1.0'`.
  - `frontend/src/constants/legal.ts` centraliza las URLs públicas de `tricimoto.app` y los datos del responsable (DRY).
  - `specs/002-identidad/consentimiento-lopdp.md` se actualiza a `v1.0` con los mismos datos.
  - *Descartado:* dejar la versión en `0.3` y solo cambiar textos, porque la LOPDP y la regla de `002` exigen versionar cada cambio de fondo y reconfirmar con conductores existentes (lo que `conductorController.js` ya hace automáticamente con HTTP 428).

- **P4 · Consentimiento explícito en `LoginScreen`, `CompleteProfileScreen` y `SettingsScreen`:**
  - En `LoginScreen` (solo modo `crear`): se agrega `CheckboxRow` desmarcado por defecto (`aceptaLegal = false`) que exige aceptar Privacidad y Términos antes de llamar `signUp`, más enlaces clickeables a `tricimoto.app/privacidad` y `tricimoto.app/terminos` en ambos modos.
  - En `CompleteProfileScreen` y `SettingsScreen`: se quita la nota de «borrador pendiente de revisión legal» y se añaden enlaces directos a Privacidad, Términos, Reembolsos y Eliminación de cuenta.

- **P5 · Preferencias web sin dependencias nuevas (`preferenciasWeb.ts` + `PreferenciasWebModal.tsx`):**
  - Módulo puro `frontend/src/utils/preferenciasWeb.ts` que guarda `{ version: '1.0', esenciales: true, mapaExterno, fechaIso, caducaIso }` (caducidad 180 días) en `localStorage` bajo `crucidrive.preferenciasWeb`, con suscripción en memoria para reflejar cambios al instante.
  - `Map.web.tsx` consulta `permiteGoogleMapsWeb()` y se suscribe a cambios: si `mapaExterno === false`, renderiza `MapaOsm` sin cargar Google Maps JS.
  - `PreferenciasWebModal.tsx` (solo en `Platform.OS === 'web'`) se monta en `app/_layout.tsx` y se puede volver a abrir desde `SettingsScreen` («Preferencias de cookies y mapa»). Ofrece 3 acciones claras: «Aceptar mapa», «Solo esenciales» y «Personalizar».
  - *Descartado:* añadir librerías externas de CMP/cookies (OneTrust, CookieYes), porque suman peso, trackers de terceros y violan la regla 4 de dependencias y regla 5 de datos móviles.

- **P6 · Mantenimiento de documentación y limpieza del repo:**
  - `specs/007-hardening/tasks.md`: tildar `D2` (confirmada por David el 25 nov 2026) y anotar backend PR 3 desplegado en producción.
  - `specs/018-app-web-iphone/tasks.md` y `specs/README.md`: corregir líneas duplicadas del merge #81 y registrar `019` y `020`.
  - `.gitignore`: ignorar `Claude outputs/`.

## Pruebas
- `frontend/tests/cumplimientoLegal019.test.ts`: valida todos los criterios (1 a 13) de forma automatizada.
- Actualización de versión `1.0` en `backend/tests/spec004.test.js`, `frontend/tests/avisos.test.ts` y `frontend/tests/identidad.test.ts`.
- Suites completas: `backend` (`npm test`, `npm run typecheck`, `npm audit --omit=dev`) y `frontend` (`npm test -- --ci`, `npx tsc --noEmit`).

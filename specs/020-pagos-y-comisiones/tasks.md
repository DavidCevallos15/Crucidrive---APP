# 020 · Tareas

Cada tarea se tilda cuando su prueba pasa, nunca antes.

PR A probado el 27 nov 2026 con `bash supabase/tests/run-docker.sh`: `rls_001` a `rls_009` en verde (`rls_009`: 37), `concurrencia_003` y `concurrencia_020` en verde.

## Despliegue (27 nov 2026)

- #86 a #89 fusionados en `main`. Las migraciones 0020 y 0021 se aplicaron antes por MCP y la integración con GitHub no las reaplicó.
- VM actualizada (`instalar.sh 158.23.144.156`): `/api/conductores/creditos` y `/api/admin/creditos/*` responden 401 sin sesión, es decir, existen.
- Cobro activado a pedido de David el 27 nov a las 13:07 UTC (`parametros_cobro.cobro_activo = true`).
- App publicada por EAS Update en el canal `preview` (Android, runtime 1.0.0, grupo `1071be54-6daa-4be1-9680-ca1574baa3e5`, desde `798b4a7`). La web `app.tricimoto.app` se desplegó en Vercel al fusionar.

## PR A · Base de datos
- [x] **T1 · Tablas `parametros_cobro`, `movimientos_credito`, `saldos_credito` y `private.bonos_por_cedula`, con RLS, permisos y libro inmutable (criterio 8).** *Prueba:* `rls_009.sql`: `authenticated` no inserta, edita ni borra en el libro ni en saldos; el admin tampoco edita un movimiento; A no lee lo de B.
- [x] **T2 · Bono de bienvenida por cédula y carga a conductores ya aprobados (criterio 1).** *Prueba:* `rls_009.sql`: aprobar da un bono; re-aprobar y una cuenta nueva con la misma cédula no dan otro.
- [x] **T3 · Comisión atómica en `aceptar_viaje` y saldo nunca negativo (criterios 3 y 9).** *Prueba:* `rls_009.sql` con cobro activo e inactivo, viaje y encomienda; saldo insuficiente revierte la aceptación; `concurrencia_020.sh`: dos descuentos simultáneos sobre 2,00 USD, solo pasa uno.
- [x] **T4 · Devolución al cancelar el pasajero y ninguna al cancelar el conductor (criterios 4 y 5).** *Prueba:* `rls_009.sql`, incluido un segundo intento que no suma y el conductor que intenta marcar `cancelado_por = 'pasajero'`.
- [x] **T5 · Saldo mínimo al ponerse disponible (criterio 2).** *Prueba:* `rls_009.sql`: `inactivo → disponible` con saldo bajo falla; `ocupado → disponible` queda `inactivo`.
- [x] **T6 · `acreditar_credito` y `resumen_creditos` solo admin, comprobante único (criterios 6 y 10).** *Prueba:* `rls_009.sql`.
- [x] **T7 · Advisors de Supabase sin hallazgos y migración aplicada en producción con `cobro_activo = false`** (autorizada por David el 27 nov 2026). 0020 aplicada por MCP; el linter marcó «RLS Enabled No Policy» en `private.bonos_por_cedula` y lo cerró la 0021 (política restrictiva explícita). Linter de seguridad igual que antes: solo D-10. Producción: 1 conductor aprobado con bono de 2,00 USD; `anon` y `authenticated` sin escritura en el libro.

## PR B · Backend

Probado el 27 nov 2026: `tests/creditos020.test.js` y el límite de recargas en `tests/limitePorUsuario.test.js`; backend 511/511, `npm run typecheck` sin errores, `npm audit --omit=dev` sin vulnerabilidades.

- [x] **T8 · `GET /api/conductor/creditos` (criterios 7 y 8).** *Prueba:* jest con `req.supabase` simulado.
- [x] **T9 · Rutas admin de parámetros, acreditar, historial y resumen, con validación (criterios 6 y 10).** *Prueba:* jest: montos fuera de rango, canal inválido, falta de comprobante o motivo, `409` por comprobante repetido, `403` sin rol admin.
- [x] **T10 · `saldo_insuficiente` → `402` al aceptar y al ponerse disponible (criterios 2 y 3).** *Prueba:* jest en `viajeController` y `conductorController`; `npm run typecheck` sin errores.

## PR C · Frontend y legales

Probado el 27 nov 2026: `frontend/tests/creditos020.test.ts` (37) y las pruebas de versión del aviso; frontend 585/585, `npx tsc --noEmit` sin errores; backend 511/511. El aviso de privacidad sube a 1.1 (nuevo tratamiento: movimientos de créditos y huella de cédula).

- [x] **T11 · Pantalla «Mis créditos» del conductor, sin enlaces de pago, y manejo del `402` (criterios 2 y 7).** *Prueba:* jest de la pantalla y del flujo de disponibilidad.
- [x] **T12 · Créditos en el panel admin: formulario, interruptor, parámetros y resumen (criterios 6 y 10).** *Prueba:* jest de las pantallas y del servicio.
- [x] **T13 · Páginas legales sin Google Play Billing y con recargas manuales; en Privacidad, la huella SHA-256 de la cédula que se conserva tras borrar la cuenta solo para no repetir el bono, y los movimientos que quedan sin identidad.** *Prueba:* `cumplimientoLegal019.test.ts` actualizado.
- [x] **T14 · Verificación completa:** backend y frontend en verde, `tsc --noEmit`, `npm run typecheck`, `npm audit --omit=dev`; entrada en `REGISTRO_CAMBIOS.md`.
- [ ] **T15 · Prueba de campo:** David acredita una recarga real por DeUna o transferencia, activa el cobro y un conductor acepta y le cancelan un servicio; los saldos cuadran con el resumen.

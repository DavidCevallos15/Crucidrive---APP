# 020 · Tareas

Cada tarea se tilda cuando su prueba pasa, nunca antes.

PR A probado el 27 nov 2026 con `bash supabase/tests/run-docker.sh`: `rls_001` a `rls_009` en verde (`rls_009`: 37), `concurrencia_003` y `concurrencia_020` en verde.

## PR A · Base de datos
- [x] **T1 · Tablas `parametros_cobro`, `movimientos_credito`, `saldos_credito` y `private.bonos_por_cedula`, con RLS, permisos y libro inmutable (criterio 8).** *Prueba:* `rls_009.sql`: `authenticated` no inserta, edita ni borra en el libro ni en saldos; el admin tampoco edita un movimiento; A no lee lo de B.
- [x] **T2 · Bono de bienvenida por cédula y carga a conductores ya aprobados (criterio 1).** *Prueba:* `rls_009.sql`: aprobar da un bono; re-aprobar y una cuenta nueva con la misma cédula no dan otro.
- [x] **T3 · Comisión atómica en `aceptar_viaje` y saldo nunca negativo (criterios 3 y 9).** *Prueba:* `rls_009.sql` con cobro activo e inactivo, viaje y encomienda; saldo insuficiente revierte la aceptación; `concurrencia_020.sh`: dos descuentos simultáneos sobre 2,00 USD, solo pasa uno.
- [x] **T4 · Devolución al cancelar el pasajero y ninguna al cancelar el conductor (criterios 4 y 5).** *Prueba:* `rls_009.sql`, incluido un segundo intento que no suma y el conductor que intenta marcar `cancelado_por = 'pasajero'`.
- [x] **T5 · Saldo mínimo al ponerse disponible (criterio 2).** *Prueba:* `rls_009.sql`: `inactivo → disponible` con saldo bajo falla; `ocupado → disponible` queda `inactivo`.
- [x] **T6 · `acreditar_credito` y `resumen_creditos` solo admin, comprobante único (criterios 6 y 10).** *Prueba:* `rls_009.sql`.
- [ ] **T7 · Advisors de Supabase sin hallazgos y migración aplicada en producción con `cobro_activo = false`** (requiere autorización de David).

## PR B · Backend
- [ ] **T8 · `GET /api/conductor/creditos` (criterios 7 y 8).** *Prueba:* jest con `req.supabase` simulado.
- [ ] **T9 · Rutas admin de parámetros, acreditar, historial y resumen, con validación (criterios 6 y 10).** *Prueba:* jest: montos fuera de rango, canal inválido, falta de comprobante o motivo, `409` por comprobante repetido, `403` sin rol admin.
- [ ] **T10 · `saldo_insuficiente` → `402` al aceptar y al ponerse disponible (criterios 2 y 3).** *Prueba:* jest en `viajeController` y `conductorController`; `npm run typecheck` sin errores.

## PR C · Frontend y legales
- [ ] **T11 · Pantalla «Mis créditos» del conductor, sin enlaces de pago, y manejo del `402` (criterios 2 y 7).** *Prueba:* jest de la pantalla y del flujo de disponibilidad.
- [ ] **T12 · Créditos en el panel admin: formulario, interruptor, parámetros y resumen (criterios 6 y 10).** *Prueba:* jest de las pantallas y del servicio.
- [ ] **T13 · Páginas legales sin Google Play Billing y con recargas manuales; en Privacidad, la huella SHA-256 de la cédula que se conserva tras borrar la cuenta solo para no repetir el bono, y los movimientos que quedan sin identidad.** *Prueba:* `cumplimientoLegal019.test.ts` actualizado.
- [ ] **T14 · Verificación completa:** backend y frontend en verde, `tsc --noEmit`, `npm run typecheck`, `npm audit --omit=dev`; entrada en `REGISTRO_CAMBIOS.md`.
- [ ] **T15 · Prueba de campo:** David acredita una recarga real por DeUna o transferencia, activa el cobro y un conductor acepta y le cancelan un servicio; los saldos cuadran con el resumen.

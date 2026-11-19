# 017 · Tareas

Cada tarea indica su prueba y se tilda solo al cumplirse.

## Parte A · Pedir sin depender del mapa
- [x] T1 · Spec aprobada (R1 a R8), D-21 en la constitución y plan → revisión de David el 19 nov 2026.
- [x] T2 · `estaSinInternet` en `src/utils/conexion.ts` y el hook `useSinInternet`, con 6 s de gracia y sin aviso cuando no hay sesión (P1, criterio 2) → prueba: `tests/sinInternet017.test.ts` → hecho: 4 pruebas (gracia, a los 6 s, conectado o sin sesión, textos).
- [x] T3 · Píldora «Sin internet» en la pantalla del pasajero, visible también con un viaje activo (P2, criterio 2) → prueba: textos en `tests/sinInternet017.test.ts` y revisión en el APK (T7) → hecho: `AvisoSinInternet` en la fila del menú, con `accessibilityLiveRegion`. Falta verla en el teléfono (T7).
- [x] T4 · `PlanoSectores` y `src/utils/planoSectores.ts` (P3, criterio 2) → prueba: proyección con norte arriba y el mar a la izquierda, todo dentro de la caja, sin deformar y sin dibujar un GPS fuera de Crucita → hecho: 7 pruebas. Los nombres se alternan de lado para que Los Arenales y Malecón (unos 14 px de separación en 360 × 640) no se tapen. La leyenda dice «Plano aproximado»; la frase completa va al lector de pantalla. Se revisó con un render del SVG en 360 × 640 y 393 × 852.
- [x] T5 · `solicitar`: `sinConexion` cuando la red falla o se acaba el tiempo; con un 409, sincroniza y da por hecho el viaje que ya existe. «No se pudo enviar» con «Reintentar» (P4, criterio 3). Pedido completo solo con datos locales (criterio 1) → prueba: acciones reales del hook en `tests/sinInternet017.test.ts` → hecho: 6 pruebas (sin red, tiempo agotado, 409 con viaje, 409 sin viaje, 400 sin reintento, y los 20 pares de sectores con GPS o sector). «Reintentar» envía el mismo pedido aunque el formulario haya cambiado. «Volver a pedir» usa el mismo aviso.
- [x] T6 · Sin errores de tipos nuevos en `src/` y `app/` → prueba: `npx tsc --noEmit` filtrado a `^(src|app)/` → hecho: `npx tsc --noEmit --ignoreDeprecations 6.0` sin ningún error, con `npm ci` limpio. Frontend 500/500 (17 nuevas).
- [ ] T7 · **David:** en el APK `preview` (por aire), con los datos móviles apagados: a los 6 s aparecen el aviso y el plano; «Solicitar» responde «No se pudo enviar»; con datos, «Reintentar» crea un solo viaje.

## Partes B a G · Pedir por SMS (después del PR 2 del 007)
- [ ] T8 · Validar la pasarela en un teléfono de David: webhook firmado, reintentos, envío por API y costo real del paquete de SMS (P5, P12; criterio 23).
- [ ] T9 · Migración de P8 y su `rls_NNN.sql`; advisors sin hallazgos (criterios 6, 7, 12, 22).
- [ ] T10 · Backend: `POST /api/sms/entrante`, parser, código (P7) y respuestas (criterios 11 a 17 y 21) → prueba: `tests/sms017.test.js`.
- [ ] T11 · App: activación con consentimiento y SMS de confirmación (criterios 4 a 7).
- [ ] T12 · App: «Pedir por SMS» con la aplicación de mensajes y la vuelta de la señal (criterios 8 a 10, 18 y 19).
- [ ] T13 · Conductor: marca «Pedido por SMS» (criterio 20).
- [ ] T14 · **David:** prueba en Crucita sin megas: activar, pedir por SMS, recibir la respuesta y ver el viaje al volver la señal.

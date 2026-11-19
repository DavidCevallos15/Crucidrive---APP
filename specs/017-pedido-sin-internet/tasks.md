# 017 · Tareas

Cada tarea indica su prueba y se tilda solo al cumplirse.

## Parte A · Pedir sin depender del mapa
- [x] T1 · Spec aprobada (R1 a R8), D-21 en la constitución y plan → revisión de David el 19 nov 2026.
- [ ] T2 · `estaSinInternet` en `src/utils/conexion.ts` y el hook `useSinInternet`, con 6 s de gracia y sin aviso cuando no hay sesión (P1, criterio 2) → prueba: `tests/sinInternet017.test.ts`.
- [ ] T3 · Píldora «Sin internet» en la pantalla del pasajero, visible también con un viaje activo (P2, criterio 2) → prueba: textos en `tests/sinInternet017.test.ts` y revisión en el APK (T7).
- [ ] T4 · `PlanoSectores` y `src/utils/planoSectores.ts` (P3, criterio 2) → prueba: proyección con norte arriba y el mar a la izquierda, todo dentro de la caja, sin deformar y sin dibujar un GPS fuera de Crucita.
- [ ] T5 · `solicitar`: `sinConexion` cuando la red falla o se acaba el tiempo; con un 409, sincroniza y da por hecho el viaje que ya existe. «No se pudo enviar» con «Reintentar» (P4, criterio 3). Pedido completo solo con datos locales (criterio 1) → prueba: acciones reales del hook en `tests/sinInternet017.test.ts`.
- [ ] T6 · Sin errores de tipos nuevos en `src/` y `app/` → prueba: `npx tsc --noEmit` filtrado a `^(src|app)/`.
- [ ] T7 · **David:** en el APK `preview` (por aire), con los datos móviles apagados: a los 6 s aparecen el aviso y el plano; «Solicitar» responde «No se pudo enviar»; con datos, «Reintentar» crea un solo viaje.

## Partes B a G · Pedir por SMS (después del PR 2 del 007)
- [ ] T8 · Validar la pasarela en un teléfono de David: webhook firmado, reintentos, envío por API y costo real del paquete de SMS (P5, P12; criterio 23).
- [ ] T9 · Migración de P8 y su `rls_NNN.sql`; advisors sin hallazgos (criterios 6, 7, 12, 22).
- [ ] T10 · Backend: `POST /api/sms/entrante`, parser, código (P7) y respuestas (criterios 11 a 17 y 21) → prueba: `tests/sms017.test.js`.
- [ ] T11 · App: activación con consentimiento y SMS de confirmación (criterios 4 a 7).
- [ ] T12 · App: «Pedir por SMS» con la aplicación de mensajes y la vuelta de la señal (criterios 8 a 10, 18 y 19).
- [ ] T13 · Conductor: marca «Pedido por SMS» (criterio 20).
- [ ] T14 · **David:** prueba en Crucita sin megas: activar, pedir por SMS, recibir la respuesta y ver el viaje al volver la señal.

# 005 · Tareas

Cada tarea indica su prueba y se tilda solo al cumplirse.

## BD y backend (PR 2)
- [ ] T1 · `0017_viaje_en_curso.sql`: columnas, funciones de transición, `punto_recogida`, `calificaciones` con sus funciones y chat en solo lectura (P1 a P5) → prueba: `rls_007.sql`. `rls_001` a `rls_006` siguen en verde y se revisan los advisors. *(SQL en verde en local; falta revisar los advisors cuando David aplique la 0017, T5).*
- [x] T2 · Validación de motivo, confirmación, estrellas y comentario en `utils/validation.js`, con los mismos patrones que los CHECK → prueba: `tests/viaje005.test.js`.
- [x] T3 · Endpoints de P6 y `PATCH /:id/estado` sobre `cancelar_viaje` → prueba: `tests/viaje005.test.js` (códigos 400, 403, 409 y 200; sin detalles internos en la respuesta).
- [x] T4 · Avisos a la otra parte por socket y con la app cerrada (P7) y reseñas en los datos del conductor (P8) → prueba: `tests/viaje005.test.js` y `tests/avisos.test.js` (sin nombre ni teléfono).
- [x] T4b · Finalizar por el pasajero con sanción: `terminar_viaje` para el pasajero en curso y bloqueo en `solicitarViaje` (P5b; criterios 5b y 5c) → prueba: `rls_007.sql` y `tests/viaje005.test.js` (2 no bloquean, 3 sí, se libera a las 24 h, los parámetros se validan).
- [ ] T5 · **David:** aplicar la 0017 en producción antes de desplegar el backend.

## Conductor (PR 3)
- [ ] T6 · `TarjetaViajeActivo`, botón según el estado, «Cómo llegar» y cancelar con motivo (P9; criterios 1 a 9) → prueba: utilidades en `tests/` y capturas en 360 × 640 y 360 × 800.
- [ ] T7 · Reseñas en el perfil del conductor (criterio 17) → prueba: captura y utilidades.

## Pasajero (PR 4)
- [ ] T8 · Estados en `EstadoViaje`, cancelar con motivo y volver a pedir (criterios 3 a 5, 8 y 11) → prueba: `tests/` y captura.
- [ ] T9 · Hoja final: confirmar llegada y calificar, con un solo recordatorio más (criterios 5a, 15 y 16) → prueba: `tests/` y captura.
- [ ] T10 · «★ promedio · reseñas» o «Nuevo» junto al conductor (criterio 18) → prueba: utilidad del texto.
- [ ] T11 · Sin conexión: los botones no avanzan el estado si el servidor no respondió (criterio 20) → prueba: `tests/`.

## Cierre
- [ ] T12 · **David:** prueba con dos teléfonos de un viaje y una encomienda completos: llegada, inicio, final, confirmación y calificación, más una cancelación con motivo de cada lado.

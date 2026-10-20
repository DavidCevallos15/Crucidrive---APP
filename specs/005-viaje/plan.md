# 005 · Plan técnico

Sin servicios nuevos. Una migración (`0017_viaje_en_curso.sql`), endpoints REST, eventos de socket y avisos que reutilizan los del 004, y pantallas del conductor y del pasajero.

## BD (`0017_viaje_en_curso.sql`)

**P1 · Columnas nuevas en `viajes`.**
- `llegado_en`: cuándo el conductor marcó «Llegué».
- `cancelado_por` (`pasajero` | `conductor`) y `motivo_cancelacion`, con un CHECK que acepta solo los cuatro motivos del criterio 8. Lo mismo valida `utils/validation.js`.
- `confirmacion_pasajero` (`llego` | `no_llego`) y `confirmado_en`.
- `finalizado_por` (`conductor` | `pasajero`): registra la finalización del pasajero que lleva sanción (criterio 5b).

Sin coordenadas nuevas: la cancelación queda registrada sin ubicación (criterio 10).

**P2 · Transiciones solo por funciones (criterio 6).**
- Se quita el `grant update (estado, finalizado_en)` a `authenticated`.
- Cada paso es una función `security definer` en `private`, con un envoltorio `security invoker` en `public` (como `aceptar_viaje`). Cada una comprueba quién llama, el estado y el orden:

| Función | Quién | Desde | Hace |
| --- | --- | --- | --- |
| `marcar_llegada` | conductor asignado | aceptado | fija `llegado_en` (no cambia el estado) |
| `iniciar_viaje` | conductor asignado | aceptado | → en curso |
| `terminar_viaje` | conductor asignado o pasajero (con sanción) | en curso | → finalizado con `finalizado_por`; el trigger del 003 deja al conductor disponible |
| `cancelar_viaje(motivo)` | pasajero (solicitado o aceptado) o conductor (aceptado) | | → cancelado, con `cancelado_por` y motivo. En «solicitado» el motivo es opcional (cancelación del 003) |
| `confirmar_llegada(llego)` | pasajero | finalizado, sin confirmar | fija la confirmación |

- `controlar_transicion_viaje` se mantiene como segunda barrera. Con el permiso de `update` revocado, ningún cliente cambia el estado por REST.
- Alternativa descartada: dejar los cambios por REST y validar en el backend. La regla 2 pide que lo valide el servidor; en la BD vale también para cualquier cliente y para la carrera entre dos teléfonos.

**P3 · Punto de recogida (criterios 1 y 2).** `punto_recogida(viaje)` devuelve latitud y longitud del origen solo al conductor asignado y solo mientras el viaje está aceptado o en curso. La app arma con eso el enlace «Cómo llegar».
- Alternativa descartada: leer `viajes.origen` por REST. Devuelve WKB y quedaría legible después del viaje.

**P4 · Calificaciones (criterios 15 a 19).**
- Tabla `calificaciones`: `viaje_id` (clave, una por viaje), `conductor_id`, `estrellas` (1 a 5), `comentario` y `creado_en`.
- El CHECK del comentario exige de 1 a 280 caracteres sin contar espacios, y rechaza enlaces (`http`, `www.`) y números de 7 o más dígitos (teléfonos).
- RLS activo y **sin lectura directa** para nadie de la app. Así el conductor no puede cruzar `viaje_id` con el pasajero (LOPDP, criterio 17).
- `calificar_viaje(viaje, estrellas, comentario)`: solo el pasajero de ese viaje, si está finalizado, sin calificar y sin «no llegué». Si aún no había confirmado, calificar cuenta como «llegó».
- `mis_resenas()`: el conductor ve las suyas (estrellas, comentario y solo la fecha), de la más reciente a la más antigua.
- `resumen_conductor(conductor)`: promedio y número de reseñas. Lo ve el pasajero con un viaje aceptado o en curso con ese conductor (criterio 18) y el propio conductor.
- La confirmación automática a los 30 minutos (criterio 5a) no necesita una tarea programada: se calcula al leer. Una confirmación vacía con `finalizado_en` de hace más de 30 minutos cuenta como «llegó».

**P5 · Chat en solo lectura (criterio 7).** Una política nueva sobre `messages` no deja insertar si el viaje del hilo está finalizado o cancelado. El socket del chat responde un error claro.

## Backend

**P5b · Sanción por finalizar el pasajero (criterio 5c).**
- `solicitarViaje` cuenta los viajes que el pasajero finalizó él mismo en la ventana, leyéndolos con `req.supabase`. Si llega al tope y la última vez fue hace menos del bloqueo, responde 429 con «Podrás pedir de nuevo a las HH:MM».
- Parámetros `SANCION_FINALIZAR_MAX` (3), `SANCION_VENTANA_DIAS` (30) y `SANCION_BLOQUEO_HORAS` (24), validados al arrancar como los de D-11.
- `POST /:id/terminar` hecho por el pasajero responde cuántas lleva, para el aviso de la app.
- Alternativa descartada: fijar el tope en la BD con un trigger. Cambiar los números exigiría una migración, y la regla de negocio la aplica el servidor, igual que D-11.

**P6 · Endpoints.** Todos con `req.supabase`, validación previa y `errorResponse` sin detalles internos:
- `POST /api/viajes/:id/llegada`, `/iniciar`, `/terminar`, `/cancelar` (con `{ motivo }`), `/confirmar` (con `{ llego }`) y `/calificar` (con `{ estrellas, comentario }`).
- `GET /api/conductores/resenas` (las propias).
- `PATCH /:id/estado` queda solo para la cancelación del 003 y llama a `cancelar_viaje`; se retira cuando la app ya no lo use.

**P7 · Avisos a la otra parte (criterios 3, 4, 5 y 8).**
- Por socket (`viaje_estado` con `{ viajeId, cambio, encomienda }`) y por aviso con la app cerrada. `cambio` es `llegada`, `en_curso`, `finalizado`, `finalizado_por_pasajero`, `cancelado_por_pasajero` o `cancelado_por_conductor`; el detalle (hora, motivo) la app lo lee del viaje.
- Textos nuevos en `avisos/mensajes.js`, sin nombre ni teléfono: «Tu tricimoto llegó», «Tu viaje terminó: confirma y califica» y «El conductor canceló el viaje». En encomienda: «Recogimos tu paquete» y «Tu paquete fue entregado».

**P8 · Datos del conductor para el pasajero (criterio 18).** `datosDelConductor` añade promedio y número de reseñas con `resumen_conductor`.

## App

**P9 · Conductor (criterios 1 a 9).**
- `TarjetaViajeActivo` en la consola: recogida, destino, personas y total (o encomienda con contenido y destinatario), distancia, Llamar, Chat y «Cómo llegar» (abre `https://www.google.com/maps/dir/?api=1&destination=lat,lng`, gratis y sin clave).
- Un botón grande según el estado: «Llegué» → «Empezar viaje» (o «Paquete recogido») → «Llegamos» (o «Paquete entregado»).
- «Cancelar viaje» con confirmación y motivo, solo mientras está aceptado.
- Botones de 64 px como mínimo, que caben en 360 × 640 (010). En el perfil, sus estrellas, reseñas y comentarios.

**P10 · Pasajero (criterios 3 a 5a, 8 y 11 a 18).**
- `EstadoViaje` muestra «Va en camino», «Llegó», «En viaje» y «Terminado».
- «Cancelar viaje» con motivo mientras está aceptado.
- Al terminar, una hoja con el resumen, «Llegué» o «No llegué», y las estrellas con comentario opcional. Si la cierra sin calificar, se le ofrece una sola vez más al abrir la app.
- Junto a nombre y placa, «★ 4,8 · 23 reseñas» o «Nuevo».

**P11 · Sin conexión (criterio 20).** Cada botón espera la respuesta del servidor y, si falla, muestra que no se pudo y no avanza el estado en la pantalla.

## Pruebas
- `rls_007.sql`: quién puede cada transición y en qué orden; cancelación con motivo; confirmación; calificación una vez; comentario con enlace o teléfono rechazado; conductor sin lectura de `calificaciones`; `mis_resenas` sin `viaje_id`; chat cerrado al terminar.
- Backend: `tests/viaje005.test.js` con clientes simulados (validación, códigos, avisos).
- Frontend: utilidades puras (siguiente botón según el estado, enlace «Cómo llegar», texto del resumen de reseñas y validación del comentario).
- Capturas en 360 × 640 y 360 × 800 (criterio 6 del 010).

## Orden de entrega
1. Este plan, con las tareas, para revisión.
2. BD y backend (0017, endpoints y avisos), con `rls_007` y pruebas. La 0017 se aplica antes de desplegar el backend.
3. Pantallas del conductor.
4. Pantallas del pasajero y calificaciones.

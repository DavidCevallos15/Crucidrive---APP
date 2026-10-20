# 005 · Viaje en curso: recogida, seguimiento, cancelación y cierre

Estado: **Aprobada** al fusionar el PR #49 (20 oct 2026). Decisiones de David del mismo día al final: calificaciones sí, motivos de cancelación sí y llegada confirmada por las dos partes.

## Por qué
El 003 y el 004 terminan en el momento en que un conductor acepta. Desde ahí, la app no acompaña el viaje. En la prueba con dos teléfonos del 20 oct 2026 (APK con el 009) se vio así:

- El conductor acepta y solo recibe un mensaje: «Coordina con el pasajero desde la pestaña Chat». No ve dónde recoger al pasajero ni el paquete, ni tiene cómo marcar que llegó, que empezó el viaje o que terminó.
- El pasajero solo puede cancelar mientras se busca conductor. Una vez aceptado, si cambia de planes o la tricimoto no llega, no tiene un botón para cancelar.
- El conductor sigue ocupado hasta que algo lo libere: como no hay forma de finalizar el viaje, no vuelve a ser candidato.
- El pasajero ve «Tu conductor está a 10 m», pero no ve la tricimoto en el mapa. En Android el mapa necesita la clave de Google Maps (D-02), que todavía no está configurada.

El 003 y el 004 dejaron esto para el 005 de forma explícita: «pantallas de viaje en curso, llegada, cancelación con motivo después de aceptar y calificaciones».

## Historias
- Como **conductor con un viaje aceptado**, quiero ver dónde recojo al pasajero o el paquete y llegar ahí con la app de mapas de mi teléfono, sin pedirle la dirección por chat.
- Como **conductor**, quiero marcar «Llegué», «Empezar viaje» y «Terminar viaje» con botones grandes, y volver a recibir ofertas al terminar.
- Como **pasajero**, quiero enterarme de que la tricimoto llegó aunque tenga el teléfono bloqueado, y ver en qué momento va el viaje.
- Como **pasajero o conductor**, quiero cancelar un viaje ya aceptado indicando el motivo, y que la otra persona se entere.
- Como **pasajero de una encomienda**, quiero saber cuándo el conductor recogió el paquete y cuándo lo entregó.
- Como **pasajero**, quiero confirmar que llegué (o que la encomienda se entregó) y calificar al conductor con estrellas y, si quiero, un comentario.
- Como **conductor**, quiero ir sumando estrellas y reseñas, y leer los comentarios que me dejan.

## Criterios de aceptación

### Recogida
1. **Dado** un conductor con un viaje aceptado, **cuando** mira la consola, **entonces** ve una tarjeta del viaje con: el punto de recogida (lugar o referencia y sector), el destino, las personas y el total, o «Encomienda · precio a convenir», la distancia hasta el punto de recogida y los botones Llamar y Chat. En una encomienda ve además el contenido y quién recibe (criterio 6 del 009).
2. **Dado** esa tarjeta, **cuando** el conductor pulsa «Cómo llegar», **entonces** se abre la app de mapas del teléfono con el punto de recogida como destino. CruciDrive no calcula rutas propias.
3. **Dado** un viaje aceptado, **cuando** el conductor pulsa «Llegué», **entonces** el pasajero recibe «Tu tricimoto llegó», con la app abierta o cerrada, sin teléfono ni nombre en el aviso (criterio 6 del 004).

### Viaje en curso y cierre
4. **Dado** un viaje aceptado, **cuando** el conductor pulsa «Empezar viaje» (en una encomienda: «Paquete recogido»), **entonces** el viaje pasa a «en curso» y el pasajero lo ve sin recargar.
5. **Dado** un viaje en curso, **cuando** el conductor pulsa «Llegamos» (en una encomienda: «Paquete entregado»), **entonces** el viaje queda finalizado y el conductor vuelve a ser candidato si sigue disponible. El pasajero recibe un aviso y ve un resumen: el total en efectivo en un viaje, o «Precio acordado con el conductor» en una encomienda.
5a. **Dado** ese viaje finalizado por el conductor, **cuando** el pasajero lo ve, **entonces** confirma «Llegué» (en una encomienda: «Se entregó») o indica «No llegué» / «No se entregó». La llegada queda confirmada por las dos partes. Si el pasajero no responde en 30 minutos, se toma como confirmada. Un «No llegué» queda registrado para el administrador (paso 006) y no reabre el viaje.
6. **Dado** cualquiera de esos pasos, **cuando** lo pide alguien que no es el conductor asignado o va fuera de orden (aceptado → en curso → finalizado), **entonces** el servidor lo rechaza. El cliente no decide transiciones (regla 2).
7. **Dado** un viaje finalizado o cancelado, **cuando** cualquiera abre el chat, **entonces** lo ve en solo lectura.

### Cancelación después de aceptar
8. **Dado** un viaje aceptado que aún no está en curso, **cuando** el pasajero o el conductor pulsa «Cancelar viaje», **entonces** la app pide confirmación y un motivo de una lista corta («Ya no lo necesito», «Tarda demasiado», «No encuentro al pasajero», «Otro»). El viaje se cierra como cancelado y la otra persona recibe un aviso.
9. **Dado** un viaje en curso, **cuando** alguien intenta cancelarlo desde la app, **entonces** no puede: el viaje solo se termina. Si hay un problema, están el chat, la llamada y el SOS.
10. **Dado** una cancelación, **cuando** se registra, **entonces** queda quién canceló, cuándo, en qué estado estaba el viaje y el motivo, sin coordenadas (LOPDP, criterio 17 del 003).
11. **Dado** un viaje cancelado por el conductor, **cuando** el pasajero lo ve, **entonces** puede volver a pedir con un toque, sin rellenar todo de nuevo (como en el criterio 11 del 003).

### Seguimiento
12. **Dado** un viaje aceptado o en curso y la app con mapa disponible, **cuando** el pasajero mira la app, **entonces** ve la tricimoto en el mapa (criterio 13 del 004) y el conductor ve el punto de recogida. Sin mapa (Android sin la clave de D-02), los dos ven la distancia y «Última posición hace X s», como hoy.
13. **Dado** un viaje finalizado o cancelado, **cuando** termina, **entonces** el pasajero deja de ver la posición del conductor (criterios 14 y 15 del 004).

### Calificaciones
15. **Dado** un viaje confirmado como llegado (criterio 5a), **cuando** el pasajero lo confirma, **entonces** puede calificar al conductor con 1 a 5 estrellas y un comentario opcional (hasta 280 caracteres). Puede omitirlo; se le vuelve a ofrecer una sola vez, la próxima vez que abra la app.
16. **Dado** un viaje, **cuando** ya tiene calificación, **entonces** no se puede calificar otra vez. Solo califica el pasajero de ese viaje, y solo si llegó a finalizarse (no si se canceló).
17. **Dado** un conductor, **cuando** abre su perfil, **entonces** ve su promedio de estrellas, el número de reseñas y los comentarios, del más reciente al más antiguo, sin el nombre ni el teléfono de quien los escribió (LOPDP).
18. **Dado** un pasajero con un viaje aceptado, **cuando** ve los datos del conductor, **entonces** también ve su promedio y número de reseñas («★ 4,8 · 23 reseñas», o «Nuevo» si aún no tiene).
19. **Dado** un comentario, **cuando** se guarda, **entonces** se rechaza si está vacío solo con espacios o supera el límite. Los comentarios no admiten enlaces ni números de teléfono, para evitar datos personales y spam.

### Sin conexión
20. **Dado** que el conductor o el pasajero pierde la conexión, **cuando** pulsa un botón del viaje, **entonces** la app muestra que no se pudo y no da el paso por hecho. El estado «sin conexión» se ve siempre (regla 6).

## Fuera de alcance
- Rutas por calles, tiempo estimado de llegada y navegación dentro de la app: se usa la app de mapas del teléfono.
- Cobro o pagos en línea, y registrar el importe negociado de una encomienda (D-14).
- Penalizaciones por cancelar, viajes programados y compartir tricimoto.
- Lista de varias ofertas para el conductor y diseño compacto: spec 010.
- Que el conductor califique al pasajero, y responder o reportar comentarios: se evalúa en el piloto.
- Moderación de comentarios por el administrador: paso 006.

## Dependencias
- **Clave de Google Maps (D-02)** para ver la tricimoto y el punto de recogida en el mapa de Android. El SDK móvil no se cobra, pero Google exige una cuenta de facturación activa. Sin la clave, el 005 funciona igual con distancia y texto (criterio 12).

## Decisiones de David (20 oct 2026)
1. **Calificaciones: sí.** El pasajero califica al conductor con estrellas y un comentario opcional; el conductor va sumando estrellas, reseñas y comentarios (criterios 15 a 19).
2. **Motivos de cancelación: sí**, la lista del criterio 8.
3. **Llegada confirmada por las dos partes.** El conductor marca «Llegué» al punto de recogida y «Llegamos» o «Paquete entregado» al final, y el pasajero confirma «Llegué» o «Se entregó» antes de calificar (criterios 3, 5 y 5a).

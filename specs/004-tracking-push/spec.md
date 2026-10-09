# 004 · Avisos con la app cerrada y seguimiento del conductor

Estado: **D-12 y D-13 resueltas por David el 9 oct 2026 (A y B). Pendiente de su "aprobada" (fusionar el PR) para pasar a `plan.md`**

## Por qué
El 003 funciona de punta a punta (prueba de humo 29/29), pero solo mientras el conductor tiene la consola abierta en pantalla. En el piloto eso no se cumple: el conductor guarda el teléfono en el bolsillo, contesta una llamada o abre WhatsApp, y desde ese momento deja de recibir ofertas. Peor aún, deja de enviar su ubicación y a los 60 s ya no es candidato (criterio 2 del 003). Con 3 o 4 tricimotos conectadas, casi todas las solicitudes terminarían "sin conductor".

Al pasajero le pasa lo mismo del otro lado: si bloquea el teléfono mientras busca, no se entera de que un conductor aceptó. Una vez aceptado el viaje, tampoco sabe dónde viene la tricimoto, y por eso llama al conductor para preguntar "¿ya viene?".

El 003 dejó ambas cosas fuera de alcance de forma explícita y anotó que el 004 iba justo después por ser una limitación seria para el piloto.

## Historias
- Como **conductor disponible**, quiero recibir la oferta aunque la app esté en segundo plano o la pantalla bloqueada, con sonido y vibración, y abrirla con un toque para aceptarla o rechazarla.
- Como **conductor disponible**, quiero seguir siendo candidato mientras tengo el teléfono en el bolsillo, sin dejar la app en pantalla; y quiero que, al ponerme no disponible, la app deje de seguir mi ubicación.
- Como **pasajero**, quiero enterarme aunque haya bloqueado el teléfono de que un conductor aceptó mi viaje o de que no hubo tricimotos.
- Como **pasajero con un viaje aceptado**, quiero ver en el mapa dónde viene la tricimoto, cómo se acerca y a cuánto está, sin llamar al conductor.
- Como **conductor con un viaje aceptado**, quiero que el pasajero vea que voy en camino sin que yo tenga que hacer nada.
- Como **sistema**, quiero que nada de esto rompa el presupuesto de datos (15 MB por jornada) ni guarde un historial de recorridos asociado a una persona (LOPDP).

## Criterios de aceptación

### Ubicación del conductor en segundo plano
1. **Dado** un conductor disponible que pasa la app a segundo plano o bloquea la pantalla, **cuando** pasan 10 minutos, **entonces** su ubicación se sigue actualizando en el servidor con la frecuencia que fija el servidor y sigue siendo candidato (criterio 2 del 003).
2. **Dado** un conductor que se pone **no disponible** o cierra sesión, **cuando** la app lo registra, **entonces** deja de seguir y enviar su ubicación en segundo plano en ese momento.
3. **Dado** que el seguimiento en segundo plano está activo, **cuando** el conductor mira el teléfono, **entonces** ve un aviso permanente que dice que CruciDrive está usando su ubicación porque está disponible, y desde ahí puede abrir la app para dejar de estar disponible.
4. **Dado** un conductor que no concedió el permiso de ubicación en segundo plano, **cuando** se pone disponible, **entonces** la app le explica con claridad que solo recibirá ofertas con la app abierta y le muestra cómo concederlo. Puede seguir trabajando así.
5. **Dado** el seguimiento en segundo plano, **cuando** se pide el permiso por primera vez, **entonces** antes del diálogo del sistema la app muestra una explicación propia: qué se usa, para qué y cuándo se detiene. Además, el consentimiento (LOPDP) se actualiza a una nueva versión que lo menciona, y los conductores que aceptaron la versión anterior la aceptan de nuevo antes de ponerse disponibles.

### Avisos con la app cerrada o en segundo plano
6. **Dado** un conductor disponible con la app en segundo plano o la pantalla bloqueada, **cuando** el servidor le ofrece un viaje, **entonces** recibe un aviso con sonido y vibración en menos de **5 s** (en condiciones normales de señal), que muestra personas, total, origen y destino. No muestra el teléfono ni el nombre del pasajero (criterio 15 del 003).
7. **Dado** ese aviso, **cuando** el conductor lo toca, **entonces** la app se abre en la oferta con el tiempo que le queda según el servidor (R14 del 003). Si ya venció o la tomó otro, ve "Esta oferta ya no está disponible" en vez del modal.
8. **Dado** un aviso de oferta, **cuando** la oferta vence, la toma otro o el pasajero cancela, **entonces** el aviso desaparece de la barra de notificaciones o queda marcado como vencido. El conductor no debe poder abrir una oferta muerta creyendo que sigue viva.
9. **Dado** que el aviso por la conexión en vivo y el aviso con la app cerrada pueden llegar a la vez, **cuando** la app está abierta, **entonces** el conductor ve una sola oferta, nunca dos modales ni un modal y un aviso para el mismo viaje.
10. **Dado** un pasajero que busca conductor con la app en segundo plano, **cuando** un conductor acepta o la solicitud termina sin conductor, **entonces** recibe un aviso. Al tocarlo, la app abre el estado del viaje: aceptado con los datos del conductor, o "No hay tricimotos disponibles ahora" con "Volver a pedir".
11. **Dado** un usuario que cierra sesión, desinstala la app o cambia de teléfono, **cuando** el servidor intenta avisarle, **entonces** no llegan avisos a un teléfono que ya no es suyo. El identificador del teléfono para avisos se borra al cerrar sesión y se reemplaza al iniciar sesión en otro.
12. **Dado** que el servicio de avisos falla o tarda, **cuando** se envía una oferta, **entonces** el despacho no se detiene ni espera. El aviso es un canal adicional y la oferta sigue existiendo en la BD y en la conexión en vivo, igual que en el 003.

### Seguimiento del conductor en el mapa del pasajero
13. **Dado** un viaje aceptado, **cuando** el pasajero mira la app, **entonces** ve la tricimoto en el mapa moviéndose hacia el punto de recogida, con su última posición actualizada como mucho cada pocos segundos, y la distancia aproximada en línea recta ("a 350 m").
14. **Dado** un viaje aceptado o en curso, **cuando** cualquier otra persona (otro pasajero, otro conductor o un visitante) intenta recibir la posición de ese conductor, **entonces** no la recibe. Solo la ve el pasajero de ese viaje, y solo mientras el viaje está `aceptado` o `en_curso`.
15. **Dado** un viaje que termina (finalizado o cancelado), **cuando** el pasajero sigue en la app, **entonces** deja de recibir la posición del conductor en ese momento.
16. **Dado** la posición del conductor durante un viaje, **cuando** se guarda, **entonces** se guarda solo la última posición, como hoy. No se guarda un recorrido histórico asociado al conductor ni al pasajero (regla 4).
17. **Dado** que el pasajero pierde la conexión un rato, **cuando** vuelve, **entonces** ve la posición actual del conductor sin tener que reabrir la app. Mientras no hay datos frescos, el mapa dice "Última posición hace X s".

### Presupuesto y campo
18. **Dado** una jornada de 10 h con el conductor disponible y la app en segundo plano, **cuando** se suman ubicación, avisos y la conexión en vivo, **entonces** el consumo sigue por debajo de **15 MB** (regla 5). La proyección se mide con la prueba de humo, como en el 003.
19. **Dado** el seguimiento en segundo plano, **cuando** el conductor está detenido (esperando en una parada), **entonces** la app envía su ubicación con menos frecuencia que cuando se mueve, sin dejar de ser candidato (60 s del 003). Así se reduce el gasto de batería y de datos.
20. **Dado** un teléfono Android modesto con ahorro de batería agresivo, **cuando** el sistema detiene la app en segundo plano, **entonces** el conductor deja de ser candidato a los 60 s, como en el 003, y al volver a abrir la app ve "Estuviste fuera del despacho" con un enlace para permitir que CruciDrive funcione en segundo plano.

## Fuera de alcance
- **iPhone (iOS).** El piloto es Android (D-02); iOS exige otra cuenta y otro proceso de publicación.
- **Avisos en la versión web (PWA).** El pasajero en web sigue enterándose con la pestaña abierta, como en el 003.
- Ruta por calles y tiempo estimado de llegada: solo distancia en línea recta, sin servicios de pago (D-08, D-09).
- Pantallas del viaje en curso: llegada, "ya estoy aquí", cancelación con motivo después de aceptar y calificaciones (paso 005).
- Avisos de chat con la app cerrada: el chat sigue funcionando con la app abierta. Se puede evaluar en el 005.
- Avisos de promociones o masivos: CruciDrive solo envía avisos de viajes.
- SOS y panel de alertas (paso 006).

## Riesgos
- **Ahorro de batería de los fabricantes.** Algunas marcas comunes en Ecuador (Xiaomi, Samsung con ahorro activo, Tecno o Infinix) matan las apps en segundo plano aunque tengan permiso. Ninguna regla de la app lo evita del todo; por eso existe el criterio 20, y hay que medirlo con los teléfonos reales de los conductores del piloto.
- **Política de Google Play.** La ubicación en segundo plano exige una justificación aprobada por Google y una explicación visible dentro de la app (criterios 3 y 5). Si Google la rechaza, se publica primero sin seguimiento en segundo plano: avisos sí, candidato solo con la app abierta.
- **Retraso de los avisos.** Con la oferta secuencial de 15 s (D-11), un aviso que tarda 8 s le deja al conductor apenas 7 s. Si en el piloto los avisos tardan más de 5 s, habrá que subir el tiempo de la oferta, que es un parámetro del servidor y no exige publicar la app.
- **Consentimiento.** Hay que cambiar el texto LOPDP (criterio 5). Sigue pendiente la revisión legal de la versión 0.1.

## Decisiones de David

### D-12 · Servicio para los avisos con la app cerrada: **A, servicio de avisos de Expo** (David, 9 oct 2026)
Las tres opciones son gratis para el volumen del piloto. Ninguna exige un servicio propio nuevo en nuestro servidor.

- **A. Servicio de avisos de Expo** (recomendada). El backend llama a una API de Expo con el identificador del teléfono, y Expo entrega por el canal de Google (FCM).
  - A favor: ya usamos Expo y EAS, se configura una vez en EAS con las credenciales de Firebase y la app no cambia de librería.
  - En contra: depende de un intermediario (Expo) además de Google, y Expo ve el contenido del aviso (sin teléfono ni nombre del pasajero, criterio 6).
- **B. Firebase Cloud Messaging directo.** El backend habla con Google.
  - A favor: un intermediario menos.
  - En contra: la clave de servicio de Firebase vive en el backend y hay más configuración nativa. La app necesita una librería distinta a la de Expo.
- **C. Servicio de terceros (OneSignal u otro).**
  - A favor: panel y estadísticas.
  - En contra: otro proveedor con acceso a los identificadores de teléfono, más datos personales fuera (LOPDP) y cuotas que pueden cambiar. No se recomienda.

### D-13 · Frecuencia de ubicación: **B, adaptativa** (David, 9 oct 2026)
- **A. Fija** (5 s abierta, 15 s en segundo plano).
- **B. Adaptativa** (recomendada): cada 5 s con la app abierta. En segundo plano, cada 10 s en movimiento y cada 30 s detenido. Así cumple la ventana de 60 s del 003 (criterio 19) y gasta menos batería.

Los valores exactos quedan como parámetros del servidor, igual que en D-11.

# 017 · Pedir una tricimoto sin internet

Estado: **Borrador** (19 nov 2026). Falta la aprobación de David: R1 a R8.

Si se aprueba, se agrega **D-21** a la constitución: el SMS como canal de respaldo y un número receptor propio. Es un servicio nuevo y la regla 8 pide justificarlo en una spec.

## Por qué
En la prueba de campo del 19 nov 2026 en Crucita, el teléfono de prueba no tenía internet. No cargó ni el mapa y no se pudo pedir. Hoy todo el flujo depende de los datos móviles: pedir, recibir la oferta, ver al conductor y el chat.

En la parroquia quedarse sin datos es normal. Pasa por señal débil o por no tener megas. Sin internet, el pasajero vuelve a esperar en la calle a que pase una tricimoto, que es justo lo que la app quiere evitar.

Hay dos casos distintos:

| Caso | Qué funciona | Qué hace falta |
| --- | --- | --- |
| **Datos débiles** (señal lenta) | Un pedido pequeño puede salir. El mapa pesa y no carga | Que pedir no dependa del mapa |
| **Sin datos** (sin señal de datos o sin megas) | Llamadas y SMS, pagados con saldo. El GPS del teléfono también funciona sin internet | Otro canal para el pedido |

David pide usar un SMS pagado con el saldo del pasajero como respaldo, **solo si el usuario lo permite**.

## Cómo funciona
1. Con internet, el pasajero activa «Pedir por SMS» en Configuración, ve el costo y confirma su número con un SMS de activación. Lo hace una sola vez.
2. Sin internet, al pedir, la app arma el mensaje y abre la aplicación de mensajes del teléfono con el texto y el número de CruciDrive ya puestos. La persona ve lo que envía y lo envía ella. Ese toque es el permiso.
3. Un número celular de CruciDrive en Ecuador recibe el SMS y lo pasa al servidor. El servidor crea el viaje igual que si viniera de la app: misma tarifa, mismo despacho y mismos límites.
4. El servidor responde por SMS: recibido, aceptado (quién viene) o sin conductor.
5. Cuando vuelve la señal, la app muestra ese viaje como cualquier otro.

## Historias
- Como **pasajero con señal débil**, quiero pedir aunque el mapa no cargue.
- Como **pasajero sin internet**, quiero pedir con un SMS desde la app y saber antes que se cobra de mi saldo.
- Como **pasajero que pidió por SMS**, quiero recibir por SMS quién viene o que no hubo conductor, y poder cancelar.
- Como **pasajero que cuida su saldo**, quiero que la app nunca envíe un SMS sin que yo lo decida.
- Como **sistema**, quiero aceptar un pedido por SMS solo del dueño del número y con los mismos límites que en la app.
- Como **conductor**, quiero recibir el pedido por SMS como cualquier otra oferta y saber que el pasajero quizá no tiene internet.

## Criterios de aceptación

### A. Pedir con datos débiles
1. **Dado** que el mapa no carga, **cuando** el pasajero abre la app, **entonces** igual puede elegir origen y destino por sector, escribir la referencia y pedir. El mapa vacío no bloquea el formulario.
2. **Dado** que no hay conexión con el servidor, **cuando** el pasajero está en la pantalla principal, **entonces** ve el aviso «Sin internet» siempre visible (regla 6). En lugar del mapa vacío ve un plano simple de los sectores de Crucita guardado en el teléfono.
3. **Dado** un pedido enviado con señal débil, **cuando** el servidor no responde a tiempo, **entonces** la app no da el pedido por hecho. Dice «No se pudo enviar» y ofrece «Reintentar» y, si está activo, «Pedir por SMS». Reintentar nunca crea dos viajes.

### B. Activar el pedido por SMS
4. **Dado** un pasajero con sesión e internet, **cuando** abre Configuración, **entonces** ve «Pedir por SMS cuando no haya internet», **apagado** por defecto.
5. **Dado** que lo activa, **cuando** se le explica, **entonces** lee antes de aceptar:
   - que cada pedido envía un SMS desde su línea y cuesta lo que cobre su operadora por un SMS nacional;
   - qué lleva el mensaje: sectores, personas, la referencia y, si él lo permite, su ubicación;
   - que el SMS viaja por la operadora sin cifrar.
   Al aceptar se guardan la versión del texto y la fecha (LOPDP, regla 4).
6. **Dado** que acepta, **cuando** confirma su número, **entonces** la app abre la aplicación de mensajes con un código de activación hacia el número de CruciDrive. Al llegar, el servidor marca el número como confirmado y la app lo muestra. Si el número que envía no es el del perfil, no se activa y la app explica por qué. Activarlo en otro teléfono desactiva el anterior.
7. **Dado** que el pasajero lo desactiva, **cuando** llega un SMS de su número, **entonces** el servidor ya no crea viajes con él.

### C. Pedir por SMS
8. **Dado** que no hay internet y el SMS está activo, **cuando** el pasajero toca «Pedir», **entonces** la app ofrece «Pedir por SMS (usa tu saldo)». **Nunca lo envía sola**: abre la aplicación de mensajes con el texto y el número listos, y la persona decide si lo envía.
9. **Dado** el mensaje armado, **cuando** se muestra, **entonces**:
   - cabe en **un solo SMS** (un solo cobro), sin tildes si hace falta para que quepa;
   - se entiende qué se pide;
   - lleva el sector de origen y el de destino, las personas, una referencia corta y un código que solo la app de ese pasajero puede generar y que vence;
   - lleva la ubicación GPS solo si el pasajero eligió «Tu ubicación» y lo permitió (R3).
   Ejemplo: `CruciDrive: viaje de La Boca a Malecon, 2 personas. Ref: tienda azul. Ubic -0.8801,-80.5402. Cod K7F3Q9`
10. **Dado** que el SMS está apagado o el número sin confirmar, **cuando** no hay internet, **entonces** la app no ofrece el SMS. Explica cómo activarlo para la próxima vez y deja a la vista el SOS, que llama al 911 sin internet.
11. **Dado** un SMS válido, **cuando** llega al servidor, **entonces** se crea el viaje con la misma tarifa (D-08, la fija la BD y no el mensaje), el mismo despacho (D-11 y D-15), la misma sanción del 005 y los mismos topes por usuario del 007.
12. **Dado** un SMS de un número no registrado o sin confirmar, de un pasajero con el SMS apagado, con un código vencido o ya usado, o mal formado, **cuando** llega, **entonces** no se crea ningún viaje. A un número confirmado se le responde una vez por qué. A un número desconocido no se le responde: no se revela quién usa la app (D-18) y no se gastan SMS en spam.
13. **Dado** un pasajero con un viaje activo, **cuando** llega otro SMS de pedido suyo, **entonces** no se crea un segundo viaje y se le responde con el estado del actual.

### D. Respuestas por SMS
14. **Dado** un pedido por SMS, **cuando** un conductor lo acepta, **entonces** el pasajero recibe un SMS con: que fue aceptado, la tricimoto (placa o disco), el nombre del conductor, su teléfono (R4) y cómo cancelar.
15. **Dado** un pedido por SMS, **cuando** nadie acepta en el tiempo de D-11, **entonces** el pasajero recibe «Sin conductor disponible» y cómo volver a pedir.
16. **Dado** un viaje pedido por SMS y todavía no iniciado, **cuando** el pasajero responde `CANCELAR`, **entonces** se cancela con las mismas reglas que en la app, con el motivo «por SMS».
17. **Dado** un pedido por SMS, **cuando** termina, **entonces** generó como máximo 3 SMS de respuesta (recibido, aceptado o sin conductor, y la cancelación si la hubo).

### E. Al volver la señal
18. **Dado** un viaje pedido por SMS, **cuando** vuelve internet, **entonces** la app lo muestra en su estado real, con el conductor en el mapa, el chat y la calificación, igual que un viaje pedido desde la app.
19. **Dado** que la app abrió el SMS y no sabe si salió, **cuando** vuelve la señal, **entonces** consulta primero y no ofrece pedir otra vez si ya hay un viaje activo.

### F. Conductor
20. **Dado** un viaje pedido por SMS, **cuando** le llega la oferta al conductor, **entonces** la ve igual que las demás, con la marca «Pedido por SMS: el pasajero puede no tener internet, llámalo si hace falta». No ve más datos del pasajero que en un viaje normal (D-18 y 007).

### G. Operación y datos
21. **Dado** que el número receptor estuvo sin internet o apagado, **cuando** se pone al día, **entonces** solo se procesan los SMS de los últimos 10 minutos. A los más viejos se les responde «Tu pedido llegó tarde, vuelve a pedir» y no se despachan.
22. **Dado** cada SMS recibido, **cuando** se procesa, **entonces** queda un registro con la hora, el número enmascarado y el resultado. El texto completo no se guarda más de 30 días (minimización, LOPDP).
23. **Dado** el número receptor y sus respuestas, **cuando** se suman al mes, **entonces** caben en el presupuesto del piloto (regla 5: ≤ 25 USD/mes en total).

## Decisiones pendientes (David)
- **R1 · Cuándo.** Propuesta: la parte A antes del piloto, porque es barata y arregla lo que viste en Crucita. Las partes B a G después de cerrar el PR 2 del 007, porque agregan un canal y un número nuevos.
- **R2 · Canal.** SMS o WhatsApp. Propuesta: **SMS**. Sale con solo señal de llamadas. WhatsApp es gratis para quien tiene redes ilimitadas, pero necesita señal de datos, que es justo lo que faltó.
- **R3 · Ubicación GPS en el SMS.** Propuesta: sí, solo con «Tu ubicación» elegida y con el aviso de que viaja sin cifrar. Es lo que permite al conductor llegar al punto exacto sin internet.
- **R4 · Teléfono del conductor en la respuesta.** Propuesta: sí, con la misma regla del 007 (solo a la parte del viaje aceptado). Sin internet no hay chat y llamar es la única forma de coordinar.
- **R5 · Conductores sin internet.** Propuesta: fuera del 017. Mandar las ofertas por SMS multiplica los mensajes (3 candidatos por pedido más el aviso abierto) y complica aceptar. Primero se mide en campo si los conductores tienen datos.
- **R6 · El número receptor.** Propuesta: un chip prepago de David con paquete de SMS, en un teléfono Android con wifi y cargador. No tiene que estar en Crucita: el SMS le llega igual.
- **R7 · Medir la cobertura.** Propuesta: antes del `plan.md`, anotar en Crucita la operadora del teléfono de prueba y, por sector, si hay datos, solo llamadas o nada. Si una operadora sí tiene datos, cambia la prioridad.
- **R8 · Encomiendas por SMS.** Propuesta: no. La descripción, el destinatario y la autorización no caben en un SMS. Sin internet, la app dice que las encomiendas necesitan conexión.

## Fuera de alcance
- Pedir escribiendo el SMS a mano, sin la app: el código lo genera la app.
- Despachar a los conductores por SMS (R5).
- Pedir llamando a una central: depende del aliado institucional (D-07).
- Encomiendas por SMS (R8) y la contraoferta del 013.
- Pagos.
- El SOS sin internet: la llamada al 911 ya sale porque es una llamada, y el registro diferido de la alerta ya está en el criterio 3 del 006.
- Cambiar D-04 o la P3 del 015: confirmar el número aquí es solo para quien activa el SMS. El registro general sigue sin verificar el teléfono.

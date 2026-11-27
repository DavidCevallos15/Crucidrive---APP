# 020 · Pagos y comisiones por créditos para conductores (híbrido por fases)

Estado: **Aprobada por David el 27 nov 2026.** M1 y M2 con las propuestas; M3 aprobada como D-22 en `specs/constitution.md`. Cambio respecto del borrador del 25 nov: **sin Google Play Billing**; las recargas son manuales (DeUna, transferencia, depósito o efectivo) y las acredita el administrador.

## Por qué
CruciDrive necesita ser sostenible arrancando con pocos conductores (3 a 6 unidades activas en Crucita). Una cuota mensual fija baja no cubre los costos y una alta frena la adopción cuando todavía hay pocos pedidos. Los pasajeros pagan en efectivo (0,50 USD por persona en viajes y precio acordado en encomiendas), así que la plataforma necesita cobrar su comisión sin depender de que pasajero o conductor declaren lo que se pagó en efectivo.

Las compras dentro de la tienda se descartan para la Fase 1: la tienda retiene una parte de cada recarga, que con comisiones de 0,10 y 0,20 USD se come buena parte del margen. Las recargas se pagan por canales locales sin costo o de bajo costo y las verifica el administrador.

## Modelo por fases
- **Fase 1 (esta spec):** viajes y encomiendas se siguen pagando en efectivo al conductor. Cada **conductor** tiene un **saldo prepago de créditos**; cada servicio aceptado descuenta una comisión fija desde el servidor. El conductor recarga pagando al administrador por un canal local y el administrador acredita el saldo en el panel.
- **Fase 2 (fuera de alcance):** pagos digitales de pasajeros (billetera o pasarela local), avisos de pago con comprobante enviados desde la app y pase semanal opcional para conductores frecuentes.

## Historias
- Como **conductor nuevo aprobado**, quiero un bono de bienvenida en créditos para completar mis primeros servicios sin pagar por adelantado.
- Como **conductor**, quiero ver mi saldo y un historial claro de recargas, comisiones, devoluciones y ajustes.
- Como **conductor**, quiero que me devuelvan la comisión si el pasajero cancela antes de iniciar el servicio.
- Como **conductor**, quiero saber cómo recargar sin salir de dudas: a quién pagar y qué datos enviar.
- Como **administrador (David)**, quiero acreditar recargas indicando el canal (DeUna, transferencia, depósito, efectivo) y el número de comprobante, sin poder acreditar dos veces el mismo comprobante, y ver el resumen mensual de ingresos.
- Como **administrador**, quiero activar el cobro cuando decida, sin depender de un despliegue.
- Como **plataforma**, quiero que saldos, comisiones y devoluciones se calculen solo en el servidor con un libro contable inmutable.

## Reglas de negocio (Fase 1)
- **Bono de bienvenida:** `2,00 USD` en créditos la primera vez que se aprueba a un conductor. Una sola vez por cédula, aunque la cuenta se elimine y se vuelva a crear.
- **Comisión por encomienda:** `0,20 USD` fijo mientras el precio se acuerde por chat (D-14). Cuando exista `013-encomiendas-contraoferta` y el precio quede registrado, pasará a `10 %` del precio acordado con mínimo de `0,20 USD`; ese cambio se especifica en el 013.
- **Comisión por viaje de pasajeros:** `0,10 USD` fijo por viaje aceptado.
- **Montos de recarga:** paquetes sugeridos de `3`, `5` y `10 USD`; el administrador puede acreditar cualquier monto entre `1` y `50 USD`. Los créditos no caducan mientras la cuenta siga activa.
- **Canales de recarga:** DeUna, transferencia bancaria, depósito y efectivo entregado en persona al administrador. Además, el administrador puede dar créditos de cortesía con motivo.
- **Saldo mínimo para recibir ofertas:** saldo mayor o igual a la comisión más alta vigente (`0,20 USD`). Si al terminar o cancelar un servicio el saldo quedó por debajo, el conductor pasa a no disponible hasta recargar.
- **Devolución automática:** si el pasajero cancela antes de que el servicio pase a «en curso», el servidor devuelve la comisión exacta una sola vez.
- **Cancelación del conductor (M2):** si el conductor cancela después de aceptar, la comisión **no** se devuelve. Una falla técnica atribuible a la plataforma se corrige con un ajuste manual del administrador, con motivo.
- **Interruptor de cobro:** mientras el administrador no active el cobro, no se descuentan comisiones ni se exige saldo mínimo. Los bonos sí se registran.
- **Parámetros:** comisiones, bono, saldo mínimo y el interruptor los cambia el administrador sin desplegar código.

## Criterios de aceptación
1. **Dado** un conductor aprobado por primera vez, **cuando** su verificación pasa a aprobada, **entonces** recibe un único movimiento de bono de `2,00 USD`. Una re-aprobación, o una cuenta nueva con la misma cédula, no vuelve a recibir bono.
2. **Dado** el cobro activo y un conductor con saldo menor al mínimo, **cuando** intenta ponerse disponible, **entonces** el servidor lo rechaza con un mensaje que indica su saldo actual y cómo recargar.
3. **Dado** el cobro activo y un conductor con saldo suficiente, **cuando** acepta un viaje o una encomienda, **entonces** el servidor descuenta `0,10 USD` (viaje) o `0,20 USD` (encomienda) en la misma operación de aceptación, y el saldo nunca queda negativo, ni con solicitudes simultáneas.
4. **Dado** un servicio aceptado con comisión descontada, **cuando** el pasajero lo cancela antes de iniciar el recorrido, **entonces** el servidor registra una devolución exacta, y un segundo intento de devolución para el mismo servicio no suma nada.
5. **Dado** un servicio aceptado, **cuando** lo cancela el conductor, **entonces** no hay devolución.
6. **Dado** el administrador en el panel, **cuando** acredita una recarga, **entonces** debe indicar monto, canal y número de comprobante (o motivo, si es cortesía o efectivo sin comprobante); el movimiento guarda quién lo registró, y el mismo comprobante de un mismo canal no se puede acreditar dos veces.
7. **Dado** un conductor, **cuando** abre su pantalla de créditos, **entonces** ve su saldo, su historial y las instrucciones para recargar (contactar a soporte), sin enlaces ni botones de pago dentro de la app.
8. **Dado** cualquier usuario, **cuando** intenta modificar un saldo o crear, editar o borrar movimientos directamente, **entonces** el sistema lo rechaza; cada conductor solo puede leer los suyos y el administrador los de todos.
9. **Dado** el cobro inactivo, **cuando** un conductor acepta un servicio o se pone disponible, **entonces** no se descuenta nada ni se exige saldo.
10. **Dado** el administrador, **cuando** abre el resumen de créditos, **entonces** ve por mes el total recargado por canal, las comisiones cobradas, las devoluciones, los bonos y los ajustes.

## Fuera de alcance (Fase 1)
- Compras dentro de la tienda (Google Play Billing o Apple). Si se reconsideran, va en una spec nueva.
- Cobro electrónico al pasajero (tarjetas, billetera, PayPhone, DeUna integrado). Fase 2.
- Avisos de pago con foto del comprobante desde la app. Fase 2; en la Fase 1 el comprobante llega por correo a `soporte@tricimoto.app` o en persona.
- Facturación electrónica automática ante el SRI (en la Fase 1 se emite manualmente con el resumen mensual).
- Retiro de créditos a dinero. Los créditos solo sirven para pagar comisiones en CruciDrive, salvo lo que diga la Política de Reembolsos.
- Comisión porcentual de encomiendas (depende del 013).

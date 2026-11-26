# 020 · Pagos y comisiones por créditos para conductores (híbrido por fases)

Estado: **Borrador basado en las recomendaciones aceptadas por David el 25 nov 2026.** Pendiente de confirmación final de montos/reglas y actualización de D-03/D-19 en `specs/constitution.md` antes de escribir `plan.md` y código (regla 1).

## Por qué
CruciDrive necesita ser sostenible y rentable incluso arrancando con pocos conductores (3 a 6 unidades activas en Crucita). Una cuota mensual fija baja (ej. 5 USD/mes) no cubre el escalado con pocos conductores, y una cuota fija alta frena la adopción cuando todavía hay pocos pedidos. Al mismo tiempo, los pasajeros pagan en efectivo (0,50 USD por persona en viajes y precio acordado en encomiendas), por lo que la plataforma necesita un mecanismo seguro de mediación que garantice el cobro de su comisión sin depender de que pasajero y conductor reporten cambios de precio en efectivo.

## Modelo por fases
- **Fase 1 (lanzamiento en Play Store):** los viajes y encomiendas siguen pagándose en efectivo directamente al conductor. Los **conductores** mantienen un **saldo prepago de créditos** en la app; cada servicio aceptado descuenta una comisión fija o mínima desde el servidor.
- **Fase 2 (post-piloto, fuera de este primer alcance):** pagos digitales de pasajeros (billetera recargable o pasarela local ecuatoriana como PayPhone/DeUna) y pase semanal opcional para conductores frecuentes.

## Historias
- Como **conductor nuevo aprobado**, quiero recibir un bono de bienvenida en créditos para probar CruciDrive y completar mis primeros viajes y encomiendas sin pagar por adelantado.
- Como **conductor**, quiero recargar paquetes pequeños de créditos desde la app y ver un historial claro de cada recarga, comisión descontada y devolución.
- Como **conductor**, quiero que me devuelvan automáticamente la comisión si el pasajero cancela antes de iniciar el servicio, para no perder dinero por cancelaciones ajenas.
- Como **administrador (David)**, quiero poder acreditar recargas o cortesías manualmente (por ejemplo, pagos acordados localmente con conductores o cooperativas en Crucita) con auditoría inmutable, y ver el resumen de ingresos y consumos.
- Como **plataforma**, quiero que el cálculo de saldos, comisiones y devoluciones ocurra únicamente en el servidor con un libro contable inmutable, para que nadie pueda alterar su saldo desde el teléfono.

## Reglas de negocio propuestas (Fase 1)
- **Bono de bienvenida:** `2,00 USD` en créditos al aprobarse el conductor por primera vez (una sola vez por cuenta y cédula).
- **Comisión por encomienda:** `0,20 USD` fijo mientras el precio sea libre por chat; cuando exista contraoferta registrada (`013`), `10 %` del precio acordado con un **mínimo de `0,20 USD`**. Aunque pasajero y conductor ajusten el pago en efectivo fuera de la app, la comisión de mediación ya quedó liquidada.
- **Comisión por viaje de pasajeros:** `0,10 USD` fijo por viaje aceptado.
- **Paquetes de recarga dentro de la app:** `3,00 USD`, `5,00 USD` y `10,00 USD` (sin caducidad mientras la cuenta siga activa).
- **Saldo mínimo para recibir ofertas:** el conductor debe tener saldo mayor o igual a la comisión máxima vigente (`0,20 USD`) para ponerse disponible y recibir ofertas. Si su saldo baja de ese umbral al aceptar un servicio, termina el servicio actual y pasa a no disponible hasta recargar.
- **Reembolso automático de comisión:** si el pasajero cancela antes de que el viaje pase a «en curso» (o si la solicitud se cancela por causa ajena al conductor), el servidor registra un asiento de devolución automático en el libro contable del conductor.

## Criterios de aceptación
1. **Dado** un conductor recién aprobado por primera vez, **cuando** su verificación pasa a aprobada, **entonces** recibe un único asiento de bono inicial de `2,00 USD` en créditos. Una re-aprobación posterior no vuelve a otorgar bono.
2. **Dado** un conductor con saldo menor al mínimo configurado (`0,20 USD`), **cuando** intenta ponerse disponible, **entonces** el servidor lo rechaza con un mensaje claro indicando su saldo actual y cómo recargar.
3. **Dado** un conductor disponible con saldo suficiente, **cuando** acepta un viaje de pasajeros o una encomienda, **entonces** el servidor descuenta atómicamente `0,10 USD` (viaje) o `0,20 USD` (encomienda) en un libro contable inmutable en la misma operación de aceptación, sin posibilidad de saldo negativo por solicitudes simultáneas.
4. **Dado** un viaje o encomienda aceptado cuya comisión fue descontada, **cuando** el pasajero cancela antes de iniciar el recorrido, **entonces** el servidor registra automáticamente un asiento de reintegro exacto al conductor y evita devoluciones duplicadas.
5. **Dado** un conductor que compra un paquete de créditos dentro de la app móvil, **cuando** la tienda confirma el pago, **entonces** el servidor verifica la validez del comprobante directamente con la tienda antes de acreditar el saldo y garantiza idempotencia (un mismo comprobante nunca se acredita dos veces).
6. **Dado** el administrador en el panel web, **cuando** acredita una recarga manual o ajuste a un conductor, **entonces** debe indicar monto y motivo; el sistema registra el movimiento con el identificador del administrador y el conductor ve el nuevo saldo y el movimiento en su historial.
7. **Dado** cualquier usuario (pasajero o conductor), **cuando** intenta modificar su saldo o insertar movimientos directamente, **entonces** el sistema lo rechaza; solo puede leer sus propios movimientos.
8. **Dado** la app móvil en Android, **cuando** el conductor abre la pantalla de créditos, **entonces** las compras dentro de la app usan exclusivamente el flujo oficial de la tienda y no incluyen enlaces ni botones hacia pasarelas de pago externas (cumplimiento de políticas de Play Store).

## Decisiones pendientes para confirmar antes del plan
- **M1 · Montos iniciales:** confirmar `0,10 USD` por viaje, `0,20 USD` mínimo por encomienda, `2,00 USD` de bono de bienvenida y paquetes de `3 / 5 / 10 USD`.
- **M2 · Cancelación del conductor:** si el conductor cancela después de aceptar sin llegar al punto de recogida, ¿se le retiene la comisión para desincentivar cancelaciones falsas o se devuelve solo en las primeras N cancelaciones? Propuesta: devolver solo si cancela el pasajero (o por falla técnica); si cancela el conductor tras aceptar, la comisión no se devuelve.
- **M3 · Actualización de la constitución:** aprobar la enmienda de D-03/D-19 para habilitar cobros de créditos a conductores manteniendo el efectivo para pasajeros en Fase 1.

## Fuera de alcance (Fase 1)
- Cobro electrónico al pasajero dentro de la app (tarjetas, billetera pasajero, PayPhone/DeUna/Kushki). Se aborda en Fase 2.
- Facturación electrónica automatizada ante el SRI (en Fase 1 se emite manualmente según reportes mensuales del panel admin; se automatiza cuando el volumen lo justifique).
- Retiro de créditos a dinero en efectivo (los créditos solo sirven para aceptar servicios en CruciDrive, sujeto a la Política de Reembolsos).
- Compras dentro de la app en iOS (se activan junto con `021-ios-nativo` cuando exista cuenta de Apple Developer).

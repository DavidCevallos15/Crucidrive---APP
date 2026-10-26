# 006 · SOS con registro de alertas y panel del administrador

Estado: **Borrador. Pendiente de aprobación de David.** Las decisiones A a D del final traen una propuesta; hasta que las confirme no se escribe plan ni código.

## Por qué
La decisión D-05 dice que el SOS abre el marcador del 911 y **además registra la alerta con ubicación para el panel del administrador**. Hoy solo hace lo primero: el botón se mantiene pulsado dos segundos y abre el marcador, y no queda ningún registro. La spec 012 (criterio 4) dejó claro que esto no se presenta como implementado.

El paso 005 también prometió algo a este paso: cuando el pasajero responde «No llegué» o «No se entregó», **queda registrado para el administrador** y no reabre el viaje. Hoy el dato está en la BD y nadie lo ve.

Regla que no cambia: **CruciDrive no sustituye al 911.** La llamada es lo importante; el registro es un apoyo para el administrador, y la app no promete que alguien responda.

## Historias
- Como **pasajero o conductor en peligro**, quiero que el SOS me ponga primero en la llamada al 911, sin esperar a la red, y que además avise al administrador dónde estoy.
- Como **administrador**, quiero ver las alertas que entraron, dónde y cuándo, y poder llamar a quien la envió, para dar seguimiento y dejar constancia.
- Como **administrador**, quiero ver los viajes donde el pasajero dijo «No llegué», para revisarlos.
- Como **usuario**, quiero saber con claridad si la alerta quedó registrada o no, sin que eso retrase la llamada.

## Criterios de aceptación

### Enviar la alerta
1. **Dado** un pasajero o un conductor con sesión, **cuando** mantiene pulsado el SOS dos segundos, **entonces** el marcador del 911 se abre **de inmediato**, antes de cualquier consulta a la red. Que el registro falle o tarde no retrasa ni impide la llamada.
2. **Dado** esa activación, **cuando** hay conexión, **entonces** se registra una alerta con: hora, rol, el viaje en curso si lo hay y la ubicación del momento. La ubicación sale del GPS actual; si no hay, de la última conocida; si tampoco, la alerta se registra sin ubicación y lo dice.
3. **Dado** que no hay conexión al activar el SOS, **cuando** vuelve la señal dentro de la siguiente hora, **entonces** la alerta se envía sola con la hora real de la activación y se marca como «enviada con retraso». Pasada esa hora no se envía: una ubicación vieja engaña más de lo que ayuda.
4. **Dado** un visitante sin sesión, **cuando** activa el SOS, **entonces** solo se abre el marcador del 911. No hay registro porque no hay a quién llamar de vuelta, y la app se lo dice.
5. **Dado** un usuario que activa el SOS varias veces seguidas, **cuando** ya tiene una alerta abierta de los últimos 10 minutos, **entonces** se actualiza esa alerta con la ubicación nueva en vez de crear otra. El límite nunca impide abrir el marcador.
6. **Dado** el resultado del registro, **cuando** termina, **entonces** el usuario ve un mensaje breve: «Alerta registrada. Si estás en peligro, sigue en la llamada al 911» o «No se pudo registrar la alerta. Lo importante es la llamada al 911». Ninguno promete que alguien irá.

### Qué se guarda y quién lo ve
7. **Dado** una alerta, **cuando** se guarda, **entonces** lleva solo lo necesario: hora, usuario, rol, viaje, coordenadas con su precisión y si llegó con retraso. No lleva audio, fotos ni contactos.
8. **Dado** una alerta, **cuando** alguien que no es administrador intenta leerla o cambiarla (incluida la otra parte del viaje), **entonces** no puede. El usuario solo puede crear la suya; no ve las de otros ni edita la que envió.
9. **Dado** una alerta cerrada hace más de **90 días**, **entonces** sus coordenadas se borran y queda el registro sin ubicación (hora, rol, estado y nota). *(Propuesta B.)*

### Panel del administrador
10. **Dado** el administrador, **cuando** abre el panel, **entonces** ve la lista de alertas con las **abiertas primero** y, dentro de cada grupo, las más recientes arriba. Cada fila muestra hora, rol, si va en viaje y su estado.
11. **Dado** una alerta, **cuando** el administrador la abre, **entonces** ve la hora, el rol, el nombre y el teléfono de quien la envió, el viaje si lo hay, y la ubicación con un botón «Ver en el mapa» que abre la app de mapas del teléfono (como «Cómo llegar» del 005, sin rutas propias) y un botón «Llamar». Si la alerta llegó con retraso o sin ubicación, lo dice.
12. **Dado** una alerta abierta, **cuando** el administrador la cierra, **entonces** elige cómo terminó (**atendida**, **falsa alarma** o **prueba**) y puede dejar una nota corta. Queda quién la cerró y cuándo. Una alerta cerrada no se vuelve a abrir; si hay una nueva, es otra alerta.
13. **Dado** el panel, **cuando** muestra el texto de ayuda, **entonces** dice que CruciDrive **no es un servicio de emergencias** y que ante un peligro real se llama al 911. Ninguna pantalla sugiere lo contrario.
14. **Dado** una alerta nueva, **cuando** llega, **entonces** el administrador recibe un aviso en su teléfono, aunque no tenga el panel abierto, sin nombre ni teléfono del usuario en el texto (criterio 6 del 004). Si el aviso falla, la alerta sigue en el panel. *(Propuesta A.)*

### «No llegué»
15. **Dado** un viaje donde el pasajero respondió «No llegué» o «No se entregó», **cuando** el administrador abre la sección de reportes de viaje, **entonces** lo ve con fecha, tipo (viaje o encomienda), conductor y pasajero, y puede marcarlo como **revisado** con una nota corta. No reabre el viaje ni cambia su estado. *(Propuesta C.)*

### Estado de la prueba
16. **Dado** que el piloto puede tener pruebas, **cuando** el administrador cierra una alerta como «prueba», **entonces** no cuenta como incidente en el resumen del panel (número de alertas abiertas y de los últimos 30 días).

## Fuera de alcance
- Que CruciDrive despache ayuda, hable con el ECU 911 o sustituya al 911 en cualquier forma.
- Que **la otra parte del viaje se entere** de la alerta. Por defecto no: podría empeorar una situación de riesgo. *(Propuesta D.)*
- Seguimiento continuo de la ubicación después del SOS, grabación de audio o de pantalla.
- Contactos de confianza y mensajes a familiares.
- Sanciones o suspensiones de cuentas a partir de una alerta o de un «No llegué»: el administrador decide por fuera, y cualquier regla automática necesitaría su propia spec.
- Un agente que apruebe conductores o atienda alertas solo: lo diseña David aparte, con su propio usuario de administrador.

## Riesgos y cosas a vigilar
- **Nadie mirando.** Si el administrador no está atento, la alerta queda sin respuesta. Por eso el mensaje al usuario no promete nada (criterio 6) y el aviso al administrador es un apoyo, no una garantía.
- **Ubicación sensible.** Es el dato más delicado de la app. El texto de consentimiento debe cubrir expresamente el SOS, y **sigue pendiente la revisión de un abogado** (LOPDP; paso 002).
- **Falsas alertas.** El mantener dos segundos ya evita las accidentales; la nota y el cierre «falsa alarma» dejan constancia para ver patrones.
- **Pasajero sin GPS.** Con el permiso negado, la alerta va sin ubicación; la app lo avisa antes de que haga falta.

## Decisiones para David
Propuestas por defecto; cada una se puede cambiar antes de escribir el plan.

- **A. Aviso al administrador cuando llega una alerta.** Propuesta: **sí**, con el servicio de avisos de Expo que ya existe (D-12), sin infraestructura nueva. Alternativa: solo panel, que obliga a tenerlo abierto.
- **B. Cuánto se guardan las coordenadas.** Propuesta: **90 días** después de cerrar la alerta; después queda el registro sin ubicación. Alternativa: guardar siempre, que choca con la idea de guardar solo lo necesario.
- **C. «No llegué» en este paso.** Propuesta: **sí**, como lista aparte en el mismo panel, porque el 005 lo dejó a cargo del 006. Alternativa: dejarlo para el 007.
- **D. La otra parte del viaje no se entera de la alerta.** Propuesta: **no se entera**. Alternativa: avisarle, que puede ser útil si el conductor está en peligro, pero también riesgoso si el aviso llega al agresor.

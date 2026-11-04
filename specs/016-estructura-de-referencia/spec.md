# 016 · Estructura de pantallas tomada de una app de referencia

Estado: se redactó como 014 y se renumeró: el 014 quedó para `014-mapa-y-recogida` (pin fijo, ruta por calles opcional y color de la tricimoto) y el 013 para las encomiendas con contraoferta (D-19). **Aprobada por David el 4 nov 2026**, con las propuestas:
- **Q1:** un rol por cuenta. El menú del pasajero muestra «Quiero manejar en CruciDrive».
- **Q2:** sin fecha de nacimiento.
- **Q3 y Q4:** el código de abordaje y los contactos de emergencia quedan para una spec posterior. El `006` aprobado no los incluye.
- **Q5:** en la pantalla de beneficios solo va lo que es verdad hoy: horario libre, menos «vuelteo» y gasolina, y encomiendas con un precio que el conductor acepta o contraoferta (D-19). Nada sobre comisiones ni cuotas mientras no se decida.
- **Q7:** la calificación se muestra desde 5 calificaciones.
- **Pendiente:** el número o el correo de Soporte (Q6). Hasta tenerlo, Soporte abre el correo de contacto del proyecto.
- **SOS:** la pantalla Seguridad sigue los criterios 1a a 1c del `006` (escudo en la cabecera y 911 grande). No hay SOS en la pantalla principal.

## Por qué
David compartió capturas y dos videos de InDrive (inicio del pasajero, ruta, menú, historial, seguridad, configuración y registro de conductor) y pidió copiar los componentes útiles para una app de tricimotos, con la paleta del 011 (crema #FEE8C1, vino #7F1139, azul #88AEE0).

Se copia la **estructura y el comportamiento**, no la marca. No se usan el verde lima de InDrive, sus ilustraciones, sus íconos ni los nombres de sus servicios. Todo lo que no sirve para tricimotos en Crucita se descarta (ver la tabla).

## Qué se toma y qué no

| Componente de referencia | Decisión | Cómo queda en CruciDrive |
| --- | --- | --- |
| Mapa a pantalla completa, con un pin fijo al centro y la etiqueta «Punto de recogida» | **En el 014** | Se especifica en `014-mapa-y-recogida`: el pin fijo, la etiqueta con el lugar del catálogo y el sector (D-09), y la validación de la zona en el servidor. Esta spec solo asume que existe |
| Botón para volver a mi ubicación | **Tomar** | Igual. Fuera de Crucita aplica el aviso del 012 (criterio 7) |
| Selector de servicio (viaje, ciudad a ciudad, flete, mensajería) | **Adaptar** | Solo dos opciones: **Viaje** y **Encomienda** (D-03, D-14). Ciudad a ciudad y flete se descartan |
| Barra «¿A dónde y por cuánto?» | **Adaptar** | En viajes, «¿A dónde vas?»: el precio no se negocia (D-08). En encomiendas, «¿A dónde y por cuánto?»: el pasajero propone su precio (D-19, `013-encomiendas-contraoferta`) |
| Sugerencias de destino con distancia | **Adaptar** | Destinos recientes del usuario y lugares frecuentes de Crucita, con la distancia en línea recta desde el punto de recogida |
| Pantalla «Introduce tu ruta» (De / A, elegir en el mapa) | **Tomar** | Origen y destino, cada uno con búsqueda en el catálogo, «elegir en el mapa» y referencia libre (003) |
| Hoja inferior desplazable | **Ya existe** | Se reutiliza la hoja actual. El SOS sale de ella y pasa a la pantalla Seguridad, con un escudo en la cabecera (006, criterios 1a a 1c) |
| Menú lateral con foto, nombre y calificación | **Adaptar** | Iniciales si no hay foto. La calificación solo aparece desde un número mínimo de calificaciones (Q7) |
| Opciones del menú | **Adaptar** | Pedir viaje, Historial, Notificaciones, Seguridad, Configuración, Ayuda y Soporte. Se descartan Ciudad a ciudad y Flete |
| Botón grande «Modo conductor» al pie del menú | **Depende de Q1** | — |
| Redes sociales al pie del menú | **Descartar por ahora** | Hasta que CruciDrive tenga cuentas oficiales |
| Historial con filtros (Todas, Viajes, Envíos) y tarjetas por fecha | **Adaptar** | Filtros Todas, Viajes y Encomiendas. Cada tarjeta muestra la fecha, origen → destino, la hora y el monto. En las encomiendas, el monto es el precio acordado (D-19). Las encomiendas anteriores al 013 dicen «Precio acordado con el conductor», sin importe |
| Seguridad: botón grande de llamada al 911 | **Tomar** | Mismo comportamiento que hoy: mantener pulsado 2 s abre el 911 (D-05) |
| Seguridad: contactos de emergencia | **Depende de Q4** | — |
| Seguridad: código de confirmación para subir al vehículo correcto | **Depende de Q3** | — |
| Seguridad: tarjetas informativas (verificación de conductores, privacidad, seguridad en el viaje, accidentes) | **Tomar** | Texto propio guardado en la app, que se lee sin conexión |
| Configuración: apariencia (modo oscuro), unidades, idioma, llamadas dentro de la app | **Descartar** | El 011 excluye el modo oscuro. Siempre km y español. Las llamadas usan el marcador del teléfono |
| Configuración: documentos legales, versión de la app, teléfono y eliminar cuenta | **Tomar** | Documentos legales incluye el consentimiento LOPDP con su versión. Eliminar cuenta ya existe |
| Registro de conductor: elegir tipo de ingreso y vehículo (auto o moto) | **Descartar** | Solo tricimoto (D-03). El conductor hace viajes y encomiendas sin elegir |
| Registro de conductor: pantalla de beneficios | **Adaptar** | Solo afirmaciones verdaderas (Q5). Nada de «pon tu precio» en viajes |
| Registro de conductor por pasos («1 de 3», barra de progreso, Atrás / Siguiente, Ayuda, Cerrar) | **Tomar** | Pasos: datos personales → licencia → tricimoto. Ver criterios 12 a 17 |
| Guía antes de cada foto (lista de cosas a revisar e ilustración) y opciones Cámara / Galería / Archivo | **Tomar** | Con ilustraciones propias en la paleta del 011 |
| Animación de carga al procesar archivos | **Adaptar** | Una tricimoto propia y un texto que diga lo que está pasando. Sin animación con «movimiento reducido» ni en el modo ligero (regla 6) |

## Historias
- Como **pasajero**, quiero elegir el punto de recogida moviendo el mapa y escribir solo el destino, para pedir en pocos toques.
- Como **pasajero**, quiero cambiar entre Viaje y Encomienda desde el inicio sin buscar en menús.
- Como **pasajero**, quiero ver mis viajes y encomiendas pasados, filtrados por tipo.
- Como **pasajero**, quiero una pantalla de Seguridad donde el 911 esté a un toque y que explique cómo me protege la app.
- Como **conductor nuevo**, quiero registrarme paso a paso, saber cuánto me falta y no perder lo que ya llené si salgo o retrocedo.
- Como **conductor con un teléfono modesto**, quiero que estas pantallas carguen rápido y gasten pocos datos.

## Criterios de aceptación

### Inicio del pasajero
1. **Dado** el inicio del pasajero, **cuando** se abre, **entonces** el mapa con el pin de recogida del `014-mapa-y-recogida` ocupa la parte de arriba y la hoja inferior contiene, en este orden: selector de servicio, barra de destino y sugerencias. El acceso a Seguridad es el escudo de la cabecera (006, criterio 1a).
2. **Dado** el selector de servicio, **cuando** el pasajero elige Viaje o Encomienda, **entonces** la barra de destino, las sugerencias y el resumen cambian a ese servicio sin recargar el mapa.
3. **Dado** un pasajero con viajes anteriores, **cuando** abre el inicio, **entonces** ve hasta 4 sugerencias de destino (primero sus recientes y después lugares frecuentes), cada una con su distancia en km y un decimal. Tocar una la pone como destino.
4. **Dado** la pantalla de ruta, **cuando** escribe en De o en A, **entonces** los resultados salen del catálogo local en menos de 300 ms después de dejar de escribir y sin descargar el mapa. Siempre hay «Elegir en el mapa» y «Usar lo que escribí como referencia».
5. **Dado** un viaje con origen y destino, **cuando** el pasajero confirma, **entonces** el monto lo calcula el servidor (D-08) y se muestra antes de pedir. En encomiendas, el pasajero escribe su precio propuesto con los límites del servidor, como define el `013-encomiendas-contraoferta`.

### Menú, historial, seguridad y configuración
6. **Dado** el menú, **cuando** se abre, **entonces** la cabecera muestra la foto o las iniciales, el nombre y, si corresponde según Q7, la calificación promedio con el número de calificaciones. Tocar la cabecera abre Mi cuenta.
7. **Dado** el historial, **cuando** se abre, **entonces** muestra las 20 solicitudes más recientes agrupadas por fecha y carga más al llegar al final. Los filtros Todas, Viajes y Encomiendas no muestran resultados del filtro anterior mientras cargan.
8. **Dado** un pasajero sin solicitudes, **cuando** abre el historial, **entonces** ve un estado vacío con un botón «Pedir viaje», nunca una lista en blanco.
9. **Dado** la pantalla de Seguridad, **cuando** se abre, **entonces** el botón del 911 es el elemento más grande, se ve sin desplazarse en 360 × 640 y mantiene el comportamiento de pulsar 2 s. Las tarjetas informativas abren textos que se leen sin conexión.
10. **Dado** la Configuración, **cuando** se abre, **entonces** muestra Documentos legales (con la versión del consentimiento aceptado), Teléfono, Versión de la app y Eliminar cuenta. No muestra modo oscuro, unidades, idioma ni llamadas dentro de la app.
11. **Dado** un usuario sin sesión, **cuando** abre el menú, **entonces** ve «Iniciar sesión o crear cuenta» y solo las opciones que no requieren cuenta (Seguridad, Ayuda).

### Registro del conductor por pasos
12. **Dado** el registro de conductor, **cuando** avanza, **entonces** ve «N de 3» con una barra de progreso, Atrás, Siguiente, Ayuda y Cerrar. Paso 1: foto, nombre, apellido y cédula (más la fecha de nacimiento si Q2 lo aprueba). Paso 2: licencia, frente y reverso, número y vencimiento. Paso 3: tricimoto (foto con la placa visible y la placa).
13. **Dado** un campo obligatorio vacío o inválido, **cuando** toca Siguiente, **entonces** el campo se marca en rojo con «Campo obligatorio» o el motivo concreto (cédula inválida, licencia vencida) y no avanza. El foco va al primer campo con error.
14. **Dado** una licencia con fecha de vencimiento pasada, **cuando** intenta avanzar, **entonces** se rechaza en la app y también en el servidor.
15. **Dado** un paso con datos llenos, **cuando** el conductor retrocede, cierra o la app se cierra, **entonces** lo que llenó se guarda en el teléfono y se recupera al volver. No aparece «se perderán los cambios» porque no se pierden. Al enviar o cerrar sesión, ese borrador se borra del teléfono.
16. **Dado** un espacio para foto, **cuando** lo toca, **entonces** primero ve una guía breve (foto del original, sin capturas ni filtros, todos los datos legibles) y después elige entre Cámara, Galería o Archivo. La imagen se reduce a 300 KB como máximo antes de subirla (criterio 6 del 002).
17. **Dado** el envío final, **cuando** se suben las fotos, **entonces** se ve el progreso con un texto claro. Si se corta la red, puede reintentar sin volver a tomar las fotos. Después ve el estado de su solicitud (pendiente, aprobada o rechazada con motivo), como en el 002.

### Rendimiento y paleta
18. **Dado** cualquier pantalla de esta spec, **cuando** se dibuja, **entonces** usa solo los colores del 011 y pasa contraste AA. Los íconos de vehículo son tricimotos.
19. **Dado** el modo ligero o «movimiento reducido», **cuando** se abren estas pantallas, **entonces** no hay desenfoque ni animaciones continuas. Mientras algo carga, se ven bloques de relleno estáticos en lugar de una pantalla en blanco.
20. **Dado** una jornada típica del conductor, **cuando** usa estas pantallas, **entonces** se respeta el máximo de 15 MB de datos móviles (regla 5). Las ilustraciones van incluidas en la app y no se descargan.

## Decisiones pendientes (David)
- **Q1 · Una cuenta con dos modos.** InDrive deja que la misma cuenta cambie entre pasajero y conductor. Hoy cada cuenta tiene un solo rol (002).
  - a) **Mantener un rol por cuenta** (propuesta para el MVP). El menú del pasajero muestra «Quiero manejar en CruciDrive», que explica cómo registrarse como conductor.
  - b) **Dos modos.** El pasajero puede pedir ser conductor desde el menú. Cuando el administrador lo aprueba, aparece «Modo conductor». Esto cambia el modelo de roles del 002 y sus reglas de acceso, y hay que justificarlo en el plan.
- **Q2 · Fecha de nacimiento del conductor.** ¿Se pide para comprobar que es mayor de edad? La licencia ya lo implica. Propuesta: no pedirla (LOPDP: minimización).
- **Q3 · Código de confirmación al abordar.** El pasajero le dice 4 dígitos al conductor para comprobar que subió a la tricimoto correcta. Ayuda contra conductores falsos. ¿Entra aquí o en el `006-sos-admin`? Propuesta: 006.
- **Q4 · Contactos de emergencia.** Propuesta: en el 006, junto al registro de alertas. Aquí solo queda el lugar reservado en Seguridad.
- **Q5 · Texto de beneficios para conductores.** ¿Qué es verdad hoy? Por ejemplo: horario libre, sin «vuelteo» (menos gasolina), encomiendas con precio acordado. ¿Habrá una comisión o cuota mensual? No se publica nada que no esté decidido.
- **Q6 · Soporte.** ¿A dónde lleva? Por ejemplo, el WhatsApp de soporte de CruciDrive (¿qué número?) o un correo.
- **Q7 · Calificación en el menú.** Propuesta: mostrarla desde 5 calificaciones, para que una sola mala no marque a alguien nuevo.

## Relación con otras specs
- Los datos del paso 2 (licencia) responden la P1 a del `015-acceso-google-y-correo`. Si David aprueba esta spec, la P1 del 015 queda cerrada aquí.
- El color de la tricimoto (idea 5 del 4 nov) se pide en el paso 3 del registro, pero se especifica en el `014-mapa-y-recogida`.
- La hoja del precio propuesto y la lista de contraofertas son del `013-encomiendas-contraoferta`. Esta spec no las define.
- No cambia la tarifa de los viajes (D-08), la asignación (D-11, D-15), el SOS (D-05) ni la paleta (011).

## Fuera de alcance
Ciudad a ciudad, flete, autos y motos, negociar el precio de los viajes, modo oscuro, idiomas, llamadas dentro de la app, pagos y redes sociales. El registro de alertas, los contactos de emergencia y el código de abordaje (salvo que Q3 o Q4 digan lo contrario) van en el 006.

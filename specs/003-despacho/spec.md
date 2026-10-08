# 003 · Despacho del conductor y catálogo de lugares

Estado: **D-11 resuelta por David el 8 oct 2026 (mixto). Pendiente de su "aprobada" para pasar a `plan.md`**

## Por qué
Hoy un pasajero puede pedir un viaje y la BD lo guarda, pero **nadie se entera**: ningún conductor recibe la solicitud (la consola tiene la ventana de 15 s, pero nunca se alimenta), el interruptor "disponible" del conductor no llega al servidor y dos conductores podrían aceptar el mismo viaje a la vez (el 001 dejó la aceptación atómica para este paso). Sin despacho la app no sirve para lo que existe: sustituir el "vuelteo" por una asignación por cercanía (README).

Además, elegir el destino solo por sector (5 opciones) es tosco: el pasajero piensa en "la farmacia Santa Martha" o "el muelle", no en "Malecón de Crucita". D-09 decide resolverlo sin costo por búsqueda, con un catálogo propio cargado desde OpenStreetMap.

Una consulta a OpenStreetMap del 8 oct 2026 (área de Crucita y alrededores) devuelve unos 180 lugares con nombre que no son calles: ~75 servicios (restaurantes, farmacias, UPC, subcentros, escuelas, iglesias, gasolinera), ~20 hospedajes y atractivos ("Letras Crucita", "La Loma de Crucita"), ~17 tiendas y algunos poblados (Las Gilces, San Jacinto, Cerecito). Hay duplicados ("PIZZA Station" dos veces), nombres en mayúsculas o genéricos ("Hospedaje", "Panadería") y lugares fuera de la parroquia (Charapotó). Alcanza para empezar, pero necesita limpieza y que el administrador complete lo que falte.

## Historias
- Como **pasajero**, quiero buscar mi destino por nombre ("muelle", "farmacia", "letras") y elegirlo de una lista, o escribir una referencia si no aparece, sin gastar datos en búsquedas.
- Como **pasajero**, quiero que, al pedir el viaje, el aviso llegue sin que yo haga nada más a la tricimoto disponible más cercana, ver que la app está buscando y poder cancelar mientras tanto.
- Como **pasajero**, quiero saber pronto si nadie puede llevarme, en vez de esperar sin respuesta.
- Como **conductor aprobado**, quiero ponerme disponible o no disponible y que eso cuente de verdad: solo me llegan solicitudes cuando estoy disponible y no estoy en otro viaje.
- Como **conductor**, quiero ver la solicitud con lo justo para decidir (personas, desde dónde, hacia dónde, total a cobrar y a qué distancia estoy) y aceptarla o rechazarla con un botón grande.
- Como **administrador**, quiero añadir, corregir u ocultar lugares del catálogo, porque OpenStreetMap no tiene todo lo de Crucita.
- Como **sistema**, quiero que solo un conductor gane cada viaje y que ninguna solicitud quede "buscando" para siempre.

## Criterios de aceptación

### Disponibilidad del conductor
1. **Dado** un conductor aprobado, **cuando** activa o desactiva "disponible", **entonces** el servidor registra el cambio y desde ese momento entra o sale de la lista de candidatos. Un conductor sin aprobar sigue sin poder ponerse disponible (criterio 2 del 002).
2. **Dado** un conductor disponible que cierra la app, pierde la conexión o deja de enviar su ubicación por más de **60 s**, **cuando** llega una solicitud, **entonces** no es candidato (no se ofrecen viajes a alguien que no se sabe dónde está).
3. **Dado** un conductor con un viaje aceptado o en curso, **cuando** llega otra solicitud, **entonces** no es candidato hasta que ese viaje termine o se cancele.

### Asignación (regla mixta, D-11)
4. **Dado** un viaje recién solicitado, **cuando** hay conductores candidatos, **entonces** el servidor los ordena por distancia en línea recta al punto de origen (sin importar en qué sector estén) y ofrece el viaje **de uno en uno a los 3 más cercanos**, 15 s cada uno. Si ninguno acepta, avisa **a la vez a todos los demás candidatos** y gana el primero que acepte. El cliente no elige al conductor.
5. **Dado** dos candidatos a la misma distancia (±50 m), **cuando** se decide a quién ofrecer primero, **entonces** gana el que lleva más tiempo disponible sin viaje.
6. **Dado** una oferta enviada a un conductor, **cuando** pasan **15 s** sin respuesta o la rechaza, **entonces** ese conductor ya no recibe esa solicitud (tampoco en el aviso abierto) y se pasa al siguiente de los 3 o, si ya fueron los 3, al aviso abierto. Rechazar o dejar vencer una oferta no tiene penalización en el MVP; solo queda registrado.
7. **Dado** un conductor con una oferta abierta, **cuando** llega otra solicitud, **entonces** no recibe una segunda oferta a la vez.
8. **Dado** dos conductores que aceptan el mismo viaje casi al mismo tiempo, **cuando** el servidor procesa ambas respuestas, **entonces** solo uno queda asignado y el otro recibe "este viaje ya fue tomado". Lo garantiza la BD en una sola operación, no una comprobación previa del backend.
9. **Dado** un conductor que no recibió la oferta (o cuya oferta venció), **cuando** intenta aceptar ese viaje, **entonces** la BD lo rechaza.
10. **Dado** un conductor que acepta, **cuando** la aceptación se confirma, **entonces** pasa a ocupado, se crea el chat del viaje con los dos participantes y el pasajero ve nombre, placa y teléfono del conductor (criterio 9 del 002), todo en el mismo paso: o queda todo hecho o nada.

### Sin conductor, cancelación y fallos
11. **Dado** que no hay candidatos, o que se agotan sin que nadie acepte, o que pasan **2 minutos** desde la solicitud, **entonces** la solicitud se cierra como "sin conductor", el pasajero ve "No hay tricimotos disponibles ahora" y puede volver a pedir con un toque, sin rellenar todo de nuevo.
12. **Dado** un viaje que todavía busca conductor, **cuando** el pasajero lo cancela, **entonces** se cierra, la oferta abierta desaparece de la pantalla del conductor y no se envían más ofertas.
13. **Dado** un pasajero con una solicitud buscando conductor o un viaje aceptado, **cuando** intenta pedir otro, **entonces** el servidor lo rechaza (un viaje activo por pasajero).
14. **Dado** que el servidor se reinicia mientras hay solicitudes buscando conductor, **cuando** vuelve a arrancar, **entonces** las retoma o las cierra como "sin conductor"; ninguna queda en "solicitado" más de 2 minutos.

### Lo que ve cada uno
15. **Dado** una oferta, **cuando** le llega al conductor, **entonces** ve: número de personas, total a cobrar (lo fija la BD, D-08), origen y destino (nombre del lugar o sector y la referencia escrita), distancia aproximada hasta el pasajero y la cuenta regresiva. **No** ve el teléfono del pasajero hasta aceptar.
16. **Dado** un viaje buscando conductor, **cuando** el pasajero mira la app, **entonces** ve "Buscando tricimoto…" con la opción de cancelar, y el cambio a "aceptado" le llega sin recargar.
17. **Dado** una oferta, **cuando** se registra, **entonces** queda a quién se ofreció, cuándo, el resultado (aceptada, rechazada, vencida, cancelada) y la distancia en metros, **sin guardar coordenadas** (LOPDP: el GPS histórico no se asocia a una persona). Sirve para medir tiempos de respuesta en el piloto.

### Catálogo de lugares (D-09)
18. **Dado** el catálogo cargado, **cuando** el pasajero escribe al menos 2 letras, **entonces** recibe hasta 20 lugares que coinciden por nombre aunque falten tildes, cambien mayúsculas o haya un error leve ("cevicheria manaba" encuentra "Cevichería El Manaba"; "farmacia" lista las farmacias). La búsqueda no llama a ningún servicio de pago ni descarga mapa.
19. **Dado** un lugar elegido como destino (u origen), **cuando** se pide el viaje, **entonces** el viaje guarda sus coordenadas, el nombre del lugar como referencia y el sector que le corresponde (el de centro más cercano), sin que el pasajero elija el sector.
20. **Dado** que no hay coincidencia, **cuando** el pasajero sigue, **entonces** puede elegir el sector y escribir una referencia libre, como hoy.
21. **Dado** el origen, **cuando** el pasajero tiene el GPS activo, **entonces** se usa su ubicación; si no lo tiene, puede elegir un lugar o un sector como punto de partida.
22. **Dado** la carga desde OpenStreetMap, **cuando** se ejecuta otra vez, **entonces** no duplica lugares, actualiza los que vienen de OSM y **no pisa** lo que el administrador corrigió, añadió u ocultó. Solo entran lugares dentro de la parroquia y se descartan nombres genéricos o duplicados obvios.
23. **Dado** el catálogo, **cuando** se siembra, **entonces** incluye los puntos marcados por David (Muelle de Crucita, Los Ranchos; `notas-lugares.md`).
24. **Dado** un administrador, **cuando** añade, corrige (nombre, categoría, ubicación) u oculta un lugar, **entonces** el cambio se ve en la próxima búsqueda. Un pasajero o conductor que lo intenta recibe acceso denegado (prueba RLS).
25. **Dado** que se muestran resultados del catálogo, **cuando** el usuario los ve, **entonces** aparece la atribución "© OpenStreetMap" (licencia ODbL).
26. **Dado** un visitante sin cuenta, **cuando** busca un lugar en el mapa público, **entonces** puede buscar (son datos públicos), pero pedir el viaje sigue exigiendo cuenta (002).

### Presupuesto y campo
27. **Dado** una jornada de 10 h con el conductor disponible, **cuando** se suman ubicación y ofertas, **entonces** el despacho no lleva el consumo por encima de los 15 MB (regla 5); cada oferta pesa menos de 2 KB.
28. **Dado** el modal de oferta, **cuando** se muestra, **entonces** cumple la regla 6: botones de aceptar y rechazar grandes, alto contraste, funciona en el modo ligero sin blur y avisa si no hay conexión.

## Fuera de alcance
- **Avisos con la app cerrada o en segundo plano** (notificaciones push): paso 004. En el 003 el conductor recibe ofertas solo con la consola abierta. Para el piloto esto es una limitación seria y por eso 004 va justo después.
- Ver al conductor acercándose en el mapa del pasajero: 004.
- Pantallas de viaje en curso, llegada, cancelación con motivo después de aceptar y calificaciones: 005.
- Penalizaciones o suspensiones por rechazar ofertas; turnos por parada o cooperativa (depende del aliado, D-07).
- Polígonos de sectores (el 001 los dejó para aquí): el sector se deduce del centro más cercano; no hacen falta para despachar por distancia.
- Rutas por calles y tiempo estimado de llegada; precios por distancia (D-08).
- Viajes programados, compartir tricimoto entre viajes distintos, más de un viaje por conductor.
- Que los pasajeros propongan lugares nuevos (solo el administrador los añade).
- Google Places o cualquier API de búsqueda de pago (D-09).

## Riesgos
- **Pocas tricimotos conectadas en el piloto.** Si hay 3 o 4 conductores con la app abierta, cualquier regla de asignación falla con frecuencia por falta de candidatos, no por la regla. Lo mide el criterio 17.
- **Cultura de turnos.** Si las cooperativas trabajan por turno de parada, "el más cercano" puede generar roces. Se valida en el paso 0 con el aliado (D-07); la regla debe poder cambiarse sin tocar la app.
- **Calidad de OSM.** Nombres desactualizados o negocios cerrados; el administrador corrige.

## Decisiones de David
- **D-11 · Regla de asignación: C, mixto** (David, 8 oct 2026). Opciones que se evaluaron:
  - **A. Secuencial:** se ofrece al más cercano; a los 15 s sin respuesta o con rechazo, al siguiente, hasta agotar candidatos o llegar a 2 minutos. Justo y ordenado, sin carreras entre conductores; cada rechazo cuesta 15 s.
  - **B. Aviso a todos:** se avisa a la vez a todos los disponibles del sector (o de la parroquia) y gana el primero que acepta. Lo más rápido, pero premia al que tiene mejor señal o el dedo más rápido, no al más cercano, y molesta a todos con cada viaje.
  - **C. Mixto (elegida):** secuencial con los **3 más cercanos** (máximo 45 s) y, si ninguno acepta, aviso abierto a todos los disponibles hasta completar los 2 minutos. Respeta la cercanía casi siempre y no deja al pasajero esperando cuando los cercanos no responden. El número 3 y los tiempos quedan como parámetros del servidor para ajustarlos en el piloto sin publicar la app.

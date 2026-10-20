# 010 · Interfaz compacta y lista de ofertas del conductor

Estado: **Aprobada** al fusionar el PR #49 (20 oct 2026). Decisiones tomadas en la conversación del 20 oct 2026: compactar el diseño (sin ajuste de tamaño en la app) y lista de ofertas sin quitar D-11.

## Por qué
En la prueba con dos teléfonos del 20 oct 2026 (APK con el 009), David encontró dos problemas.

**El diseño es grande para las pantallas.** Lo medimos en la versión web:

| Pantalla | Alto del login | Pantalla | Sobra |
| --- | --- | --- | --- |
| 360 × 640 (teléfono modesto) | 929 px | 640 px | 289 px: el botón Entrar queda abajo |
| 393 × 852 (teléfono actual) | 890 px | 852 px | 38 px |

En el mapa del pasajero, el panel de «¿Desde dónde sales?» mostraba solo «Usar mi ubicación (La Loma)»: el buscador y los sectores estaban más abajo, tapados por la barra de pestañas (corregida en el #48) y sin ninguna señal de que había más contenido.

**El conductor solo ve una oferta a la vez.** Si llegan dos solicitudes al mismo tiempo, el conductor que ya tiene una abierta no recibe la otra (criterio 7 del 003). David quiere que el conductor vea las solicitudes en una lista y decida cuáles acepta y cuáles no, **sin quitar** la prioridad del más cercano (D-11).

## Historias
- Como **usuario con un teléfono modesto**, quiero iniciar sesión y pedir un viaje sin tener que desplazarme para encontrar el botón.
- Como **pasajero**, quiero ver todas las formas de elegir el punto de partida: mi ubicación, buscar un lugar o elegir un sector.
- Como **conductor**, quiero ver en una lista las solicitudes que me ofrecen y elegir cuál acepto y cuál rechazo.
- Como **conductor en la calle**, quiero que los botones sigan siendo grandes y fáciles de pulsar (regla 6).

## Criterios de aceptación

### A. Interfaz compacta
1. **Dado** un teléfono de 360 × 640, **cuando** se abre «Iniciar sesión» con el teclado cerrado, **entonces** el logo, los dos campos y el botón Entrar se ven sin desplazar. «Crear cuenta», con más campos, puede desplazarse.
2. **Dado** el mapa del pasajero en 360 × 640, **cuando** se abre el panel para elegir el destino o el origen, **entonces** se ven sin desplazar el selector de servicio, la pregunta y el buscador, y al menos un 35 % del mapa. Si hay más opciones abajo (sectores), una señal visible indica que se puede desplazar.
3. **Dado** el panel «¿Desde dónde sales?» (o «¿Dónde la recogemos?»), **cuando** se abre, **entonces** se ven, o se llega desplazando, las tres opciones: mi ubicación, buscar un lugar y elegir un sector.
4. **Dado** la consola del conductor en 360 × 640, **cuando** llega una oferta, **entonces** la tarjeta completa, con Aceptar y Rechazar, cabe sin desplazar. Los botones principales del conductor miden al menos 56 px de alto (regla 6).
5. **Dado** el modo ligero sin blur (regla 6), **cuando** se compacta la interfaz, **entonces** sigue funcionando igual.
6. **Dado** un PR que cambia pantallas, **cuando** se revisa, **entonces** incluye capturas en 360 × 640 y en 412 × 915 de las pantallas que toca.

### B. Lista de ofertas sin quitar D-11
7. **Dado** un conductor disponible con una oferta abierta, **cuando** le corresponde otra solicitud (por su turno entre los 3 más cercanos o por el aviso abierto), **entonces** también la recibe. Esto cambia el criterio 7 del 003: tener una oferta abierta ya no impide recibir otra.
8. **Dado** un conductor con varias ofertas abiertas, **cuando** mira la consola, **entonces** las ve en una lista: primero la que vence antes, cada una con su cuenta atrás, personas y total (o «Encomienda · precio a convenir»), origen, destino y distancia.
9. **Dado** esa lista, **cuando** el conductor acepta una, **entonces** queda ocupado (criterio 3 del 003), las demás ofertas desaparecen de su pantalla y esas solicitudes pasan al siguiente candidato de inmediato, sin esperar a que venzan.
10. **Dado** esa lista, **cuando** el conductor rechaza una, **entonces** solo sale esa y las demás siguen con su tiempo.
11. **Dado** un conductor, **cuando** ya tiene el máximo de ofertas abiertas (parámetro del servidor; al inicio, 3), **entonces** no recibe otra hasta que alguna se resuelva.
12. **Dado** la regla D-11, **cuando** se reparten las ofertas, **entonces** no cambia nada más: el orden por cercanía, los 3 candidatos de uno en uno, los 15 s por oferta, el aviso abierto y los 2 minutos.
13. **Dado** la app cerrada, **cuando** llegan varias ofertas, **entonces** cada una tiene su aviso (criterio 6 del 004) y al tocar cualquiera se abre la lista.
14. **Dado** dos conductores que aceptan la misma solicitud desde sus listas, **cuando** el servidor procesa ambas, **entonces** solo uno queda asignado (criterio 8 del 003).

## Fuera de alcance
- Ajuste «Tamaño de la app» y tope a la letra del sistema: no se eligieron. Se pueden retomar si en el piloto hay teléfonos con la letra grande.
- Cambiar D-11 por un mercado abierto en el que todos ven todo y gana el más rápido.
- Pantallas del viaje en curso: spec 005.
- Simulador para ver la app en la laptop: no cambia la app. Se usa el emulador de Android Studio con el APK, la versión web o capturas generadas en la revisión (criterio 6).

## Riesgos
- **Un conductor acapara ofertas sin responder.** Lo limitan los 15 s de cada oferta y el máximo de 3 abiertas.
- **Más avisos por conductor.** Con 3 o 4 conductores en el piloto, el volumen sigue siendo bajo. Se mide con el registro de ofertas (criterio 17 del 003).

## Decisiones de David
- **D-15 (20 oct 2026): lista de ofertas sin quitar D-11.** Un conductor puede tener hasta 3 ofertas abiertas a la vez y las ve en una lista. D-11 no cambia. Registrada en la constitución.
- **Interfaz: compactar** (20 oct 2026). Sin ajuste de tamaño en la app.

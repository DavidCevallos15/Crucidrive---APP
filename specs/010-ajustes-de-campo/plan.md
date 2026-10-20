# 010 · Plan técnico

Sin servicios nuevos ni cambios de stack. La parte A solo toca el frontend. La parte B toca la BD, el despachador y la consola, y su detalle se completa antes de implementarla.

## A. Interfaz compacta

**P1 · Cuándo una pantalla es compacta.** `src/utils/compacto.ts`: `esCompacta(alto)` es verdadero por debajo de 880 px de alto. El umbral cubre 360 × 640, 360 × 800 (el teléfono de David) y 393 × 852, donde el login no cabía, y deja fuera 412 × 915, donde sí cabe. Se mide con `useWindowDimensions`, sin guardar nada.
- Alternativa descartada: un ajuste «Tamaño de la app» en Configuración. David no lo eligió.
- Alternativa descartada: un umbral de 720 px. Dejaba fuera el teléfono de David.

**P2 · Login (criterio 1).** En modo compacto:
- `AuthScaffold` quita la bienvenida y el pie, usa la marca compacta y reduce los márgenes.
- `LoginScreen` quita el subtítulo de «Iniciar sesión» (en «Crear cuenta» se queda, porque explica el mínimo de la contraseña), achica el título y aprieta los espacios.
- Los campos y el botón Entrar no cambian de tamaño.

**P3 · Panel del mapa (criterios 2 y 3).**
- `altoMaximoHoja(alto, separación)` limita el panel de destino u origen para que el mapa conserve al menos el 35 % del alto. Descuenta la barra de pestañas (#48) y el borde de la tarjeta.
- `HojaDesplazable` reemplaza el `ScrollView` de las hojas. Mide lo visible, el contenido y el desplazamiento, y con `hayMasAbajo` muestra «Desliza para ver más» sobre un degradado, sin bloquear toques.
- En modo compacto, el selector de servicio y los títulos se aprietan.
- Alternativa descartada: dejar la barra de desplazamiento del sistema. En Android solo aparece al mover, y en la prueba del 20 oct el buscador pasó desapercibido.

**P4 · Oferta del conductor (criterio 4).**
- La tarjeta pasa a `src/components/TarjetaOferta.tsx`, que la parte B reutiliza en la lista.
- En modo compacto achica la cuenta atrás, el título, el precio y la ruta, y limita cada punto a 2 líneas (3 si no es compacta).
- Aceptar y Rechazar siguen en 64 px (`ALTO_BOTON_OFERTA`), por encima del mínimo de 56.

**P5 · Sin blur (criterio 5).** Los componentes nuevos no usan blur: el aviso de la hoja es un degradado y la tarjeta es opaca.

**P6 · Capturas (criterio 6).**
- Se generan con Playwright sobre la exportación web en 360 × 640, 360 × 800 y 412 × 915, y se guardan en `docs/capturas/010-a/`.
- La tarjeta de oferta se captura con una pantalla de prueba temporal que no se sube (la consola necesita sesión), en el peor caso: textos largos, aviso abierto, distancia y sin conexión.

## B. Lista de ofertas sin quitar D-11 (D-15)

**P7 · BD (`0016_varias_ofertas.sql`).**
- Se quita el índice `uq_ofertas_una_pendiente_por_conductor`.
- `candidatos_despacho` y `crear_ofertas` reciben `p_max_ofertas` (por defecto 3). Un conductor sigue siendo candidato mientras tenga menos pendientes, salvo para un viaje que ya recibió.
- `crear_ofertas` bloquea la tricimoto de cada conductor (en orden, sin interbloqueos) antes de contar, para que dos solicitudes simultáneas no le dejen más del tope.
- `aceptar_viaje` marca las otras ofertas pendientes del conductor como **«liberada»**, un resultado nuevo, antes de ponerlo ocupado. Si no, el trigger `al_dejar_disponible` las daría por «rechazada» y las métricas del piloto (criterio 17 del 003) contarían rechazos que no hubo.
- Alternativa descartada: guardar el tope en una tabla. Un parámetro del servidor basta y se ajusta sin migración, como los de D-11.

**P8 · Despachador.**
- `OFERTAS_MAX_POR_CONDUCTOR` (de 1 a 5, por defecto 3) se lee del entorno junto con los parámetros de D-11 y se pasa a las dos funciones.
- Al aceptar, `aceptado` busca las ofertas «liberada» de ese conductor que el proceso sigue despachando: las retira de su pantalla (socket y aviso) y avanza esas solicitudes al siguiente candidato de inmediato.
- Con el tope en 1 se vuelve al comportamiento del 003.

**P9 · Consola.**
- `useConsolaConductor` guarda una lista (`agregarOferta`, `quitarOferta`), ordenada por la que vence antes, con un reloj común para las cuentas regresivas.
- `aceptar` y `rechazar` reciben el viaje. Mientras se acepta uno, no se acepta otro.
- El modal muestra la lista de `TarjetaOferta` dentro de `HojaDesplazable`, con un título si hay más de una.
- Atrás rechaza la que vence antes, como hacía con una sola oferta.
- Tocar un aviso agrega esa oferta a la lista.

**P10 · Orden de despliegue.** Primero la 0016 en la BD y después el backend. El backend anterior funciona con la BD nueva, porque los parámetros nuevos tienen valor por defecto. Al revés no: el backend nuevo llama a funciones que todavía no existen.

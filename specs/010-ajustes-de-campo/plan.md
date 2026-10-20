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
Esquema para completar antes de implementar:
- **BD:** permitir hasta `OFERTAS_MAX_POR_CONDUCTOR` (3) ofertas `pendiente` por conductor. Hoy el criterio 7 del 003 lo impide. `aceptar_viaje` retira las demás ofertas del conductor en la misma transacción.
- **Despachador:** un conductor con ofertas abiertas sigue siendo candidato mientras tenga menos de 3. Al aceptar, las solicitudes retiradas avanzan al siguiente candidato sin esperar a que venzan.
- **Consola:** lista de `TarjetaOferta`, ordenada por la que vence antes. El aviso con la app cerrada abre la lista.
- **Pruebas:** `rls_` y prueba de concurrencia para el aceptar con varias ofertas; despachador con 2 y 3 ofertas simultáneas.

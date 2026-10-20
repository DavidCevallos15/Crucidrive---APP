# 010 · Tareas

Cada tarea indica su prueba y se tilda solo al cumplirse.

## A. Interfaz compacta
- [x] T1 · `utils/compacto.ts`: `esCompacta`, `altoMaximoHoja` y `hayMasAbajo` (P1, P3) → prueba: `tests/compacto.test.ts` (umbral en 640, 800, 852 y 915; mapa ≥ 35 % con y sin barra; aviso hasta el fondo).
- [x] T2 · Login compacto (criterio 1) → prueba: captura y medida en web. En 360 × 640, el contenido pasó de 929 px a 640 y el botón Entrar queda en y = 448. En 360 × 800 cabe con Entrar en y = 528, y en 412 × 915 no cambia. Capturas en `docs/capturas/010-a/login-*.jpg` y `antes-login-360x640.jpg`.
- [x] T3 · Panel del mapa (criterios 2 y 3) → prueba: `tests/compacto.test.ts` y captura. En 360 × 640 sin sesión se ven el selector, la pregunta, la fila de origen y el buscador, el mapa ocupa al menos el 35 % y aparece «Desliza para ver más». Con sesión, el alto se calcula restando la barra de pestañas (por fórmula; la captura con sesión necesita el APK).
- [x] T4 · `TarjetaOferta` (criterio 4) → prueba: captura del peor caso en 360 × 640. Cabe entera (termina en y ≈ 586) con botones de 64 px. Consola sin cambios de comportamiento: frontend 321/321 y `tsc` sin errores en `src/` ni `app/`.
- [x] T5 · Sin blur en lo nuevo (criterio 5) → revisión del diff: degradado y fondo opaco. **Deuda aparte:** el modo ligero de la regla 6 no existe en el código; se propone para `007-hardening`.
- [x] T6 · Capturas en 360 × 640, 360 × 800 y 412 × 915 (criterio 6) → `docs/capturas/010-a/`.
- [ ] T7 · **David:** revisar en el APK (navegación de 3 botones y con gestos) el login, el panel del mapa con sesión y una oferta real.

## B. Lista de ofertas (D-15)
- [x] T8 · Plan B en `plan.md` (P7 a P10).
- [x] T9 · `0016_varias_ofertas.sql` → prueba: `rls_006.sql` 17 en verde (hasta 3 ofertas, la cuarta no, el tope como parámetro, aceptar libera sin rechazar, las liberadas siguen buscando y pasan a otro conductor, dejar de estar disponible sigue rechazando). Falla sin la 0016. `rls_003` ajustado: la comprobación del criterio 7 del 003 pasa a usar el tope 1. `rls_001` a `rls_005` siguen en verde. La concurrencia real (dos `crear_ofertas` a la vez) necesita Docker: queda para la revisión en producción.
- [x] T10 · Despachador → prueba: `tests/despachador.test.js` (4 pruebas nuevas: dos solicitudes al más cercano, tope 1 como el 003, aceptar retira y pasa la otra al instante, rechazar no toca las demás). La de aceptar falla sin el cambio. Backend 296/296.
- [x] T11 · Lista en la consola → prueba: `tests/despacho.test.ts` (orden por vencimiento, sin duplicar, quitar solo una) y captura `docs/capturas/010-b/lista-360x800.jpg`. Frontend 322/322 y `tsc` sin errores en `src/` ni `app/`.
- [ ] T12 · **David:** aplicar la 0016 en producción (SQL Editor) **antes** de reiniciar el backend; después, prueba con 2 pasajeros y 1 conductor: ver las 2 ofertas en lista, aceptar una y comprobar que la otra pasa a otro conductor. → **0016 aplicada el 20 oct 2026** (David, SQL Editor; un primer intento con el SQL cortado no aplicó nada). Verificado en producción: sin el índice viejo, «liberada» en el check, firmas nuevas con `p_max_ofertas`, `crear_ofertas` con bloqueo, `aceptar_viaje` que libera y permisos solo para `service_role`. Linter de seguridad: solo D-10; rendimiento: sin hallazgos nuevos. Falta la prueba con teléfonos.

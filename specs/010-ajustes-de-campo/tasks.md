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
- [ ] T8 · Completar el plan B (BD, despachador y consola) antes de escribir código.
- [ ] T9 · Migración y RLS para varias ofertas por conductor → prueba: `rls_` nuevo y concurrencia.
- [ ] T10 · Despachador con hasta 3 ofertas por conductor y avance inmediato al aceptar → prueba: `tests/despachador.test.js`.
- [ ] T11 · Lista de ofertas en la consola y apertura desde el aviso → prueba: `tests/` del frontend y captura.

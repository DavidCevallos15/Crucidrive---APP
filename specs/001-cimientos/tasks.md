# 001 · Tareas

Cada tarea indica su prueba. Se tilda al cumplirse.

- [x] T1 · Auditar la BD real contra el código → hallazgos en `spec.md`
- [x] T2 · Constitución con decisiones D-02 a D-06 → `specs/constitution.md`
- [x] T3 · Escribir migraciones 0001–0006 en `supabase/migrations/`
- [x] T3b · Validar migraciones y RLS en Postgres 16 + PostGIS local → `supabase/tests/rls_001.sql`: 6 migraciones limpias, 21 comprobaciones en verde (semilla, simetría, suplantación, rol admin, tarifa, chat, anon)
- [x] T4 · Limpieza ejecutada el 2026-10-08 (`supabase/one-off/2026-10-08_limpieza_esquema_inicial.sql`); no se perdieron datos (tablas vacías)
- [x] T5 · Aplicar 0001–0006 → verificado 2026-10-08: `list_tables` muestra las 9 tablas, todas con RLS
- [x] T6 · Semilla de Crucita → verificado: 5 sectores y 10 tarifas; precios, distancias y tiempos idénticos a `sectors.ts` (criterio 2)
- [x] T7 · Simetría → verificado: `obtener_tarifa('playa','centro')` y `obtener_tarifa('centro','playa')` devuelven la misma fila (criterio 3)
- [x] T8 · Linter de seguridad → verificado: `get_advisors(security)` sin hallazgos (criterio 8)
- [x] T9 · Backend con cliente por JWT (`createUserClient`, `req.supabase`, `socket.supabase`) → prueba: `tests/spec001.test.js` (criterio 7)
- [x] T10 · Código alineado al esquema: `messages.content`, `thread_members` sin `id`, `threads.created_by`, sin `updated_at` manual, placa en mayúsculas → prueba: `tests/spec001.test.js`
- [x] T11 · Corregir `asyncHandler` (no devolvía la promesa; 18 tests fallaban en `main`) → prueba: 56/56 backend
- [x] T12 · CI en GitHub Actions (backend + frontend) → prueba local: backend 56/56, frontend 69/69 (criterio 4)
- [x] T13 · Keepalive de Supabase cada 3 días → requiere secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY` en GitHub
- [x] T14 · `backend/.env.example` completo (criterio 5)
- [x] T15 · EAS: `projectId` en `app.json` y `eas.json` con perfil `preview` (APK)
- [x] T17 · Integrar PR #1 (manejo de errores) y PR #2 (endurecimiento) sobre la arquitectura nueva, en vez de resolver conflictos línea a línea → prueba: `tests/hardening.test.js` (27 casos); backend 80/80, frontend 69/69
- [ ] T18 · Deuda técnica detectada: `tsc --noEmit` en frontend da 210 errores ya existentes en `main` (tipos de Jest no declarados para los tests y `baseUrl` obsoleto en TS 6). Se resuelve en 007 junto con D-01
- [x] T19 · Enmienda 1 (D-08): tarifa = 0,50 × personas. Migración `0007` (probada en Postgres 16 + PostGIS local, aplicada al proyecto real), backend (`pasajeros`, sectores, descripciones; sin `tarifa` en el INSERT), frontend (selector de pasajeros, nota de destino, `calculateFare`; sector `la_boca`), spec/constitución/docs → prueba: backend 89/89, frontend 71/71, RLS 17/17
- [x] T20a · Pines reales de Crucita, La Boca y Las Gilces → migración `0008_centros_sectores_reales.sql`
- [ ] T20b · Pines reales de Playa (Malecón), Los Arenales y San Jacinto; luego validar los seis en campo (paso 0)
- [ ] T16 · Prueba de humo con 2 usuarios reales (pasajero y conductor) contra la BD nueva → registro, solicitud, aceptación y mensaje de chat

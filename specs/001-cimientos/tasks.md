# 001 · Tareas

Cada tarea indica su prueba. Se tilda al cumplirse.

- [x] T1 · Auditar la BD real contra el código → hallazgos en `spec.md`
- [x] T2 · Constitución con decisiones D-02 a D-06 → `specs/constitution.md`
- [x] T3 · Escribir migraciones 0001–0006 en `supabase/migrations/`
- [x] T3b · Validar migraciones y RLS en Postgres 16 + PostGIS local → `supabase/tests/rls_001.sql`: 6 migraciones limpias, 21 comprobaciones en verde (semilla, simetría, suplantación, rol admin, tarifa, chat, anon)
- [x] T4 · Ejecutar `supabase/one-off/2026-10-08_limpieza_esquema_inicial.sql` → ejecutado por David en el SQL Editor (8 oct)
- [x] T5 · Aplicar 0001–0006 → aplicadas por la integración Supabase–GitHub al fusionar #7; `list_tables`: 9 tablas, todas con RLS, 20 políticas
- [x] T6 · Semilla de Crucita → prueba: 5 sectores y 10 tarifas, mismos precios que `sectors.ts` (criterio 2)
- [x] T7 · Simetría → prueba: `obtener_tarifa('playa','centro')` = `obtener_tarifa('centro','playa')` (criterio 3)
- [x] T8 · Linter de seguridad sin ERROR → `get_advisors(security)`: 0 hallazgos (antes 1 ERROR y 2 WARN) (criterio 8)
- [x] T9 · Backend con cliente por JWT (`createUserClient`, `req.supabase`, `socket.supabase`) → prueba: `tests/spec001.test.js` (criterio 7)
- [x] T10 · Código alineado al esquema: `messages.content`, `thread_members` sin `id`, `threads.created_by`, sin `updated_at` manual, placa en mayúsculas → prueba: `tests/spec001.test.js`
- [x] T11 · Corregir `asyncHandler` (no devolvía la promesa; 18 tests fallaban en `main`) → prueba: 56/56 backend
- [x] T12 · CI en GitHub Actions (backend + frontend) → prueba local: backend 56/56, frontend 69/69 (criterio 4)
- [x] T13 · Keepalive de Supabase cada 3 días → requiere secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY` en GitHub
- [x] T14 · `backend/.env.example` completo (criterio 5)
- [x] T15 · EAS: `projectId` en `app.json` y `eas.json` con perfil `preview` (APK)
- [x] T17 · Integrar PR #1 (manejo de errores) y PR #2 (endurecimiento) sobre la arquitectura nueva, en vez de resolver conflictos línea a línea → prueba: `tests/hardening.test.js` (27 casos); backend 80/80, frontend 69/69
- [ ] T18 · Deuda técnica detectada: `tsc --noEmit` en frontend da 210 errores ya existentes en `main` (tipos de Jest no declarados para los tests y `baseUrl` obsoleto en TS 6). Se resuelve en 007 junto con D-01
- [x] T19 · `npm audit fix` en backend: dependencias de producción con 0 vulnerabilidades (corrige proxy-addr crítica, engine.io, socket.io-parser, qs). Lo restante es solo de desarrollo (jest, nodemon). El CI ahora corre `npm audit --omit=dev --audit-level=high`
- [x] T20 · `CLAUDE.md` en la raíz con la constitución y el flujo por specs para Claude Code
- [x] T21 · Enmienda 1 (D-08): tarifa = 0,50 × personas. Migración `0007` (probada en Postgres 16 + PostGIS local, aplicada al proyecto real), backend (`pasajeros`, sectores, descripciones; sin `tarifa` en el INSERT), frontend (selector de pasajeros, nota de destino, `calculateFare`; sector `la_boca`), spec/constitución/docs → prueba: backend 89/89, frontend 71/71, RLS 17/17
- [x] T22a · Pines reales de Crucita, La Boca y Las Gilces → migración `0008_centros_sectores_reales.sql`
- [x] T22b · Sectores definitivos con pines reales (La Boca, Las Gilces, Los Arenales, Malecón, La Loma) → migración `0009_sectores_definitivos.sql`; se retiran Centro, Playa y San Jacinto. Falta validarlos en campo (paso 0)
- [ ] T16 · Prueba de humo con 2 usuarios reales (pasajero y conductor) contra la BD nueva → registro, solicitud, aceptación y mensaje de chat

# 002 · Tareas

Cada tarea indica su prueba. Se tilda al cumplirse.

- [x] T1 · Spec con decisiones de David y borrador de consentimiento → PR #10
- [x] T2 · Migración `0010_identidad.sql`: columnas de consentimiento, `conductores_verificacion`, funciones `es_conductor_aprobado` / `es_admin`, políticas de `tricimotos` y `viajes` → prueba: `supabase/tests/rls_002.sql` (criterios 2, 3, 4) → hecho: migración `0010_identidad.sql` aplicada al proyecto real; `supabase/tests/rls_002.sql` 16 en verde (+ bloqueos esperados)
- [x] T3 · Bucket `verificacion` y políticas de Storage → prueba SQL: el dueño sube y lee lo suyo; otro pasajero o conductor recibe acceso denegado; el admin lee todo (criterio 5) → hecho: bucket privado `verificacion` (1 MB, solo JPEG) con políticas probadas en `rls_002.sql`
- [x] T4 · Backend: registro con consentimiento obligatorio y validación de cédula ecuatoriana → prueba: tests de controlador (criterio 1) → hecho: registro exige `consentimiento: true` y guarda la versión del servidor; cédula validada por módulo 10 (`tests/identidad.test.js`)
- [x] T5 · Backend: `POST /api/conductores/verificacion` → prueba: rechaza fotos ajenas, tipos no permitidos y cédula inválida → hecho: `POST` y `GET /api/conductores/verificacion`
- [x] T6 · Backend: endpoints de administrador (listar, ver con URLs firmadas, aprobar, rechazar con motivo) + `roleMiddleware(['admin'])` → prueba: un conductor o pasajero recibe 403; el admin aprueba y queda `revisado_por` y `revisado_en` (criterio 3) → hecho: `/api/admin/conductores` (listar, detalle con URL firmada de 5 min, aprobar, rechazar con motivo)
- [x] T7 · Sockets: mensaje claro si un conductor no aprobado intenta actualizar ubicación → prueba: `tests/socket*.test.js` → hecho: `update_location` responde "Tu cuenta de conductor aún no está aprobada"
- [ ] T8 · Frontend: registro e inicio de sesión con correo y contraseña (reemplaza SMS), sesión persistente, mínimo 8 caracteres → prueba: tests de store y validación (criterios 7 y 8)
- [ ] T9 · Frontend: formulario de verificación del conductor con reducción de fotos a ≤ 300 KB → prueba: test de la función de reducción (criterio 6)
- [ ] T10 · Frontend: pantalla de estado del conductor (pendiente / rechazado con motivo) y panel de administrador → prueba: tests de componentes y verificación en el navegador integrado
- [x] T11 · Pasajero ve nombre, placa y teléfono del conductor aprobado y nada más (criterio 9) → prueba RLS en `rls_002.sql` → hecho en la BD: el pasajero ve nombre y teléfono del conductor y nada de su verificación (`rls_002.sql`)
- [ ] T12 · **David:** fijar "Minimum password length = 8" en Supabase (Authentication → Policies) → comprobación: `signUp` con 7 caracteres es rechazado
- [x] T13 · Primer administrador: `supabase/one-off/2026-10-XX_primer_admin.sql` para `jimdav1506ceva@gmail.com` (antes, limpiar sus datos de prueba o cambiar la cuenta del conductor de `npm run smoke`) → prueba: `select rol` = `admin`; un usuario normal no puede auto-asignárselo (criterio 4) → hecho el 2026-10-08: `supabase/one-off/2026-10-08_primer_admin.sql` (jimdav1506ceva@gmail.com es admin; se borraron los datos de la prueba de humo anterior)
- [ ] T14 · Prueba de humo ampliada (`npm run smoke`): conductor sin aprobar no puede aceptar; tras aprobarlo, sí → prueba: salida OK completa → guion listo (`npm run smoke`, `backend/scripts/smoke.js`); falta ejecutarlo: necesita 3 cuentas (pasajero, conductor y admin)
- [ ] T15 · Actualizar `REGISTRO_CAMBIOS.md`, `specs/README.md` y subir el consentimiento a la versión revisada cuando haya texto legal

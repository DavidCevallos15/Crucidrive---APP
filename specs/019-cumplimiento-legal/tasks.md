# 019 · Tareas

Cada tarea se tilda cuando su prueba pasa, nunca antes.

- [x] **T1 · Spec, plan y auditoría de secretos en historial git (criterio 13).** *Prueba:* escaneo de `git log` sin `.env`, llaves privadas ni tokens reales; `Claude outputs/` agregado a `.gitignore`.
- [x] **T2 · Páginas legales públicas en `web/` (criterios 1 a 5 y 12).** `privacidad.html`, `terminos.html`, `reembolsos.html`, `eliminar-cuenta.html`, enlaces en `web/index.html` y cabeceras HSTS/CSP en `web/vercel.json`. *Prueba:* `cumplimientoLegal019.test.ts` valida existencia, límite de palabras, titular/RUC, tabla de datos, SOS ≠ 911, eliminación de cuenta y cabeceras.
- [x] **T3 · Consentimiento `1.0` sincronizado en backend, frontend y `002` (criterio 6).** `backend/src/config/consent.js`, `frontend/src/constants/legal.ts`, `frontend/src/constants/consentimiento.ts` y `specs/002-identidad/consentimiento-lopdp.md`. *Prueba:* `spec004.test.js`, `avisos.test.ts`, `identidad.test.ts` y `cumplimientoLegal019.test.ts`.
- [x] **T4 · Consentimiento explícito y enlaces legales en la app (criterios 7 y 8).** `LoginScreen.tsx`, `CompleteProfileScreen.tsx` y `SettingsScreen.tsx`. *Prueba:* `cumplimientoLegal019.test.ts` verifica casilla sin premarcar en registro y enlaces HTTPS visibles.
- [x] **T5 · Preferencias web de cookies/almacenamiento e integración con `Map.web.tsx` (criterios 9 a 11).** `preferenciasWeb.ts`, `PreferenciasWebModal.tsx`, `Map.web.tsx`, `app/_layout.tsx` y `SettingsScreen.tsx`. *Prueba:* `cumplimientoLegal019.test.ts` prueba aceptar, solo esenciales, personalizar, caducidad de 180 días, fallo de almacenamiento y respeto en `Map.web.tsx`.
- [x] **T6 · Cabeceras HSTS y CSP en `frontend/vercel.json` (criterio 12).** *Prueba:* `appWeb018.test.ts` y `cumplimientoLegal019.test.ts`.
- [x] **T7 · Limpieza documental y trazabilidad.** Marcar `D2` en `007`, limpiar duplicados en `018` y `specs/README.md`, redactar borrador `specs/020-pagos-y-comisiones/spec.md` y registrar versión `1.89.0` en `REGISTRO_CAMBIOS.md`.
- [x] **T8 · Verificación completa y PR en verde.** Backend 459/459 + `npm run typecheck`; Frontend 548/548 + `npx tsc --noEmit`.

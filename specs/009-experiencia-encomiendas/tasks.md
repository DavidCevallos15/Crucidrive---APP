# 009 · Tareas y evidencia

Los checks separan implementación comprobada de validaciones aún pendientes. La revisión formal de esta spec no se declara completada retrospectivamente.

- [ ] T1 · Revisión formal de spec/plan por David en el PR; registrar la desviación de documentación posterior.
- [x] T2 · Marca, acceso y controles adaptables (criterio 1) → capturas móvil/escritorio y validación de campos de `docs/diseno-seguridad-2026-10.md`; `tests/identidad.test.ts`.
- [x] T3 · Menú, rutas de configuración y selección de los dos servicios (2, 3) → capturas `menu-mobile`, `settings-mobile`, `settings-desktop` y `tests/encomiendas.test.ts` para acceso por rol/visitante. No prueba permisos nativos.
- [x] T4 · Validación y representación de encomiendas (4, 5) → `frontend/tests/encomiendas.test.ts`, `backend/tests/encomiendas.test.js`, `frontend/tests/avisos.test.ts`; captura de validación antes del envío. Tarifa de pasajeros conserva regresiones de specs 001/003.
- [x] T5 · Evitar detalles privados en ofertas (6, parte servidor) → `backend/tests/encomiendas.test.js`; prueba SQL de permisos preparada en `supabase/tests/rls_005.sql`, su ejecución sigue en T6.
- [ ] T6 · Ejecutar migraciones y RLS 001–005 en una base limpia (4, 6, 8) y revisar advisors sin nuevos hallazgos. Bloqueo observado: Docker Desktop no iniciado. No marcar como cumplida por pruebas con mocks.
- [ ] T7 · Verificar exportación del perfil en sesión de prueba web/nativa (7); implementación disponible, sin exportar datos reales durante revisión.
- [x] T8 · API de eliminación propia, contraseña, confirmación, bloqueo activo y errores de Storage (8, parte API) → `backend/tests/cuentaController.test.js` con clientes simulados; ningún usuario real eliminado.
- [ ] T9 · Eliminar una cuenta desechable en entorno de pruebas, comprobar aislamiento SQL, limpieza Auth/Storage y reintento tras fallo entre fases (8). Depende de T6.
- [x] T10 · Aislamiento por sesión y cierre de cuenta (9) → `accountScope.test.ts`, `useAuthStore.test.ts`, `closeAccountSession.test.ts`; guardas de sesión en la eliminación. Falta recorrido con cambio de cuenta en dispositivo.
- [x] T11 · Almacenamiento protegido y política de caché (10, lógica) → `secureSessionStorage.test.ts`, `serviceWorkerSecurity.test.ts`, `backend/tests/hardening.test.js`.
- [ ] T12 · Verificar migración real de sesión, Keychain/Keystore, permisos, notificaciones y apertura del marcador en teléfono (9–12). El bundle Android no sustituye esta prueba ni es un APK.
- [x] T13 · Verificación local → 314 tests frontend, 289 backend; TypeScript sin errores; exportaciones Expo web y Android correctas; revisión visual web independiente «ship», limitada a capturas responsive.
- [x] T14 · Documentar activación 0015 y límites en `docs/`, conservar procedencia de recursos y extender registro de cambios. No se incluye el video privado de referencia.
- [ ] T15 · Revisión de privacidad por responsable, CI verde, aprobación y fusión del PR. No publicar ni desplegar automáticamente desde esta tarea.

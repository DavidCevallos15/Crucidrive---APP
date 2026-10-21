# Tareas 012

- [x] T1 · Registrar aprobación y decisiones A/B; spec y plan antes del código.
- [x] T2 · Implementar menú izquierdo, borde y cierre por gesto, cuenta dentro. Prueba: umbrales y navegación web; revisión de recuperación al interrumpir. Gesto real Android trasladado a T7.
- [ ] T3 · Sector y SOS en cabecera fija de todas las hojas. Código y capturas de selección/ficha/encomienda 360×640 completos; falta observar estados buscando/aceptado/en curso con cuentas reales. Conserva marcador 911, sin simular registro del 006.
- [x] T4 · Aviso fuera de Crucita, GPS exterior excluido del origen, mapa centrado; conductor sin bloqueo. Prueba: coordenadas locales/exteriores/inválidas, borde y regreso a zona en `campo012.test.ts`; comprobación visual de GPS en dispositivo en T7.
- [x] T5 · Lugares: búsqueda + sector + visibilidad y carga coherente. Prueba: parámetros, consulta REST con filtros antes del límite y rechazo de sector inválido; revisión de descarte de respuestas viejas. Sesión admin en dispositivo pendiente de T7.
- [x] T6 · TypeScript, suites, exportaciones y revisión/documentación completos. Commits subidos y PR #59 creado hacia main; pruebas físicas conservadas como pendientes.
- [ ] T7 · Instalar APK del PR #58 en emulador/teléfono, GPS Crucita (-0.8710, -80.5440), cancelar viaje aceptado con motivo y probar logout/chat entre cuentas reales. Se encontró LDPlayer en `C:/LDPlayer/LDPlayer9`; su ADB no muestra dispositivos y la conexión localhost:5555 fue rechazada. La consola aceptó `locate` sin salida, pero no se confirmó GPS en Android. El teléfono no está conectado para depuración.
- [x] T8 · Corregir reinicios de desarrollo y parseo `TRUST_PROXY` según el registro de David. Prueba: 386 backend, con rechazo de configuración inválida e IP reenviada ignorada en modo directo. No se habilitó confianza automáticamente por recibir una cabecera.

Evidencia y procedimiento pendiente: `docs/validacion-campo-012.md`. Commits: spec `303e30b`; implementación UI `d2b6e0a`; configuración `9273e79`. PR: https://github.com/DavidCevallos15/Crucidrive---APP/pull/59.

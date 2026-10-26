# Specs de CruciDrive (Spec-Driven Development)

Regla: **no se escribe código de una funcionalidad sin `spec.md` aprobada.**
Flujo por paso: spec → aprobación → plan → tareas → implementación (commits pequeños) → verificación contra criterios → `REGISTRO_CAMBIOS.md`.

| Paso | Carpeta | Estado |
| --- | --- | --- |
| 0 | (validación de campo, sin código) | Pendiente (D-07: aliado institucional) |
| 1 | `001-cimientos` | **Completo** (T18, deuda de tipos del frontend, pasa a 007) |
| 2 | `002-identidad` | **Completo** (prueba de humo 28/28). Pendiente: texto de consentimiento revisado por un abogado y ver con sesiones reales las vistas del conductor y del administrador |
| 3 | `003-despacho` | **Completo** (prueba de humo 29/29 el 2026-10-09). Pendiente: probar en un teléfono real que la oferta llegue con la app abierta; con la app cerrada, en el paso 004 |
| 4 | `004-tracking-push` | **Implementado** (T1 a T16). Falta T17: prueba de campo de David con dos teléfonos |
| 5 | `005-viaje` | **En curso.** BD, backend y conductor hechos (#54, #55; 0017 en producción). Faltan las pantallas del pasajero (T8 a T11) y la prueba T12 |
| 6 | `006-sos-admin` | Sin iniciar |
| 7 | `007-hardening` | Sin iniciar |
| 8 | `008-piloto` | **En curso**: backend de prueba en una VM de Azure (`backend-de-prueba.md`, D-16). Falta el resto del piloto |

Plan maestro: documento "Plan CruciDrive: viabilidad, MVP y escalado" (claude.ai).
Cada carpeta contiene `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (tareas con su prueba).

## Ampliaciones solicitadas

| Carpeta | Estado |
| --- | --- |
| `009-experiencia-encomiendas` | Identidad, seguridad de sesión, navegación, configuración y encomiendas solicitadas por David el 20 oct 2026. Implementación local y formalización posterior, documentada como desviación de «spec primero». PR en borrador: pendientes revisión formal, RLS 0015 y teléfono. No completa ni renumera 005–008. |
| `010-ajustes-de-campo` | **Implementado** (A: #51, B: #52; 0016 en producción). Falta la revisión en el APK (T7 y T12). Spec aprobada en el PR #49, 20 oct 2026: interfaz compacta para 360 × 640 y lista de ofertas del conductor sin quitar D-11 (D-15 propuesta). |
| `011-diseno-motion` | Paleta y motion premium solicitados por David; bienvenida una sola vez, tricimoto propia, componentes y guía de sistema. Spec/plan antes de código. Validación web y empaquetado; teléfono pendiente. |
| `012-ajustes-de-campo-2` | **Aprobada por David e implementada en PR**, 20 oct 2026. Menú izquierdo, cuenta dentro, cabecera fija con SOS/sector y aviso fuera de Crucita sin bloquear disponibilidad del conductor durante el piloto. Lugares admin por nombre + sector, visibles por defecto y ocultos mediante filtro. Pruebas y revisión web completas; Android y viaje/chat reales pendientes. |

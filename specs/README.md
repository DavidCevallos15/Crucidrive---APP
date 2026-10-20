# Specs de CruciDrive (Spec-Driven Development)

Regla: **no se escribe código de una funcionalidad sin `spec.md` aprobada.**
Flujo por paso: spec → aprobación → plan → tareas → implementación (commits pequeños) → verificación contra criterios → `REGISTRO_CAMBIOS.md`.

| Paso | Carpeta | Estado |
| --- | --- | --- |
| 0 | (validación de campo, sin código) | Pendiente (D-07: aliado institucional) |
| 1 | `001-cimientos` | **Completo** (T18, deuda de tipos del frontend, pasa a 007) |
| 2 | `002-identidad` | **Completo** (prueba de humo 28/28). Pendiente: texto de consentimiento revisado por un abogado y ver con sesiones reales las vistas del conductor y del administrador |
| 3 | `003-despacho` | **Completo** (prueba de humo 29/29 el 2026-10-09). Pendiente: probar en un teléfono real que la oferta llegue con la app abierta; con la app cerrada, en el paso 004 |
| 4 | `004-tracking-push` | **Plan en revisión** (spec aprobada en el PR #35) |
| 5 | `005-viaje` | **Spec aprobada** (PR #49; decisiones del 20 oct 2026: calificaciones, motivos y llegada confirmada por las dos partes). Falta plan |
| 6 | `006-sos-admin` | Sin iniciar |
| 7 | `007-hardening` | Sin iniciar |
| 8 | `008-piloto` | Sin iniciar |

Plan maestro: documento "Plan CruciDrive: viabilidad, MVP y escalado" (claude.ai).
Cada carpeta contiene `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (tareas con su prueba).

## Ampliaciones solicitadas

| Carpeta | Estado |
| --- | --- |
| `009-experiencia-encomiendas` | Identidad, seguridad de sesión, navegación, configuración y encomiendas solicitadas por David el 20 oct 2026. Implementación local y formalización posterior, documentada como desviación de «spec primero». PR en borrador: pendientes revisión formal, RLS 0015 y teléfono. No completa ni renumera 005–008. |
| `010-ajustes-de-campo` | **Spec aprobada** (PR #49, 20 oct 2026): interfaz compacta para 360 × 640 y lista de ofertas del conductor sin quitar D-11 (D-15 propuesta). |

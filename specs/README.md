# Specs de CruciDrive (Spec-Driven Development)

Regla: **no se escribe código de una funcionalidad sin `spec.md` aprobada.**
Flujo por paso: spec → aprobación → plan → tareas → implementación (commits pequeños) → verificación contra criterios → `REGISTRO_CAMBIOS.md`.

| Paso | Carpeta | Estado |
| --- | --- | --- |
| 0 | (validación de campo, sin código) | Pendiente (D-07: aliado institucional) |
| 1 | `001-cimientos` | **Completo** (T18, deuda de tipos del frontend, pasa a 007) |
| 2 | `002-identidad` | **Completo** (prueba de humo 28/28). Pendiente: texto de consentimiento revisado por un abogado y ver con sesiones reales las vistas del conductor y del administrador |
| 3 | `003-despacho` | **Plan en revisión** (spec aprobada en el PR #18) |
| 4 | `004-tracking-push` | Sin iniciar |
| 5 | `005-viaje` | Sin iniciar |
| 6 | `006-sos-admin` | Sin iniciar |
| 7 | `007-hardening` | Sin iniciar |
| 8 | `008-piloto` | Sin iniciar |

Plan maestro: documento "Plan CruciDrive: viabilidad, MVP y escalado" (claude.ai).
Cada carpeta contiene `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (tareas con su prueba).

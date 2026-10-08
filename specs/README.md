# Specs de CruciDrive (Spec-Driven Development)

Regla: **no se escribe código de una funcionalidad sin `spec.md` aprobada.**
Flujo por paso: spec → aprobación → plan → tareas → implementación (commits pequeños) → verificación contra criterios → `REGISTRO_CAMBIOS.md`.

| Paso | Carpeta | Estado |
| --- | --- | --- |
| 0 | (validación de campo, sin código) | Pendiente (D-07: aliado institucional) |
| 1 | `001-cimientos` | **Completo** (T18, deuda de tipos del frontend, pasa a 007) |
| 2 | `002-identidad` | Spec y plan aprobados; BD y backend listos; faltan pantallas (T8 a T10), contraseña mínima (T12) y la prueba de humo (T14) |
| 3 | `003-despacho` | Sin iniciar |
| 4 | `004-tracking-push` | Sin iniciar |
| 5 | `005-viaje` | Sin iniciar |
| 6 | `006-sos-admin` | Sin iniciar |
| 7 | `007-hardening` | Sin iniciar |
| 8 | `008-piloto` | Sin iniciar |

Plan maestro: documento "Plan CruciDrive: viabilidad, MVP y escalado" (claude.ai).
Cada carpeta contiene `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (tareas con su prueba).

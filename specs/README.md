# Specs de CruciDrive (Spec-Driven Development)

Regla: **no se escribe código de una funcionalidad sin `spec.md` aprobada.**
Flujo por paso: spec → aprobación → plan → tareas → implementación (commits pequeños) → verificación contra criterios → `REGISTRO_CAMBIOS.md`.

| Paso | Carpeta | Estado |
| --- | --- | --- |
| 0 | (validación de campo, sin código) | Pendiente (D-07: aliado institucional) |
| 1 | `001-cimientos` | Implementado y en producción; enmienda 1 (tarifa por persona) aplicada; falta la prueba de humo con 2 usuarios (T16) |
| 2 | `002-identidad` | Sin iniciar |
| 3 | `003-despacho` | Sin iniciar |
| 4 | `004-tracking-push` | Sin iniciar |
| 5 | `005-viaje` | Sin iniciar |
| 6 | `006-sos-admin` | Sin iniciar |
| 7 | `007-hardening` | Sin iniciar |
| 8 | `008-piloto` | Sin iniciar |

Plan maestro: documento "Plan CruciDrive: viabilidad, MVP y escalado" (claude.ai).
Cada carpeta contiene `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (tareas con su prueba).

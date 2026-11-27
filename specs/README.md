# Specs de CruciDrive (Spec-Driven Development)

Regla: **no se escribe código de una funcionalidad sin `spec.md` aprobada.**
Flujo por paso: spec → aprobación → plan → tareas → implementación (commits pequeños) → verificación contra criterios → `REGISTRO_CAMBIOS.md`.

| Paso | Carpeta | Estado |
| --- | --- | --- |
| 0 | (validación de campo, sin código) | Pendiente (D-07: aliado institucional) |
| 1 | `001-cimientos` | **Completo** (T18, deuda de tipos del frontend, pasa a 007) |
| 2 | `002-identidad` | **Completo** (prueba de humo 28/28). Pendiente: texto de consentimiento revisado por un abogado y ver con sesiones reales las vistas del conductor y del administrador |
| 3 | `003-despacho` | **Completo** (prueba de humo 29/29 el 2026-10-09). Pendiente: probar en un teléfono real que la oferta llegue con la app abierta; con la app cerrada, en el paso 004 |
| 4 | `004-tracking-push` | **Completo.** T17 aprobada por David el 19 nov 2026 sin medición: en Crucita no había internet. Los tiempos se miden en el piloto |
| 5 | `005-viaje` | **Completo** (#54, #55, #64; 0017 en producción). T12 aprobada por David el 19 nov 2026 sin medición; se repite en el piloto |
| 6 | `006-sos-admin` | **Spec aprobada** (4 nov 2026: A a D con las propuestas; SOS en la pantalla Seguridad; panel en un despliegue aparte, limitado a la IP de David). Falta `plan.md` |
| 7 | `007-hardening` | **Completo** (25 nov 2026: PR 1 a PR 4 fusionados, 0018/0019 en producción con advisors limpios, backend PR 3 desplegado y D2 confirmada por David en Google Cloud). Los cambios nativos de PR 4 (`app.json`) salen en el próximo build Android |
| 8 | `008-piloto` | **En curso**: backend de prueba en una VM de Azure (`backend-de-prueba.md`, D-16) y actualizaciones por aire (`actualizaciones-por-aire.md`, D-17). Falta el resto del piloto |

Plan maestro: documento "Plan CruciDrive: viabilidad, MVP y escalado" (claude.ai).
Cada carpeta contiene `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (tareas con su prueba).

## Ampliaciones solicitadas

| Carpeta | Estado |
| --- | --- |
| `009-experiencia-encomiendas` | Identidad, seguridad de sesión, navegación, configuración y encomiendas solicitadas por David el 20 oct 2026. Implementación local y formalización posterior, documentada como desviación de «spec primero». PR en borrador: pendientes revisión formal, RLS 0015 y teléfono. No completa ni renumera 005–008. |
| `010-ajustes-de-campo` | **Implementado** (A: #51, B: #52; 0016 en producción). Falta la revisión en el APK (T7 y T12). Spec aprobada en el PR #49, 20 oct 2026: interfaz compacta para 360 × 640 y lista de ofertas del conductor sin quitar D-11 (D-15 propuesta). |
| `011-diseno-motion` | Paleta y motion premium solicitados por David; bienvenida una sola vez, tricimoto propia, componentes y guía de sistema. Spec/plan antes de código. Validación web y empaquetado; teléfono pendiente. |
| `012-ajustes-de-campo-2` | **Aprobada por David e implementada en PR**, 20 oct 2026. Menú izquierdo, cuenta dentro, cabecera fija con SOS/sector y aviso fuera de Crucita sin bloquear disponibilidad del conductor durante el piloto. Lugares admin por nombre + sector, visibles por defecto y ocultos mediante filtro. Pruebas y revisión web completas; Android y viaje/chat reales pendientes. |
| `015-acceso-google-y-correo` | **Spec aprobada** (4 nov 2026, P1 a P5 con las propuestas). Entrada con «Continuar con Google» y «Continuar con correo», correo verificado y recuperación de contraseña. Correo con SMTP propio (Resend) y dominio propio. La plantilla está en `supabase/templates/`. Falta `plan.md` |
| `016-estructura-de-referencia` | **Spec aprobada** (4 nov 2026, Q1 a Q7 con las propuestas; Q6 sin número de soporte). Estructura de pantallas tomada de InDrive con la paleta del 011: inicio, ruta, menú, historial, Seguridad, configuración y registro del conductor en 3 pasos. Depende del 013 y del 014 para el precio de las encomiendas y el pin. Falta `plan.md` |
| `013-encomiendas-contraoferta` y `014-mapa-y-recogida` | Por redactar (D-19 e ideas del 4 nov). El 013 va después de cerrar el 009 |
| `017-pedido-sin-internet` | **Spec aprobada** (19 nov 2026, R1 a R8 con las propuestas; D-21). **Parte A implementada** (#74: aviso «Sin internet», plano simple y reintento sin duplicar) y probada por David en el APK (T7, 19 nov 2026). Partes B a G (pedir por SMS) después del PR 2 del 007 |
| `018-app-web-iphone` | **Aprobada e implementada** (19 nov 2026, W1 a W4 con las propuestas; Enmienda 1 Google Maps web). Publicada en `https://app.tricimoto.app` (#78, #80, T6 a T8). Faltan la prueba en un iPhone real (T9) y la clave web de Google Maps si aún no se cargó en Vercel (T11) |
| `019-cumplimiento-legal` | **Aprobada e implementada** (25 nov 2026). Páginas públicas HTTPS en `tricimoto.app` (`/privacidad`, `/terminos`, `/reembolsos`, `/eliminar-cuenta`), consentimiento v1.0 sincronizado, enlaces legales y casilla en registro, preferencias web de cookies/mapa y cabeceras HSTS/CSP |
| `020-pagos-y-comisiones` | **Implementado y en producción** (27 nov 2026; D-22; #86 a #89). Créditos prepagos del conductor: 0,10 USD por viaje, 0,20 USD por encomienda, bono de 2 USD por cédula, recargas manuales (DeUna, transferencia, depósito o efectivo) con comprobante único, sin Google Play Billing. Migraciones 0020 y 0021, VM actualizada, cobro activo y aviso de privacidad 1.1. Falta T15 (prueba de campo) |

# 002 · Identidad, roles y aprobación de conductores

Estado: **decisiones resueltas por David el 8 oct 2026 — pendiente de su "aprobada" para pasar a `plan.md`**

## Por qué
Hoy cualquiera con una cuenta puede registrarse como `conductor` (el perfil se crea y la tricimoto queda `inactivo`, pero nada impide operar). La constitución exige aprobación por un administrador (D-04), consentimiento explícito antes de recolectar cédula o GPS (regla 4, LOPDP) y que nadie se auto-asigne `admin`. Además, el backend ya existe pero la app no tiene pantallas de registro e inicio de sesión conectadas a él.

## Historias
- Como **pasajero**, quiero crear mi cuenta con correo y contraseña, aceptar el tratamiento de mis datos y empezar a pedir viajes sin esperar aprobación.
- Como **conductor**, quiero registrar mi cédula, placa y fotos, y saber en qué estado está mi solicitud (pendiente, aprobada o rechazada con motivo).
- Como **administrador**, quiero ver las solicitudes de conductores pendientes, revisar sus fotos y datos, y aprobarlas o rechazarlas.
- Como **sistema**, quiero que un conductor no aprobado no pueda ponerse `disponible`, aceptar viajes ni aparecer en el mapa.

## Criterios de aceptación
1. **Dado** un usuario nuevo, **cuando** se registra sin aceptar el consentimiento, **entonces** no se crea el perfil. Con consentimiento, se guarda con fecha y versión del texto aceptado (ver `consentimiento-lopdp.md`).
2. **Dado** un conductor con estado `pendiente` o `rechazado`, **cuando** intenta actualizar su ubicación, ponerse `disponible` o aceptar un viaje, **entonces** la BD lo rechaza (RLS/CHECK), no solo el backend.
3. **Dado** un administrador, **cuando** aprueba o rechaza a un conductor, **entonces** el estado cambia y queda registrado quién y cuándo (y el motivo si se rechaza); un conductor no puede cambiar su propio estado.
4. **Dado** un usuario cualquiera, **cuando** intenta auto-asignarse el rol `admin` o modificar su estado de aprobación, **entonces** es rechazado (pruebas RLS).
5. **Dado** la cédula y las fotos del conductor, **cuando** se almacenan, **entonces** están en un bucket **privado** de Supabase Storage y solo las leen el propio conductor y los administradores; un pasajero u otro conductor recibe acceso denegado (pruebas de políticas de Storage).
6. **Dado** una foto tomada con el teléfono, **cuando** el conductor la sube, **entonces** la app la reduce antes de enviarla (máx. ~300 KB por imagen) para respetar el presupuesto de datos móviles (regla 5 de la constitución).
7. **Dado** una contraseña de menos de 8 caracteres, **cuando** el usuario se registra, **entonces** la app y Supabase Auth la rechazan (la contraseña no pasa por nuestro backend).
8. **Dado** la app, **cuando** el usuario abre por primera vez, **entonces** puede registrarse e iniciar sesión, y la sesión se mantiene al reabrir (sin pedir contraseña cada vez).
9. **Dado** un viaje aceptado, **cuando** el pasajero lo consulta, **entonces** ve nombre, placa y teléfono del conductor aprobado, y nada más de su perfil.

## Decisiones (respondidas por David)
- **Fotos y cédula:** se suben a Supabase Storage (bucket privado). Se pide foto del conductor, foto de la cédula y foto de la tricimoto/placa.
- **Primer administrador:** David. Se asigna una sola vez por SQL a su cuenta (se confirmará cuál de sus dos correos en el plan); nadie más puede crearse admin desde la app.
- **Contraseñas:** mínimo 8 caracteres. La protección contra contraseñas filtradas de Supabase sigue pospuesta (D-10).
- **Consentimiento LOPDP:** borrador redactado en `consentimiento-lopdp.md`; se recomienda revisión legal antes del piloto.

## Fuera de alcance
SMS/OTP (D-04), recuperación de contraseña por teléfono, pagos, calificaciones, despacho (paso 003), catálogo de lugares (paso 003, D-09).

## Preguntas que se cierran en `plan.md`
- Retención de las fotos de cédula tras rechazar o dar de baja a un conductor (propuesta: borrar a los 30 días).
- Si el correo debe verificarse antes de poder iniciar sesión (hoy los dos usuarios de prueba están confirmados).

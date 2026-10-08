# 002 · Plan técnico

Spec aprobada al fusionar el PR #10 (8 oct 2026). Este plan dice **cómo**; la spec dice qué y por qué.

## Decisiones de diseño

| # | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- |
| Q1 | Datos de verificación en una tabla aparte, `conductores_verificacion` (1:1 con el conductor) | Columnas en `perfiles` | `perfiles` la leen otros usuarios (nombre del conductor en un viaje). La cédula y el estado de revisión no deben compartir tabla ni políticas con datos visibles al pasajero (criterios 5 y 9) |
| Q2 | Estado `pendiente` / `aprobado` / `rechazado` con `motivo_rechazo`, `revisado_por`, `revisado_en` | Un booleano `aprobado` | Hay que distinguir "aún no revisado" de "rechazado" y guardar quién y cuándo (criterio 3) |
| Q3 | Función `private.es_conductor_aprobado()` usada en las políticas RLS de `tricimotos` (poner `disponible` / ubicación) y de `viajes` (aceptar) | Validar solo en el backend | El criterio 2 exige que la BD lo rechace aunque alguien llame a la API REST de Supabase directamente |
| Q4 | Admin: `perfiles.rol = 'admin'` asignado por un SQL de una sola vez en `supabase/one-off/` | Pantalla "hacerme admin" o un secreto en la app | Nadie puede auto-asignarse admin (criterio 4); ya existe el CHECK de rol y el permiso de columna sobre `rol` no se concede |
| Q5 | Fotos y cédula en Supabase Storage, bucket **privado** `verificacion`, ruta `{user_id}/{tipo}.jpg`; políticas en `storage.objects`: el dueño inserta y lee su carpeta, el admin lee todo, nadie actualiza ni borra una vez `aprobado` | Guardarlas en la BD como base64 | Storage sirve archivos con URL firmada de corta duración y no engorda las consultas |
| Q6 | La app reduce cada foto a ~300 KB (lado largo ≤ 1280 px, JPEG calidad ≈ 0,6) con `expo-image-manipulator` antes de subirla | Subir el original del teléfono (3–8 MB) | Presupuesto de 15 MB por jornada (criterio 6). Tres fotos ≈ 1 MB, una sola vez |
| Q7 | El registro lo hace el cliente con `supabase.auth.signUp`; el perfil y el consentimiento los guarda `POST /api/auth/registro` | Registrar todo desde el backend | El JWT del usuario ya funciona con RLS (D-06); el backend valida y guarda `consentimiento_version` y `consentimiento_en` (criterio 1) |
| Q8 | Contraseña mínima de 8 caracteres: la valida la app y se configura en Supabase Auth (Authentication → Policies) | Validarla en el backend | La contraseña nunca pasa por nuestro backend, así que solo Supabase Auth puede imponerla de verdad |
| Q9 | Cédula como `text` con CHECK de 10 dígitos y validación del dígito verificador ecuatoriano en backend y app | Aceptar cualquier texto | Evita errores de digitación y datos basura; la regla (módulo 10) es pública |

## Esquema (migración `0010_identidad.sql`)

- `perfiles`: `+ consentimiento_version text`, `+ consentimiento_en timestamptz`. Los 2 perfiles de prueba existentes se rellenan con la versión `prueba`.
- `conductores_verificacion`: `conductor_id uuid pk → perfiles`, `cedula text`, `foto_conductor text`, `foto_cedula text`, `foto_vehiculo text` (rutas en Storage), `estado text default 'pendiente'`, `motivo_rechazo text`, `revisado_por uuid → perfiles`, `revisado_en timestamptz`, `creado_en timestamptz`. RLS: el dueño inserta (siempre `pendiente`) y lee lo suyo; el admin lee todo y actualiza solo `estado`, `motivo_rechazo`, `revisado_por`, `revisado_en`.
- `private.es_conductor_aprobado()` y `private.es_admin()` (`security definer`, `search_path=''`, como las demás).
- Políticas de `tricimotos` y `viajes` ajustadas para exigir conductor aprobado.
- Bucket `verificacion` (privado, 1 MB por archivo, solo `image/jpeg`) y sus políticas.

## Backend

- `POST /api/auth/registro`: exige `consentimiento: true`, guarda versión y fecha; el conductor queda con tricimoto `inactivo` y verificación `pendiente`.
- `POST /api/conductores/verificacion`: cédula + rutas de las 3 fotos ya subidas (validadas: dueño, tipo, tamaño).
- `GET /api/admin/conductores?estado=pendiente` y `GET /api/admin/conductores/:id` (devuelve URLs firmadas de 5 min para las fotos).
- `POST /api/admin/conductores/:id/aprobar` y `/rechazar` (motivo obligatorio). Solo rol `admin`.
- Sockets: `update_location` y `join_sector` de un conductor no aprobado responden `error_message` (la RLS ya lo bloquea; esto da un mensaje claro).

## Frontend

Reemplaza el login por SMS (`LoginScreen`) por correo y contraseña, y añade: registro con casilla de consentimiento y enlace al texto, formulario de verificación del conductor (3 fotos con la cámara), pantalla de estado (pendiente / rechazado con motivo), y un panel de administrador con la lista de pendientes y los botones aprobar / rechazar. La sesión se mantiene con AsyncStorage (ya configurado en el cliente de Supabase).

## Riesgos

- **Datos de prueba:** la cuenta `jimdav1506ceva@gmail.com` es hoy el conductor de la prueba de humo. Para volverla admin hay que borrar su tricimoto y su viaje de prueba, o usar otra cuenta de conductor para `npm run smoke`.
- **Consentimiento:** el texto es un borrador (v0.1); antes del piloto debe revisarlo un abogado y subir de versión.
- **Cámara en web:** la verificación se prueba en Android o con carga de archivo en web; la cámara nativa no está disponible en el navegador.

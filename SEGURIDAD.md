# Directrices de Seguridad y Normativa (LOPDP)

Este proyecto maneja datos críticos de usuarios (cédulas, ubicaciones GPS, números telefónicos). El Agente de IA debe aplicar los siguientes escudos de seguridad por defecto:

## 1. Cumplimiento LOPDP (Ecuador)
- Nunca almacenar contraseñas en texto plano. Obligatorio usar `bcrypt` para hashing antes de guardar en PostgreSQL.
- Las coordenadas GPS históricas (logs de viajes) no deben ser accesibles públicamente y deben estar vinculadas a un ID anónimo, no al nombre del usuario.

## 2. Gestión de Entorno
- Jamás quemar (hardcode) credenciales, claves de API (Supabase, JWT secrets), ni URLs en el código fuente. Obligatorio inyectarlas a través de archivos `.env`.
- Generar un archivo `.env.example` para documentar qué variables se necesitan.

## 3. Seguridad en WebSockets y API
- Todo endpoint de la API (`/backend/src/routes/`) debe estar protegido por un middleware de autenticación (JWT) excepto las rutas públicas (Login/Registro).
- Las conexiones de Socket.io deben validar el token del conductor antes de aceptar la conexión y transmitir coordenadas.

## 4. Validación de Datos
- Toda entrada del usuario (formularios de registro, solicitud de viaje) debe ser sanitizada y validada tanto en el frontend como en el backend.
- Implementar rate limiting en los endpoints críticos para prevenir ataques de fuerza bruta.

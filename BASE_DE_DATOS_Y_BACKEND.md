# Documentación Técnica de Arquitectura de Datos: CruciDrive Backend

Este documento detalla los cambios realizados en la base de datos de **Supabase**, la estructura final del esquema relacional, las políticas de seguridad implementadas, y la lógica de flujo de datos (REST y WebSockets) requerida para la fase operativa del MVP de **CruciDrive** en Crucita, Ecuador.

---

## 1. Estructura Final de la Base de Datos (PostgreSQL + PostGIS)

El diseño de la base de datos se ha estructurado para consolidar de forma óptima los flujos de geolocalización, gestión de carreras (viajes) y mensajería en tiempo real. 

### Diagrama de Relaciones Lógicas
* `auth.users` (Supabase Auth) ──► `public.perfiles` (1:1)
* `public.perfiles` ──► `public.tricimotos` (1:1 - Conductor)
* `public.perfiles` ──► `public.viajes` (1:N - Pasajero o Conductor)
* `public.viajes` ──► `public.threads` (1:1 - Vinculación de Chat por Carrera, con opción `ON DELETE SET NULL`)
* `public.threads` ──► `public.thread_members` (1:N)
* `public.threads` ──► `public.messages` (1:N)

### Diccionario de Tablas e Integridad Referencial

#### A. Tabla: `public.perfiles`
Extiende los datos de autenticación nativos de Supabase para añadir lógica de negocio de usuarios.
* `id` (`UUID`, PK): Enlazado directamente mediante un `REFERENCES auth.users(id) ON DELETE CASCADE`. Si el usuario se elimina de la autenticación, su perfil desaparece automáticamente.
* `rol` (`VARCHAR`): Restringido mediante un `CHECK (rol IN ('pasajero', 'conductor', 'admin'))` para mitigar la inyección de roles inválidos.
* `nombre` (`VARCHAR`): Nombre completo del usuario para la visualización en la App.
* `telefono` (`VARCHAR`, `UNIQUE`): Llave única de contacto, esencial para validaciones de seguridad telefónica.
* `activo` (`BOOLEAN`): Estado de habilitación del usuario.

#### B. Tabla: `public.tricimotos`
Almacena el estado técnico operativo y la geolocalización de las unidades de transporte.
* `id` (`UUID`, PK): Identificador único de la unidad.
* `conductor_id` (`UUID`, FK): Vinculado a `public.perfiles(id) ON DELETE CASCADE`.
* `placa` (`VARCHAR`, `UNIQUE`): Identificación vehicular reglamentaria en el territorio ecuatoriano.
* `estado` (`VARCHAR`): `CHECK (estado IN ('disponible', 'ocupado', 'inactivo'))`. Controla la disponibilidad en el algoritmo de emparejamiento.
* `ubicacion_actual` (`GEOGRAPHY(POINT, 4326)`): Columna espacial nativa de **PostGIS** utilizando el sistema de coordenadas de referencia espacial WGS84. Permite realizar consultas de distancia y geocercas eficientes directamente en la base de datos.

#### C. Tabla: `public.viajes`
Entidad principal para el registro de transacciones de carreras.
* `id` (`UUID`, PK): Identificador de la carrera.
* `pasajero_id` / `conductor_id` (`UUID`, FK): Vinculados a `public.perfiles(id) ON DELETE SET NULL` para preservar el historial estadístico/contable del viaje aun si una de las cuentas involucradas es dada de baja en el futuro.
* `origen` y `destino` (`GEOGRAPHY(POINT, 4326)`): Puntos geográficos exactos de inicio y fin de la ruta.
* `estado` (`VARCHAR`): Ciclo de vida completo del viaje controlado por un `CHECK (estado IN ('solicitado', 'aceptado', 'en_curso', 'finalizado', 'cancelado'))`.
* `tarifa` (`DECIMAL(5,2)`): Costo económico calculado para la carrera.

#### D. Tablas de Mensajería (`public.threads`, `public.thread_members`, `public.messages`)
* `threads.viaje_id` (`UUID`, FK): Vincula un hilo de chat de forma única con un viaje mediante `REFERENCES public.viajes(id) ON DELETE SET NULL`. Esto resuelve el problema de persistencia permitiendo que el chat sobreviva en modo histórico si el viaje es purgado del flujo activo.
* `thread_members`: Rompe la relación muchos a muchos entre hilos y perfiles, forzando un índice único compuesto (`UNIQUE(thread_id, user_id)`) para evitar duplicaciones críticas de participación.
* `messages`: Registra el contenido del mensaje asociando un índice rápido en `thread_id` para garantizar consultas de historial instantáneas (baja latencia).

---

## 2. Capa de Seguridad: Row Level Security (RLS)

Por defecto, PostgreSQL bloquea el acceso público cuando RLS está activo. Se han implementado políticas granulares basadas en contextos de sesión para asegurar que ningún usuario pueda espiar o interceptar hilos de comunicación de terceros.

### Lógica de Control de Acceso
Las políticas utilizan la función interna `auth.uid()` provista de manera segura por el JWT (JSON Web Token) emitido en el login.

1.  **Lectura de Mensajes (`SELECT` para `public.messages`):**
    Un usuario autenticado solo puede ejecutar lecturas si existe un registro concurrente en la tabla de miembros (`thread_members`) que valide su pertenencia al canal.
    ```sql
    EXISTS (
      SELECT 1 FROM thread_members 
      WHERE thread_members.thread_id = messages.thread_id 
      AND thread_members.user_id = auth.uid()
    )
    ```
2.  **Inserción de Mensajes (`INSERT` para `public.messages`):**
    Garantiza doble control defensivo:
    * El campo `sender_id` enviado por el cliente HTTP/WebSocket debe coincidir estrictamente con el ID de su propia sesión de Supabase Auth (`auth.uid() = sender_id`). Esto evita la suplantación de identidad en los chats.
    * Debe ser miembro activo verificado del canal de chat de destino.

---

## 3. Flujo y Funcionamiento de las Solicitudes (Requests)

El backend opera de forma híbrida combinando la arquitectura **REST** (para operaciones transaccionales puntuales y autenticación) con **WebSockets** vía **Socket.io** (para la sincronización y eventos en tiempo real).

### A. Flujo de Autenticación y Creación de Perfiles (REST API)
```
[Cliente App] ────(POST /api/auth/registro)────► [Express Backend]
                                                        │
                      ┌─────────────────────────────────┘
                      ▼
             [Supabase Auth (Sign Up)] ──► Retorna UID seguro de autenticación
                      │
                      ▼
             [public.perfiles (Insert)] ──► Almacena Nombre, Teléfono y Rol
                      │
                      ▼
[Cliente App] ◄───(HTTP 201 Created)─────── Retorna Token e Información Base
```

* **¿Por qué este diseño?** Delegar la gestión criptográfica de las contraseñas a Supabase Auth garantiza cumplimiento de estándares de seguridad industrial, mientras que replicar el UID en la tabla `perfiles` permite que el motor relacional ejecute cruces (JOINs) nativos a alta velocidad sin salir del entorno de la base de datos.

### B. Ciclo de Vida de Viaje y Mensajería (Híbrido)
1.  **Solicitud:** El pasajero envía coordenadas geográficas (`origen`, `destino`) generando un registro en `public.viajes` con estado `'solicitado'`.
2.  **Aceptación:** Cuando un conductor acepta el viaje, el backend procesa el cambio de estado a `'aceptado'`. En la misma transacción controlada por el backend, se invoca la creación de un nuevo registro en `public.threads` inyectando el correspondiente `viaje_id`.
3.  **Inyección de Miembros:** Inmediatamente, se insertan dos filas en `public.thread_members`: una para el `pasajero_id` y otra para el `conductor_id`, abriendo el canal exclusivo protegido por las RLS.

### C. Sistema de Geolocalización y Chat (WebSockets vía Socket.io)
El módulo en tiempo real implementa un patrón de **Salas (Rooms)** virtuales optimizadas:

* **Salas de Geocercas (`sector:${sectorId}`):** Las tricimotos emiten el evento `update_location` hacia el backend enviando sus coordenadas en formato ligero. El servidor redirige inmediatamente este payload únicamente a los pasajeros suscritos al canal del sector correspondiente en Crucita (ej. `sector:playa`, `sector:centro`), reduciendo drásticamente el consumo de datos de red de los dispositivos en territorio.
* **Salas de Conversación (`chat:${threadId}`):** Al abrir la vista de chat, las apps ejecutan un comando de Socket `join_chat`. Al enviar un mensaje, este se distribuye en milisegundos de forma bidireccional, manteniendo sincronizadas las burbujas de chat del frontend sin necesidad de realizar peticiones HTTP de tipo *polling* repetitivas.

---

## 4. Optimizaciones de Rendimiento Implementadas

Se aplicaron índices de tipo árbol B (`B-Tree`) en los campos que actúan como llaves foráneas frecuentes:
* `idx_messages_thread_id` en `public.messages(thread_id)`
* `idx_thread_members_thread_id` en `public.thread_members(thread_id)`
* `idx_thread_members_user_id` en `public.thread_members(user_id)`
* `idx_threads_viaje_id` en `public.threads(viaje_id)`

**Impacto Técnico:** Al escalar la aplicación y contar con miles de mensajes en el histórico, el motor de base de datos no tendrá que inspeccionar la tabla de mensajes completa fila por fila (operación de costo $O(N)$). Gracias a los índices, la búsqueda se ejecuta en un tiempo logarítmico óptimo ($O(\log N)$), manteniendo la experiencia de chat instantánea.
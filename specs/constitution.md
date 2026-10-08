# Constitución de CruciDrive

Reglas no negociables. Cambiarlas requiere editar este archivo y registrarlo en `REGISTRO_CAMBIOS.md`.

1. **Spec primero.** Ninguna funcionalidad se implementa sin `spec.md` aprobada. Si cambia el alcance, se edita la spec antes que el código.
2. **El servidor es la fuente de verdad** para tarifas, estados de viaje y permisos. El cliente nunca decide precios ni transiciones.
3. **Seguridad por defecto.** JWT en toda ruta REST y conexión de socket; RLS activo en todas las tablas; ningún secreto en el repo (`.env` fuera de git, `.env.example` siempre al día); rate limiting en endpoints críticos.
4. **LOPDP.** Consentimiento explícito y con fecha antes de recolectar cédula o GPS. El GPS histórico se asocia a un ID anónimo, nunca al nombre. Acceso a datos personales solo por rol.
5. **Presupuesto.** Máx. 15 MB de datos móviles por conductor y jornada. Infraestructura del piloto ≤ 25 USD/mes.
6. **UI de campo.** Botones grandes, contraste alto, modo ligero sin blur para teléfonos modestos. El estado "sin conexión" siempre es visible.
7. **Todo criterio de aceptación tiene una prueba** (unitaria, de integración o E2E). Sin prueba, el criterio no se considera cumplido.
8. **Stack fijo:** Expo/React Native + TypeScript (frontend), Node.js + Express + Socket.io (backend), Supabase (Postgres + PostGIS + Auth). No se añaden Docker, Kubernetes, Redis ni servicios nuevos sin una spec que lo justifique.
9. **Migraciones SQL versionadas** en `supabase/migrations` (convención de Supabase CLI). El esquema debe poder recrearse en una BD vacía con un comando. `backend/database.sql` queda obsoleto.
10. **Trazabilidad.** Cada tarea terminada deja una entrada en `REGISTRO_CAMBIOS.md` con commit y evidencia.

## Decisiones tomadas (8 oct 2026)
- D-02: **Mapa en Android con Google Maps** vía `react-native-maps` (ya integrado). Google indica que el uso móvil del Maps SDK for Android no tiene límite, pero exige API key restringida al paquete `com.crucidrive.app` y cuenta de facturación activa.
- D-03: **Solo tricimotos en el MVP.** Cobro por persona y en efectivo (precisado en D-08). Las motos y el cobro por viaje quedan fuera hasta después del piloto.
- D-04: **Conductores aprobados por un administrador** (cédula, placa, foto). Sin auto-registro por SMS.
- D-05: **El SOS abre una llamada al 911 (ECU 911)** y además registra la alerta con ubicación para el panel admin. La app no sustituye al 911.
- D-08 (8 oct 2026): **Tarifa = 0,50 USD × número de personas.** No hay precio fijo por ruta, sector ni distancia. El precio unitario vive en `zonas.precio_por_persona` y lo aplica un trigger de la BD al crear el viaje (el cliente no lo decide). Sin tope de capacidad por regla de negocio; 20 pasajeros es solo una barrera técnica anti-abuso. Los sectores (La Boca, Las Gilces, Los Arenales, Malecón de Crucita, La Loma) sirven para ubicar y despachar, no para fijar el precio; el usuario puede añadir una referencia de texto libre del destino. Para elegir negocios o lugares concretos se usará un **catálogo propio** (D-09), sin API de pago.
- D-06: **Backend con cliente Supabase por usuario** (JWT del usuario, RLS aplica). La clave de servicio solo en el servidor y solo para tareas del sistema.

- D-09 (8 oct 2026): **Selector de negocios sin costo.** Nada de Google Places (se cobra por búsqueda). Se carga una vez un catálogo de lugares de Crucita desde OpenStreetMap (Overpass API, licencia ODbL: atribuir "© OpenStreetMap") a una tabla `lugares` en Supabase; la búsqueda es local (`pg_trgm`), no consume datos del mapa y no tiene costo por uso. El admin puede añadir lugares que falten y, si no hay coincidencia, el usuario escribe una referencia en texto libre. El mapa sigue siendo Google Maps (D-02; el SDK móvil es gratuito). Se especifica en `003-despacho`.

## Decisiones abiertas
- D-10: **Protección contra contraseñas filtradas** de Supabase Auth (aviso del linter). Hoy requiere un plan de pago; se pospone para no gastar. Mitigación mientras tanto: revisar la longitud mínima de contraseña en Supabase Auth. Reevaluar antes del piloto.
- D-01: el backend es JavaScript (CommonJS). ¿Migrar a TypeScript o mantener JS con JSDoc? Se decide en `007-hardening`.
- D-07: aliado institucional (cooperativa de tricimotos o GAD de Crucita). Pendiente del paso 0.

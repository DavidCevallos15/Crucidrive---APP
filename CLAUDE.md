# CLAUDE.md — CruciDrive

App de despacho de tricimotos para la parroquia Crucita (Manabí, Ecuador). El pasajero pide un viaje por sector, el conductor más cercano lo acepta y un botón SOS llama al 911. Proyecto de David Cevallos.

Responde en español, directo y técnico, de colega a colega. Sin saludos ni cierres de relleno.

## Fuente de verdad

Lee en este orden antes de tocar código:

1. `specs/constitution.md`: reglas no negociables y decisiones tomadas (D-01 a D-07). **Si algo de este archivo choca con la constitución, gana la constitución.**
2. `specs/README.md`: los 8 pasos del MVP y su estado.
3. `specs/NNN-*/spec.md`, `plan.md` y `tasks.md` del paso en curso.

`PLAN.md`, `ARQUITECTURA.md`, `ESTRUCTURA.md`, `SKILLS.md`, `masterPrompt.md` y `BASE_DE_DATOS_Y_BACKEND.md` son anteriores a las specs y en parte están desactualizados. Por ejemplo, NativeWind no está instalado y `backend/database.sql` ya no describe la BD. Úsalos solo como contexto. `DESIGN.md` sigue vigente para la UI.

## Flujo obligatorio: desarrollo guiado por specs

1. **Sin spec aprobada no hay código.** Si piden una funcionalidad sin spec, redacta `specs/NNN-nombre/spec.md` y espera la aprobación de David.
2. `spec.md` explica qué y por qué: historias, criterios Dado/Cuando/Entonces y lo que queda fuera de alcance. No nombra tecnologías.
3. `plan.md` explica cómo: tablas, migraciones, endpoints, eventos de socket, y cada decisión con la alternativa descartada.
4. `tasks.md` lista tareas pequeñas, cada una con su prueba. Se tildan al cumplirse, nunca antes.
5. Implementa en commits pequeños y verifica contra los criterios de aceptación.
6. Agrega una entrada en `REGISTRO_CAMBIOS.md`, con la versión más reciente arriba.
7. Si cambia el alcance, edita primero la spec y después el código.

Las fechas y los criterios de cada paso están en `specs/README.md`. No adelantes trabajo de pasos futuros "de paso".

## Stack y estructura

| Parte | Tecnología | Dónde |
| --- | --- | --- |
| App móvil y PWA | Expo (React Native), Expo Router, TypeScript, Zustand, react-native-maps (Google Maps), socket.io-client | `frontend/` |
| API y tiempo real | Node.js, Express 5, Socket.io, JavaScript CommonJS (migrar a TS es la decisión abierta D-01) | `backend/` |
| Datos y auth | Supabase: Postgres 17, PostGIS, Auth, RLS | `supabase/` |
| Builds | EAS (`frontend/eas.json`; el perfil `preview` genera APK) | — |

No agregues dependencias, servicios ni infraestructura (Docker, Redis, Kubernetes, otro proveedor) sin una spec que lo justifique.

## Comandos

```bash
# Backend
cd backend && npm install
npm run dev                      # nodemon en :3000
npm test                         # jest; necesita SUPABASE_URL y SUPABASE_ANON_KEY (pueden ser ficticias)

# Frontend
cd frontend && npm install
npx expo start                   # Expo Go; en .env usa la IP LAN del PC, no localhost
npm test

# Base de datos: probar migraciones y RLS en un Postgres 16+ con PostGIS local
# (pasos en supabase/tests/README.md)

# Build Android de prueba
cd frontend && npx eas-cli build --profile preview --platform android
```

David trabaja en Windows (PowerShell o Git Bash) y en Fedora (bash). Si das comandos, que funcionen en Git Bash o en bash.

## Base de datos (Supabase)

- **El esquema solo cambia con migraciones nuevas** en `supabase/migrations/NNNN_nombre.sql`. Nunca edites una migración ya aplicada ni cambies tablas desde el panel.
- La integración de Supabase con GitHub aplica las migraciones al fusionar a `main`. Una migración rota rompe producción, así que **pruébala antes en local** con `supabase/tests/` y amplía `rls_001.sql` o crea un `rls_NNN.sql` para cada tabla o política nueva.
- RLS va activo en todas las tablas. Las políticas usan `(select auth.uid())`, nunca `auth.uid()` a secas. Las funciones auxiliares van en el schema `private`, como `security definer` y con `set search_path = ''`.
- Las columnas sensibles se protegen con permisos por columna (`grant update (col, ...)`): RLS no limita columnas.
- PostGIS vive en el schema `extensions`; usa `extensions.geography(point, 4326)`.
- Después de cada cambio de esquema, el linter de seguridad de Supabase (advisors) debe quedar **sin hallazgos**, igual que el 8 oct 2026.

## Reglas del backend

- **Cada operación de usuario usa `req.supabase` (REST) o `socket.supabase` (sockets)**: llevan el JWT del usuario y RLS aplica. El cliente `supabase` de `config/supabase.js` solo sirve para `auth.getUser`.
- `getAdminClient()` (service role) solo se usa para tareas del sistema, como el despacho del paso 003, y nunca para algo que el usuario puede hacer por sí mismo. La clave de servicio no sale del servidor.
- El servidor es la fuente de verdad para tarifas, estados de viaje y permisos. No confíes en valores calculados por el cliente.
- Valida toda entrada con `utils/validation.js` y `utils/geo.js` antes de tocar la BD; los patrones deben coincidir con los CHECK de las migraciones.
- `errorResponse` nunca envía detalles internos al cliente: van al log.
- Rate limit y CORS se configuran por `.env` (`RATE_LIMIT_*`, `ALLOWED_ORIGINS`, `TRUST_PROXY`). Los límites son holgados a propósito: las operadoras móviles comparten IP (CGNAT).

## Convenciones de código

- TypeScript estricto en el frontend. En el backend, JavaScript con JSDoc hasta que se resuelva D-01.
- Funciones cortas y modulares; `try/catch` o `asyncHandler` en toda operación asíncrona.
- Los comentarios y textos de UI van en español. Los identificadores siguen la convención que ya existe en el código: términos de dominio en español, iguales a la BD (`viaje`, `perfil`, `tricimoto`, `sector`), y términos técnicos genéricos en inglés. No renombres en masa.
- La UI es glassmorphism según `DESIGN.md`, con botones grandes y alto contraste para conductores. Debe existir un modo ligero sin blur para teléfonos modestos (constitución, regla 6).

## Pruebas

- Cada criterio de aceptación tiene un test. Sin test, el criterio no está cumplido.
- Backend: jest con clientes de Supabase simulados (`req.supabase`), en `backend/tests/`.
- BD: scripts SQL en `supabase/tests/`.
- El CI (`.github/workflows/ci.yml`) corre los tests de backend y frontend, más `npm audit --omit=dev`, en cada PR. No fusiones con el CI en rojo.
- Deuda conocida: `tsc --noEmit` en el frontend arrastra unos 210 errores previos (tipos de Jest y `baseUrl`). No agregues nuevos (tarea T18).

## Git

- Una rama por paso o tarea (`spec/NNN-nombre`, `fix/...`, `chore/...`) y un PR hacia `main`. Nunca hagas push directo a `main`.
- Commits en español con prefijo convencional (`feat(003): ...`, `fix(security): ...`). El cuerpo explica el porqué.
- No hagas commit de `.env`, claves ni `node_modules`.

## Seguridad y datos personales (LOPDP Ecuador)

- Pide consentimiento explícito, con fecha, antes de guardar cédula o GPS.
- El GPS histórico se asocia a un ID anónimo, nunca al nombre.
- El SOS abre el marcador con el 911 (ECU 911) y además registra la alerta. La app no sustituye al 911 y no debe sugerir lo contrario.

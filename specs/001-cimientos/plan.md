# 001 · Plan técnico

Spec: [spec.md](./spec.md) · Tareas: [tasks.md](./tasks.md)

## Decisiones

| # | Decisión | Alternativa descartada | Por qué |
| --- | --- | --- | --- |
| P1 | Migraciones en `supabase/migrations/` (formato Supabase CLI) | `backend/migrations` con script propio | Es el estándar de Supabase: `supabase db push` las aplica sin Docker y lleva el historial |
| P2 | Limpieza única en `supabase/one-off/` fuera de la cadena | Poner los `DROP` en la migración 0001 | Una BD nueva no debe ejecutar borrados; la limpieza es un hecho histórico de este proyecto |
| P3 | PostGIS en el schema `extensions` | Dejarlo en `public` | Quita del API REST `spatial_ref_sys` y las funciones `st_*` (hallazgos del linter) |
| P4 | Funciones auxiliares de RLS en schema `private` (`security definer`, `search_path=''`) | Subconsultas directas en cada política | Evita recursión entre políticas de `threads`/`thread_members` y no se exponen vía `/rpc` |
| P5 | `auth.uid()` siempre como `(select auth.uid())` | Llamada directa | Se evalúa una vez por consulta (aviso de rendimiento del linter) |
| P6 | Permisos de UPDATE por columna (`grant update (col, ...)`) | Solo RLS por fila | RLS no limita columnas: sin esto un pasajero podría cambiar `tarifa` o su `rol` |
| P7 | Tarifas: una fila por par con `sector_a < sector_b` + `obtener_tarifa(a, b)` | Dos filas por par | La simetría queda garantizada por construcción (criterio 3) |
| P8 | `updated_at` por trigger (`private.tocar_updated_at`) | Enviarlo desde el backend | El cliente no puede falsearlo y el código no repite la lógica |
| P9 | Backend: `req.supabase = createUserClient(jwt)`; cliente anon solo para `auth.getUser`; `getAdminClient()` perezoso y explícito | Un único cliente anon global | Con un cliente global RLS nunca ve al usuario (hallazgo de la auditoría) |
| P11 | Rate limit holgado y configurable (`RATE_LIMIT_API=600`, `RATE_LIMIT_AUTH=60` por IP cada 15 min) + `TRUST_PROXY` | 100/20 del PR #2 | Las operadoras móviles comparten IP pública (CGNAT): un límite bajo bloquearía a toda la parroquia a la vez |
| P12 | `errorResponse` nunca envía detalles internos al cliente; solo los registra | Enviar `details` | Los mensajes de Postgres revelan nombres de tablas, columnas y restricciones |
| P13 | Validación de entrada en `utils/validation.js`, alineada con los CHECK de la BD | Solo confiar en la BD | Falla antes, con mensajes claros, sin gastar una consulta; la BD sigue siendo la última barrera |
| P10 | `rls_auto_enable()` se conserva y se le quita EXECUTE a anon/authenticated | Borrarla | La usa el event trigger `ensure_rls` de Supabase (activa RLS en tablas nuevas) |

## Esquema resultante

| Tabla | Clave | Notas |
| --- | --- | --- |
| `zonas` | `id` text | Catálogo; lectura pública |
| `sectores` | `id` text | `centro geography(point)`, FK a zona; lectura pública |
| `tarifas` | `id` identity | Par ordenado único; lectura pública |
| `perfiles` | `id` = `auth.users.id` | `rol` no editable por el usuario; nadie se auto-asigna admin |
| `tricimotos` | `id` uuid | 1:1 con conductor; `placa` única en mayúsculas; índice GiST en `ubicacion_actual` |
| `viajes` | `id` uuid | `aceptado_en`, `finalizado_en`, `updated_at`; sectores de origen/destino |
| `threads` | `id` uuid | 1:1 con viaje (`viaje_id` único), `created_by` |
| `thread_members` | (`thread_id`, `user_id`) | Solo el creador añade participantes del viaje |
| `messages` | `id` uuid | Columna `content` (la que usa el código), 1 a 1000 caracteres |

## Políticas RLS (resumen)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `perfiles` | propio, quien comparte viaje, admin | propio con rol pasajero/conductor | propio (`nombre`, `telefono`) | propio |
| `tricimotos` | no inactivas, propia, admin | conductor, la propia | propia (`estado`, `ubicacion_actual`, `sector_id`) | — |
| `viajes` | participantes, conductores ven `solicitado`, admin | pasajero, en `solicitado` y sin conductor | participantes o conductor tomando uno libre (`estado`, `conductor_id`, `aceptado_en`, `finalizado_en`) | — |
| `threads` | creador o miembro | creador participante del viaje | — | creador |
| `thread_members` | propio o miembro del hilo | creador, solo participantes del viaje | — | — |
| `messages` | miembros | remitente = usuario y miembro | — | — |

## Riesgos conocidos (se cierran en pasos posteriores)
- Las transiciones de estado de `viajes` las valida el backend, no la BD. La aceptación atómica (solo un conductor gana) es una RPC del paso 003.
- Al crear un viaje, el cliente puede enviar `tarifa` (los permisos por columna solo protegen UPDATE). Hoy el backend la fija; en 005 la calculará el servidor con `obtener_tarifa` y se quitará del INSERT del cliente.
- `tricimotos` visibles para cualquier autenticado cuando no están inactivas: se revisará la exposición de ubicación en 007.
- El historial de Supabase registra las migraciones con la fecha en que se aplican por MCP. Si luego se usa `supabase db push`, hay que alinear versiones con `supabase migration repair`.

## Cómo recrear el esquema
```bash
# Con Supabase CLI (no requiere Docker para push)
npx supabase link --project-ref <ref>
npx supabase db push
```

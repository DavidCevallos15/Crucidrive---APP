# 001 · Cimientos y datos base

Estado: **aprobada por David el 8 oct 2026**

> **Enmienda 1 (8 oct 2026, D-08):** el cobro es 0,50 USD por persona, sin precio por ruta. Los criterios 2 y 3 (matriz de 10 tarifas y su simetría) quedan **reemplazados** por los criterios 6 y 7. Migración `0007_tarifa_por_persona.sql`.

## Por qué
Hoy el esquema vive en un solo `database.sql`, y sectores y tarifas están fijos en el frontend (`constants/sectors.ts`). Eso impide recrear la BD de forma reproducible, validar tarifas en el servidor y abrir otras parroquias sin tocar código.

## Historias
- Como desarrollador, quiero recrear la base de datos desde cero con un comando, para trabajar sin miedo a perder el esquema.
- Como sistema, quiero sectores y tarifas en la BD, para que el servidor calcule el precio y se puedan añadir zonas sin publicar la app.
- Como desarrollador, quiero que los tests corran solos en cada push, para detectar roturas temprano.

## Criterios de aceptación
1. **Dado** una BD Postgres vacía, **cuando** se ejecutan las migraciones, **entonces** existen todas las tablas actuales más `zonas`, `sectores` y `tarifas`, con RLS activo.
2. ~~**Dado** la semilla de Crucita, **cuando** se consulta `tarifas`, **entonces** devuelve los 10 pares de sectores con los mismos precios que hoy tiene `sectors.ts`.~~
3. ~~**Dado** que existe una tarifa A↔B, **cuando** se consulta B↔A, **entonces** se obtiene la misma tarifa (simetría resuelta en la consulta, no duplicando filas).~~
4. **Dado** un push a `main` o un PR, **cuando** corre la integración continua, **entonces** se ejecutan los tests del backend y del frontend y el resultado es visible.
5. **Dado** `.env.example` de backend y frontend, **cuando** un desarrollador nuevo lo copia y completa, **entonces** el proyecto arranca sin variables faltantes.
6. **(Enmienda 1)** **Dado** un viaje con N pasajeros, **cuando** se inserta, **entonces** `tarifa` = 0,50 × N aunque el cliente envíe otro valor, y no existen `tarifas` ni `obtener_tarifa`.
7. **(Enmienda 1)** **Dado** la semilla de Crucita, **cuando** se consulta `sectores`, **entonces** devuelve 6 sectores (incluido `la_boca`) y `zonas.precio_por_persona` = 0,50. Centro, La Boca y Las Gilces usan pines reales (migración 0008); Playa, Los Arenales y San Jacinto son provisionales hasta recibir su pin.

## Estado real de la BD (auditoría del 8 oct 2026)
Proyecto Supabase `Crucidrive - APP` (estaba pausado; reactivado el 8 oct). Todas las tablas tienen **0 filas**, así que el esquema puede reconstruirse sin perder datos.

| Hallazgo | Impacto |
| --- | --- |
| No existe la tabla `tricimotos` (sí está en `database.sql`) | `update_location` del socket falla siempre |
| `perfiles` y `viajes` tienen RLS activo **sin políticas** | Con la clave anon, el backend no puede leer ni escribir: registro y viajes fallan |
| El backend usa un único cliente con la **clave anon** y sin el JWT del usuario | RLS nunca ve `auth.uid()`; las políticas no pueden funcionar |
| `messages` tiene la columna `body`; el código inserta `content` | El chat falla al guardar mensajes |
| Nombres de políticas y columnas distintos a `database.sql`; 0 migraciones registradas | El repo no describe la BD real |
| PostGIS instalado en `public`: `spatial_ref_sys` sin RLS y funciones `st_estimatedextent` ejecutables por anon | Avisos de seguridad del linter |
| Función `public.rls_auto_enable()` SECURITY DEFINER ejecutable por anon | Cualquiera con la clave anon puede invocarla |
| Índice duplicado en `thread_members`; FKs sin índice en `viajes`; políticas con `auth.uid()` sin `(select ...)` | Rendimiento |

## Criterios añadidos tras la auditoría
6. **Dado** el repo, **cuando** se aplican las migraciones a una BD vacía, **entonces** el esquema resultante coincide con el que usa el código (tablas, columnas, políticas), incluida `tricimotos`.
7. **Dado** un usuario autenticado, **cuando** el backend opera en su nombre, **entonces** lo hace con un cliente que lleva su JWT, de modo que RLS aplica; la clave de servicio solo se usa en el servidor para tareas del sistema y nunca llega al cliente.
8. **Dado** el linter de seguridad de Supabase, **cuando** termina el paso 1, **entonces** no hay hallazgos de nivel ERROR y cada WARN restante está justificado por escrito en `plan.md`.

## Fuera de alcance
Registro de conductores (002), despacho (003), cualquier cambio de UI.

## Preguntas abiertas
- ¿Las coordenadas de los centros de sector actuales son definitivas o hay que medirlas en campo (paso 0)?
- ¿Polígonos PostGIS por sector ya en este paso o solo el punto central? Propuesta: punto central ahora, polígonos en 003.

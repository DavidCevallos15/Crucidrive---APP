# 020 · Plan de implementación

Una migración nueva (`0020_creditos_conductor.sql`), rutas REST de conductor y administrador, dos pantallas y la actualización de las páginas legales. Sin dependencias ni servicios nuevos (regla 8).

## Base de datos: `supabase/migrations/0020_creditos_conductor.sql`

### Tablas

**`public.parametros_cobro`**: una sola fila (`id boolean primary key default true check (id)`).
- `cobro_activo boolean not null default false`
- `comision_viaje numeric(5,2) not null default 0.10 check (>= 0)`
- `comision_encomienda numeric(5,2) not null default 0.20 check (>= 0)`
- `bono_bienvenida numeric(5,2) not null default 2.00 check (>= 0)`
- `recarga_min numeric(5,2) default 1.00`, `recarga_max numeric(5,2) default 50.00`
- Saldo mínimo = `greatest(comision_viaje, comision_encomienda)`; se calcula, no se guarda, para que no se desincronice.
- RLS: `select` para `authenticated` (el conductor ve las reglas); `update` solo admin, con `grant update (cobro_activo, comision_viaje, comision_encomienda, bono_bienvenida, recarga_min, recarga_max)`.
- *Descartado:* constantes en el código SQL o en `.env`, porque cambiar un monto exigiría una migración o un despliegue, y el criterio pide que lo cambie el administrador.

**`public.movimientos_credito`**: libro contable inmutable.
- `id uuid default gen_random_uuid()` (D-18: sin IDs incrementales), `conductor_id uuid not null references perfiles on delete cascade`
- `tipo text check in ('bono','recarga','comision','reintegro','ajuste')`
- `monto numeric(7,2) not null check (monto <> 0)`: positivo suma, negativo resta. `check` por tipo: `bono`, `recarga`, `reintegro` > 0; `comision` < 0; `ajuste` cualquiera.
- `viaje_id uuid references viajes on delete set null` (obligatorio en `comision` y `reintegro`)
- `canal text check in ('deuna','transferencia','deposito','efectivo','cortesia')` (obligatorio en `recarga`)
- `comprobante text check (comprobante ~ '^[A-Za-z0-9-]{3,40}$')`, `motivo text check (char_length between 3 and 200)`
- `check`: una recarga lleva comprobante, salvo `canal in ('efectivo','cortesia')`, que lleva motivo; un `ajuste` lleva motivo.
- `registrado_por uuid references perfiles on delete set null`, `creado_en timestamptz default now()`
- Índices únicos parciales (idempotencia):
  - `(viaje_id) where tipo = 'comision'`: una comisión por servicio.
  - `(viaje_id) where tipo = 'reintegro'`: una devolución por servicio (criterio 4).
  - `(canal, upper(comprobante)) where tipo = 'recarga' and comprobante is not null`: el mismo comprobante no se acredita dos veces (criterio 6).
  - `(conductor_id) where tipo = 'bono'`.
- Trigger `before update or delete` que lanza excepción siempre, también para `service_role`: el libro no se corrige editando, se corrige con un `ajuste`.
- RLS: `select` del propio conductor o admin. Sin políticas ni `grant` de `insert/update/delete` para `authenticated`: solo escriben las funciones `security definer`.

**`public.saldos_credito`**: `conductor_id uuid primary key`, `saldo numeric(7,2) not null default 0 check (saldo >= 0)`, `actualizado_en`.
- Lo mantiene un trigger `after insert` en `movimientos_credito`: primero `update … set saldo = saldo + new.monto` y, si no hay fila, `insert … on conflict do update`. No basta con `insert … on conflict`, porque Postgres evalúa el `check` sobre la fila propuesta (el monto negativo) antes de ver el conflicto. El `update` toma el bloqueo de la fila, así que dos aceptaciones simultáneas se serializan, y el `check (saldo >= 0)` impide el negativo (criterio 3).
- RLS: `select` propio o admin; sin escritura para `authenticated`.
- *Descartado:* calcular el saldo con `sum()` en cada consulta, porque obliga a bloquear todo el historial para evitar carreras al aceptar. *Descartado:* una columna `saldo` en `perfiles`, porque `perfiles` ya tiene permisos por columna para el usuario y mezclarla aumenta el riesgo de abrirla por error.

**`private.bonos_por_cedula`**: `cedula_hash text primary key` (SHA-256 de la cédula con la función `sha256` de Postgres, sin extensiones), `otorgado_en`. Sobrevive a la eliminación de la cuenta y no guarda la cédula en claro (LOPDP). Sin acceso desde la API.

### Funciones (`private`, `security definer`, `set search_path = ''`)

- `private.registrar_movimiento(...)`: el único punto de inserción en el libro.
- `private.saldo_minimo()` y `private.cobro_activo()`.
- **Bono (criterio 1):** trigger `after update of estado` en `conductores_verificacion`; al pasar a `aprobado`, si la cédula no está en `bonos_por_cedula` y el bono es mayor que 0, inserta el hash y el movimiento `bono`. `on conflict do nothing` en las dos tablas.
- **Comisión (criterios 3 y 9):** `private.aceptar_viaje` (0016) se reemplaza con la misma lógica más, tras marcar el viaje `aceptado`: si `cobro_activo`, `registrar_movimiento(tipo 'comision', -comision según viajes.tipo_servicio)`. Una violación del `check (saldo >= 0)` se traduce a `raise exception 'saldo_insuficiente'`, y la aceptación entera se revierte.
- **Devolución (criterios 4 y 5):** trigger `after update of estado` en `viajes`: cuando `old.estado = 'aceptado'`, `new.estado = 'cancelado'` y `new.cancelado_por = 'pasajero'`, si existe una comisión de ese viaje, inserta un `reintegro` por el mismo monto con `on conflict do nothing`. Va en un trigger y no dentro de `cancelar_viaje` para cubrir también la ruta heredada de cancelación.
- **Disponibilidad (criterio 2):** trigger `before update of estado` en `tricimotos`. Si `new.estado = 'disponible'`, el cobro está activo y el saldo es menor al mínimo:
  - si `old.estado = 'inactivo'` (el conductor se pone disponible): `raise exception 'saldo_insuficiente'`;
  - si viene de `ocupado` (terminó o canceló un servicio): fuerza `new.estado := 'inactivo'` sin error, para no romper `terminar_viaje` ni la cancelación.
  - Va en la BD porque `authenticated` tiene `grant update (estado)` en `tricimotos` y podría saltarse el backend.
- **Recarga y ajuste (criterio 6):** `public.acreditar_credito(p_conductor uuid, p_tipo text, p_monto numeric, p_canal text, p_comprobante text, p_motivo text)`, solo para `private.rol_actual() = 'admin'`. Valida rango de monto, que el destino sea un conductor y las reglas de comprobante y motivo; `registrado_por = auth.uid()`. Comprobante duplicado → `raise exception 'comprobante_repetido'`.
- **Resumen (criterio 10):** `public.resumen_creditos(p_desde date, p_hasta date)`, solo admin: totales por mes y tipo, y recargas por canal.
- **Datos existentes:** la migración da el bono a los conductores ya aprobados (con su cédula en `bonos_por_cedula`), para que nadie quede bloqueado cuando David active el cobro.

### Pruebas de BD: `supabase/tests/rls_009.sql`
Conductor A no lee movimientos ni saldo de B; nadie con `authenticated` inserta, edita ni borra en el libro; ni el admin edita un movimiento; bono único por cédula (re-aprobación y cuenta nueva); aceptación con y sin cobro activo; saldo insuficiente revierte la aceptación; devolución única al cancelar el pasajero; sin devolución al cancelar el conductor; `ocupado → disponible` con saldo bajo queda `inactivo`; comprobante repetido rechazado; no admin no llama `acreditar_credito` ni `resumen_creditos`. Concurrencia: `concurrencia_020.sh`, dos descuentos simultáneos sobre el mismo saldo; solo pasa uno. Dos aceptaciones del mismo conductor ya no pueden correr a la vez: la primera libera sus otras ofertas (0016) y la segunda recibe `oferta_no_vigente`. Después, advisors de Supabase sin hallazgos.

## Backend (`// @ts-check`, `req.supabase`)

| Ruta | Rol | Qué hace |
| --- | --- | --- |
| `GET /api/conductor/creditos` | conductor | saldo, mínimo, `cobro_activo` y últimos 50 movimientos (RLS) |
| `GET /api/admin/creditos/parametros` y `PATCH` | admin | leer y cambiar `parametros_cobro` |
| `POST /api/admin/conductores/:id/creditos` | admin | `rpc('acreditar_credito')`; `409` si el comprobante se repite |
| `GET /api/admin/conductores/:id/creditos` | admin | saldo e historial de un conductor |
| `GET /api/admin/creditos/resumen?desde&hasta` | admin | `rpc('resumen_creditos')` |

- Validación en `utils/validation.js` con los mismos patrones que los `check` (monto con 2 decimales en rango, canal en lista, comprobante, motivo).
- `viajeController` (aceptar) y `conductorController.cambiarDisponibilidad`: mapear `saldo_insuficiente` a `402` con `{ error: 'saldo_insuficiente', saldo, minimo }` y texto en español. *Descartado:* `400`, porque la app necesita distinguir este caso para abrir la pantalla de créditos.
- El despachador no cambia: un conductor sin saldo no puede estar `disponible`, así que no es candidato.
- Ninguna ruta usa `getAdminClient()`: acreditar es una acción del administrador con su propio JWT.

## Frontend

- **Conductor:** pantalla «Mis créditos» (`(driver)/creditos.tsx`) con saldo grande, aviso si está bajo el mínimo, historial con tipo, monto y fecha, y el bloque «Cómo recargar»: escribir a `soporte@tricimoto.app` o hablar con la administración. **Sin** enlaces de pago, QR ni datos bancarios en la app (criterio 7). Al recibir `402` al ponerse disponible o aceptar, mostrar el saldo y llevar a esta pantalla.
- **Admin:** en `(admin)/[id].tsx`, sección «Créditos» con saldo, historial y formulario (tipo recarga o ajuste, monto, canal, comprobante o motivo). Pantalla `(admin)/creditos.tsx` con el interruptor de cobro, los parámetros y el resumen mensual.
- Modo ligero sin blur y botones grandes, como el resto de la consola del conductor (regla 6).
- *Descartado:* mostrar en la app los datos de DeUna o de la cuenta bancaria. Aunque las comisiones son por un servicio de transporte, guiar a un pago fuera de la tienda desde la app es lo que más revisa Play; los datos de pago se dan por soporte o en persona.

## Páginas legales y textos
- `web/reembolsos.html`, `web/terminos.html` y `web/privacidad.html`: quitar Google Play Billing y Apple como forma de compra de créditos; describir recargas manuales por DeUna, transferencia, depósito o efectivo, verificadas por el administrador, y el reclamo con número de comprobante.
- `frontend/tests/cumplimientoLegal019.test.ts`: actualizar la expectativa que busca «Google Play Billing».

## Orden de entrega
1. **PR A (BD):** migración 0020 y `rls_009.sql`, probadas en el Postgres local. Se aplica en producción con autorización explícita de David, con `cobro_activo = false`.
2. **PR B (backend):** rutas, validación, mapeo de errores y pruebas jest.
3. **PR C (frontend y legales):** pantallas, textos legales y pruebas.
4. **Activación:** David revisa los saldos iniciales y activa el cobro desde el panel.

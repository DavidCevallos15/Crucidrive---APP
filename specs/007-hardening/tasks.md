# 007 · Tareas

Cada tarea se tilda cuando su prueba pasa, nunca antes. «C» es el criterio de la spec.

## PR 1 · Sockets de sector
- [x] **T1 · Config.** `SOCKET_CAMBIOS_SECTOR_MIN` y `MARCADOR_SECRETO`, validados al arrancar. *Prueba:* un valor inválido o un secreto de menos de 32 caracteres detiene el arranque.
- [x] **T2 · Marcador efímero** (`ubicacion/marcador.js`). *Prueba (C3):* el marcador es el mismo en un día, cambia al día siguiente, no contiene el UUID y es distinto para cada conductor.
- [x] **T3 · Catálogo de sectores en memoria** (`sockets/sectores.js`). *Prueba (C2):* un sector inexistente o inactivo se rechaza; la lectura se repite pasados 10 min.
- [x] **T4 · `join_sector` con una sola sala y tope por minuto.** *Prueba (C1):* unirse a B saca de A, y con el cambio 7 en un minuto el sector no cambia.
- [x] **T5 · `location_updated` sin datos personales.** *Prueba (C3 y C5):* el evento lleva marcador y coordenadas a 3 decimales, sin `conductorId` ni `nombre`, y `conductor_ubicacion` sigue exacta para el pasajero. Se ajustan `spec004` y `despachador`.
- [x] **T6 · Logs del socket sin nombre.** *Prueba (C6):* en conexión, unión y salida, la salida de `console.log` no contiene el nombre.
- [x] **T7 · App: tricimotos por marcador y caducidad a 60 s.** *Prueba (C4):* no hay duplicados por marcador, se poda a los 60 s y se vacía al cambiar de sector. `tsc` sin errores.

## PR 2 · Datos de la otra parte, cancelaciones, límites y cuentas
- [ ] **T8 · Migración 0018: teléfono por función y consentimientos por columnas.** *Prueba (C7 a C10, C15):* `rls_008.sql` cubre el teléfono por estado, el propio, el admin y un tercero; el nombre se sigue viendo tras el viaje; leer `id` de consentimientos se rechaza.
- [ ] **T9 · Lecturas del teléfono por función.** Cambian app, backend y smoke. *Prueba (C11 y C16):* los tests de `useViajePasajero`, `useViajeConductor`, `viajeController`, `adminController` y `conductorController` pasan con el teléfono por RPC.
- [ ] **T10 · Tope de cancelaciones.** *Prueba (C12 a C14):* con 5 cancelaciones en 60 min el pasajero recibe 429 con `Retry-After` y la hora, sin crear ofertas; las cancelaciones del conductor no cuentan; un valor inválido detiene el arranque.
- [ ] **T11 · Límites por usuario.** *Prueba (C17 y C18):* el pedido 11 en 15 min recibe 429 y otro usuario de la misma IP no se ve afectado; todo 429 lleva `Retry-After`.
- [ ] **T12 · No revelar cuentas.** *Prueba (C21 y C22):* un correo ya registrado y uno nuevo dan el mismo mensaje; el inicio de sesión fallido no distingue la causa.
- [ ] **T13 · Advisors de Supabase sin hallazgos** después de aplicar la 0018.

## PR 3 · Registro, contraseñas, tipos y D-01
- [ ] **T14 · Registro de acceso.** *Prueba (C19 y C20):* una petición con cuerpo `{ nombre, telefono }` y consulta `?lat=` deja una línea sin esos datos y con uid, ruta, estado, IP y user-agent. Se documenta journald a 14 días.
- [x] **T15 · Contraseñas de 10 con letras y números.** *Prueba (C23):* `validarPassword` rechaza `abcdefghij` y `1234567890` y acepta `abcde12345`. David aplica el cambio en el panel.
- [ ] **T16 · `tsc` en el CI del frontend (T18).** *Prueba (C24):* el CI corre `tsc --noEmit` y pasa.
- [ ] **T17 · `typecheck` del backend con JSDoc (D-01).** *Prueba (C27):* `npm run typecheck` pasa en el CI y la suite tiene 392 tests o más.

## PR 4 · Auditoría del APK
- [ ] **T18 · REA sobre el APK `preview`.** *Prueba (C25):* existe `auditoria-apk.md`, con los permisos justificados, los componentes exportados, la firma y la key de Maps.
- [ ] **T19 · Hallazgos altos corregidos o justificados.** *Prueba (C26):* ninguno queda abierto sin justificación escrita.

## David
- [x] **D1 ·** Supabase Auth: «Confirm email» activo; longitud mínima 10 con letras y dígitos.
- [ ] **D2 ·** Google Cloud: key de Maps restringida a `com.crucidrive.app` y al SHA-1 de EAS.
- [ ] **D3 ·** Prueba de campo del 004 T17 después del PR 1.

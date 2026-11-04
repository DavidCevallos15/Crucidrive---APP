# 007 · Endurecimiento antes del piloto

Estado: **Aprobada por David el 4 nov 2026**, con las propuestas de E1 a E6: solo el nombre tras el viaje; 5 cancelaciones en 60 min dejan 30 min sin pedir; registro de 14 días; contraseña de mínimo 10 con letras y números; JS con JSDoc; y 10, 10 y 30 por usuario cada 15 min. Ver `plan.md` y `tasks.md`.

## Por qué
El 4 nov 2026 se revisó CruciDrive contra los principios del handbook de inDrive (D-18). Muchas prácticas ya se cumplen: IDs no secuenciales en los datos de usuario, tarifa fijada por el servidor, aceptación sin carrera, ofertas visibles solo para sus candidatos, ubicación del viaje solo para su pasajero, nadie se asigna admin, avisos sin datos personales y errores sin detalles internos. Eso no se rehace, y al cambiar algo cerca no se rompe (la suite del backend pasaba 392/392 el 4 nov).

Quedaron brechas. **La 1 bloquea las pruebas de campo**, porque esas pruebas exponen la ubicación de conductores reales. Este paso también recoge lo que ya estaba asignado al 007: D-01, T18, D-10, el registro de acceso y la auditoría del APK propio (D-20).

## Historias
- Como **conductor disponible**, quiero aparecer en el mapa para conseguir viajes, sin que nadie pueda saber quién soy ni seguirme a lo largo del día.
- Como **pasajero o conductor**, quiero que la otra persona del viaje tenga mi teléfono solo mientras el viaje está activo.
- Como **conductor**, no quiero recibir pedidos que el mismo pasajero pide y cancela en bucle.
- Como **operador del piloto**, quiero detectar el abuso con un registro de acceso que no guarde datos personales.
- Como **dueño del producto**, quiero saber qué permisos y componentes expone el APK antes de publicarlo.

## Criterios de aceptación

### Brecha 1 (alta) · Mapa en vivo de conductores
Hoy cualquier cuenta con sesión puede unirse a todas las salas de sector a la vez. Cada 5 s recibe, de cada conductor disponible, su identificador, su **nombre real** y sus **coordenadas exactas**.

1. **Dado** una conexión de cualquier rol, **cuando** pide unirse a un sector, **entonces** queda en **una sola** sala de sector y sale de la anterior. Si cambia de sector más veces de las permitidas por minuto (parámetro del servidor), los cambios de más se ignoran.
2. **Dado** un sector que no existe en el catálogo de sectores, **cuando** se pide unirse a él, **entonces** se rechaza con un mensaje genérico y la conexión no se une a nada.
3. **Dado** un conductor disponible, **cuando** su ubicación se reparte a su sector, **entonces** el evento no lleva nombre ni identificador estable. Lleva un **marcador efímero** que cambia cada día y no permite deducir quién es el conductor ni relacionar un día con otro, más las coordenadas **redondeadas a 3 decimales** (~110 m).
4. **Dado** el mapa del pasajero, **cuando** recibe esas ubicaciones, **entonces** dibuja cada tricimoto por su marcador sin duplicarla. Si una deja de actualizarse durante 60 s (la ventana de D-13), desaparece del mapa. Hoy nunca se quitan.
5. **Dado** un conductor en un viaje, **cuando** envía su ubicación, **entonces** su pasajero la sigue recibiendo **exacta** y nadie más la recibe (criterios 13 y 14 del 004, sin cambios).
6. **Dado** el registro del servidor, **cuando** una conexión entra, se une a un sector o sale, **entonces** no aparece el nombre de la persona. Hoy aparece.

### Brecha 2 (media) · Datos de la otra parte del viaje
Hoy el pasajero y el conductor pueden leer **para siempre** el nombre y el teléfono del otro, con cualquier viaje que hayan compartido, incluso si se canceló.

7. **Dado** un viaje en estado aceptado o en curso, **cuando** una de las partes pide el teléfono de la otra, **entonces** lo recibe.
8. **Dado** un viaje finalizado, cancelado o sin conductor, **cuando** una de las partes pide el teléfono de la otra por cualquier vía, **entonces** no lo recibe.
9. **Dado** dos personas que compartieron un viaje que llegó a ser aceptado, **cuando** una consulta a la otra, **entonces** ve solo lo que define E1. Ese dato es el mínimo que necesitan el chat en solo lectura y las reseñas.
10. **Dado** el administrador o el propio usuario, **cuando** consultan el perfil, **entonces** siguen viendo lo que ven hoy.
11. **Dado** las pantallas que hoy muestran a la otra parte (viaje activo del pasajero y del conductor, chat y panel del administrador), **cuando** se aplica este cambio, **entonces** siguen funcionando. Cada una tiene su prueba.

### Brecha 3 (media) · Pedir y cancelar en bucle
Hoy cada pedido dispara ofertas y avisos a 3 o más conductores, y nada impide pedir y cancelar en bucle.

12. **Dado** un pasajero que llegó al tope de cancelaciones en la ventana (E2), **cuando** intenta pedir, **entonces** se rechaza con la hora a la que puede volver a pedir, y no se crean ofertas ni avisos.
13. **Dado** un valor inválido en esa configuración, **cuando** arranca el servidor, **entonces** no arranca y dice qué valor falla (igual que la sanción del 005).
14. **Dado** un pasajero bloqueado, **cuando** abre la pantalla de pedir, **entonces** ve hasta cuándo dura el bloqueo, con la hora que da el servidor.

### Brecha 4 (baja) · Consentimientos con número secuencial
Hoy cada usuario lee el número interno de su consentimiento. Comparando números entre cuentas se puede medir cuánto crece la app.

15. **Dado** un usuario, **cuando** lee sus consentimientos, **entonces** recibe la versión y la fecha, y la lectura del número interno se rechaza (prueba de RLS).
16. **Dado** un conductor con el consentimiento vigente, **cuando** se pone disponible, **entonces** funciona igual que hoy.

### Brecha 5 (baja) · Límites por usuario
Hoy pedir, cancelar y aceptar solo tienen límite por IP, y ese límite es holgado por el CGNAT.

17. **Dado** un usuario con sesión, **cuando** supera el límite por usuario de pedir, cancelar o aceptar (E6), **entonces** recibe 429. Otro usuario detrás de la misma IP no se ve afectado.
18. **Dado** cualquier respuesta 429 (por IP, por usuario o de ubicación), **cuando** se envía, **entonces** lleva `Retry-After` y un mensaje sin detalles internos.

### Registro de acceso
19. **Dado** una petición a la API, **cuando** termina, **entonces** queda una línea con fecha, usuario (o «anónimo»), método, ruta sin parámetros de consulta, estado, duración, IP y user-agent.
20. **Dado** ese registro, **cuando** se revisa, **entonces** no contiene el cuerpo de la petición, tokens, nombres, correos, teléfonos ni coordenadas. Se borra pasado el plazo de E3.

### No revelar quién tiene cuenta
21. **Dado** un registro con un correo que ya existe, **cuando** se envía, **entonces** la respuesta es la misma que con un correo nuevo («Si el correo es válido, te enviamos un enlace»). Hoy dice «Ese correo ya tiene una cuenta».
22. **Dado** un inicio de sesión fallido, **cuando** se responde, **entonces** el mensaje no distingue un correo inexistente de una contraseña incorrecta.

### Contraseñas (D-10)
23. **Dado** el registro, **cuando** se elige la contraseña, **entonces** la app y el servicio de autenticación aplican la regla de E4.

### Tipos del frontend (T18)
24. **Dado** el frontend con sus dependencias instaladas, **cuando** se revisan los tipos, **entonces** no hay errores. Hoy hay 0 en `main`; el único error local era una dependencia sin instalar. El CI revisa los tipos en cada PR para que no vuelvan.

### Auditoría del APK propio (D-20)
25. **Dado** el APK `preview` de CruciDrive, **cuando** se audita, **entonces** queda en `specs/007-hardening/auditoria-apk.md`: cada permiso y su justificación (incluida la ubicación en segundo plano, con el texto para la Play Store), los componentes exportados y si hacen falta, la firma, y la comprobación de que la key de Maps está restringida al paquete `com.crucidrive.app` y al SHA-1.
26. **Dado** un hallazgo alto en esa auditoría, **cuando** se cierra el paso, **entonces** está corregido o tiene una justificación escrita.

### Backend en JavaScript o TypeScript (D-01)
27. **Dado** la opción que elija David en E5, **cuando** se cierra el paso, **entonces** está aplicada y los 392 tests (o más) siguen pasando.

## Decisiones pendientes (David)
- **E1 · Qué queda visible de la otra parte cuando el viaje termina.**
  - a) Solo el nombre (propuesta). El chat en solo lectura y las reseñas lo necesitan.
  - b) Nada; en el historial se lee «Conductor» o «Pasajero».
- **E2 · Tope de cancelaciones.** Propuesta: **5 cancelaciones del pasajero en 60 min** dejan 30 min sin pedir. Cuentan las que hace mientras busca y después de aceptado. No cuentan las del conductor ni las que terminan «sin conductor».
- **E3 · Cuánto se guarda el registro de acceso.** Propuesta: 14 días, en el propio servidor.
- **E4 · Contraseñas (D-10).** La protección contra contraseñas filtradas pide un plan de pago de unos 25 USD/mes, que es todo el presupuesto del piloto (regla 5).
  - a) Seguir sin ella y subir el mínimo a 10 caracteres, con letras y números (propuesta).
  - b) Pagar el plan.
  - c) Dejar el mínimo de 8.
- **E5 · Backend en JavaScript o TypeScript (D-01).** Hoy son 47 archivos y unas 3 000 líneas.
  - a) **Seguir en JavaScript con JSDoc y revisión de tipos en el CI** (propuesta). Cuesta 1 a 2 días; no cambia cómo se arranca ni se despliega en la VM.
  - b) **Migrar a TypeScript.** Cuesta 4 a 6 días. Suma un paso de compilación, cambia el despliegue (el servicio ejecuta el código compilado) y los tests, y arriesga regresiones justo antes del piloto. Si se elige, mejor después del piloto.
- **E6 · Límites por usuario.** Propuesta por usuario y cada 15 min: pedir 10, cancelar 10 y aceptar 30.

## Evidencia (para el plan)
- **Brecha 1:**
  - `backend/src/sockets/socketHandler.js` (`join_sector` solo valida el formato del sector; L66, L81 y L204 registran el nombre).
  - `backend/src/ubicacion/servicio.js` L72 (`location_updated` con `conductorId`, `nombre` y coordenadas exactas).
  - `frontend/src/screens/MapScreen.tsx` L161 y `useLocationStore.removeNearbyDriver`, que nadie llama.
  - `backend/tests/spec004.test.js` y `despachador.test.js` validan hoy ese contenido.
- **Brecha 2:**
  - `supabase/migrations/0005_rls_politicas.sql` L25 a L31 (`private.comparte_viaje` sin filtro de estado) y L58 a L61 (`perfiles_select`).
  - Leen a la otra parte: `useViajePasajero.ts` L67, `useViajeConductor.ts` L48, `viajeController.js` L126, `chatController.js` L41 y `adminController.js`.
- **Brecha 3:** el 005 dejó fuera la sanción por cancelar. El patrón a seguir es `backend/src/viaje/sancion.js`.
- **Brecha 4:** `0010_identidad.sql` L6 (`identity`) y `conductorController.js` L128 (`.select('id')`).
- **Brecha 5:** `backend/src/app.js` L60 (solo por IP). El límite por usuario de `/ubicacion` en `conductorRoutes.js` L22 es el modelo.
- **Criterio 21:** `frontend/src/utils/mensajesAuth.ts` L13.
- **T18:** el `tsc --noEmit` local dio un solo error (`expo-updates` sin instalar). El CI (`.github/workflows/ci.yml`) no revisa tipos.

## Orden de entrega
1. Brecha 1 (desbloquea las pruebas de campo).
2. Brechas 2 a 5 y los criterios 21 y 22.
3. Registro de acceso, contraseñas, tipos en el CI y D-01.
4. Auditoría del APK.

## Fuera de alcance
Kafka, Kubernetes, Redis, geo-distribución y outbox (D-18, regla 8). Pruebas de penetración externas. Cambiar de proveedor de autenticación. Usar REA sobre apps de terceros (D-20). La sanción por terminar el viaje del 005 no cambia.

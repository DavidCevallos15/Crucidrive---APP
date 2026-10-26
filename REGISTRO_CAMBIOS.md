# Registro de Cambios - CruciDrive (Backend & Frontend)

## HISTORIAL DE LOGS:

## [1.76.0] - 2026-10-26 (Hora Local)

### 008 · Actualizaciones por aire para las pruebas (EAS Update, D-17)
- **Para qué:** que cada ajuste de una prueba de campo llegue al teléfono **sin generar un APK nuevo**. Solo cubre cambios de JavaScript e imágenes; lo nativo sigue necesitando APK.
- **Configuración:**
  - `expo-updates` (SDK 57), `runtimeVersion` por `appVersion` y `updates.url` con el identificador público del proyecto en `app.json`.
  - Canales `preview` y `production` en `eas.json`.
  - La descarga espera hasta 3 s al arrancar, para que el cambio se vea en la primera apertura con buena señal.
- **Regla de versión:** un APK solo acepta actualizaciones de su misma `version`. Si se toca código nativo, se sube la versión y se genera APK nuevo. Se descartó `fingerprint` porque se calcula en dos sistemas distintos (Windows y el servidor de EAS) y un desajuste fallaría sin avisar.
- **Variables:** las `EXPO_PUBLIC_*` se incrustan al publicar con `--environment preview`, así que cambiar la URL del backend o la zona de prueba tampoco exige APK nuevo. Corrige lo que se dijo antes en el chat.
- **Acerca de:** ahora muestra qué corre («Actualización a1b2c3d4 · fecha · canal preview» o «Código de la instalación»), para comprobar en el teléfono que el cambio llegó.
- **Guía:** `deploy/actualizaciones.md` (APK de base, publicar, comprobar, deshacer y cuándo sí hace falta un APK nuevo).
- **Spec y estado:** `specs/008-piloto/actualizaciones-por-aire.md` y D-17 en la constitución.
- **Lo que hace David:** **un último APK `preview`** con esta configuración (T4) y la prueba de punta a punta (T5).
- Pruebas: frontend 470/470 (4 nuevas del texto de la actualización); `tsc --noEmit` sin errores; `npx expo config` válido y `npm ci --dry-run` limpio. El lockfile solo suma los paquetes de `expo-updates` (el `npm` local quitaba además campos `libc` ajenos al cambio; se descartaron). **No se probó una actualización real en un teléfono.**

---

## [1.75.0] - 2026-10-26 (Hora Local)

### 005 · Pantallas del pasajero del viaje en curso (PR 4: T8 a T11)
- **Estados.** El pasajero ve «Tu tricimoto va en camino», «Tu tricimoto llegó», «Viaje en curso» y, en una encomienda, los textos con «paquete». Lo ve sin recargar: el aviso `viaje_estado` del conductor actualiza la hoja, y al reconectar se lee la BD (hora de llegada incluida).
- **Cancelar con motivo** mientras el viaje está aceptado («Ya no lo necesito», «Tarda demasiado», «Otro»). Si el conductor cancela, el pasajero lo ve y puede **volver a pedir** con un toque. Cancelar mientras busca conductor ahora usa `POST /cancelar`.
- **Terminar el viaje tú mismo** (en curso): una alerta advierte de la sanción y, al terminar, la app dice cuántas lleva y cuántas faltan para el bloqueo (números del servidor).
- **Hoja final.** Resumen del cobro (o «Precio acordado con el conductor»), «Llegué» / «No llegué» («Se entregó» / «No se entregó»), y estrellas con comentario opcional de hasta 280 caracteres. A los 30 minutos sin responder pasa a calificar. «Ahora no» y «Omitir» cierran sin responder; la hoja se ofrece **una sola vez más** al abrir la app (el teléfono guarda solo el id del viaje y un contador, nunca nombres ni ubicaciones).
- **Reseñas** («★ 4,8 · 23 reseñas» o «Nuevo») junto al nombre y la placa del conductor.
- **Sin conexión.** Cada botón espera la respuesta del servidor; si no responde, avisa y no avanza la pantalla. El estado «sin conexión» se ve siempre en el viaje.
- **Diseño.** Llamar, Chat y Cancelar o Terminar quedan en una fila fija de 56 px; el detalle se desplaza. Capturas en 360 × 640 en `docs/capturas/005-pasajero/`. El selector de motivo reutiliza la tarjeta oscura del conductor.
- **Pendiente:** retirar `PATCH /:id/estado` cuando no queden APK que lo usen; la prueba de campo T12 con dos teléfonos.
- Pruebas: frontend 466/466 (39 nuevas, con las acciones reales del hook); `tsc --noEmit` sin errores. No se tocó el backend ni la BD.

---

## [1.74.0] - 2026-10-21 (Hora Local)

### 008 · Backend de prueba en una VM de Azure (D-16)
- **Para qué:** probar en Crucita con datos móviles, sin Wi-Fi ni la PC de David, y sin pagar todavía. Una VM siempre encendida y con una sola instancia, porque el despacho guarda temporizadores y conexiones en memoria. Se pensó en una e2-micro de Google Cloud, pero David ya tenía su VM `crucidrive-api` en **Azure for Students**, y se usa esa.
- **Backend:**
  - `npm start` y `engines` (Node 22).
  - Cierre ordenado con SIGTERM (`src/apagado.js`): detiene el despacho, cierra los sockets y el servidor, y sale igual si algo tarda más de 10 s. Al volver, `recuperar()` retoma los viajes desde la BD.
- **`deploy/vm/`:**
  - servicio systemd con reinicio automático y endurecimiento básico;
  - Caddy con HTTPS automático, con `<IP>.sslip.io` o con la etiqueta DNS de Azure;
  - `api.env.ejemplo` sin valores;
  - `instalar.sh` para Ubuntu o Debian (rechaza otros sistemas); se puede volver a correr para actualizar;
  - guía de Azure con `az`: abrir los puertos 80 y 443, etiqueta DNS opcional, alerta de presupuesto y qué no hacer (detener la VM).
- **Costo:** al 26 oct, 0,94 USD en 6 días (IP pública 0,55, disco 0,39 y cómputo 0,00): unos 4 USD al mes.
- **Lo que hace David:**
  - abrir los puertos, correr el instalador y cargar las claves en `/etc/crucidrive/api.env`;
  - definir `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SOCKET_URL` y `EXPO_PUBLIC_ZONA_PRUEBA` en EAS `preview`, y generar el APK.
- **Spec y estado:** spec en `specs/008-piloto/backend-de-prueba.md`, con D-16 en la constitución. En `specs/README.md`, los estados del 004 y del 005 se pusieron al día y el 008 pasa a «en curso».
- Pruebas: backend 392/392 (4 nuevas del cierre ordenado). `bash -n instalar.sh` sin errores. **La instalación no se probó en una VM real.**

---

## [1.73.0] - 2026-10-21 (Hora Local)

### Cierre de sesión en Android y zona de prueba
- **Cerrar sesión ya no desmonta el mapa y el menú en el mismo instante en que monta otro mapa.** David seguía viendo que la app se colgaba o se cerraba al salir, en los tres roles. El #61 había quitado el bucle de redirecciones, pero solo se probó en web, y la causa más probable que queda es nativa: en un mismo commit se desmontaban el mapa, el menú y sus animaciones, y se montaba el mapa de `/explorar`. Ahora:
  - el menú se cierra antes de empezar la salida;
  - el layout privado cambia a una pantalla «Cerrando sesión…» sin mapa ni animaciones, con la sesión todavía válida;
  - solo cuando Auth confirma, la guardia lleva a `/explorar`;
  - si el cierre falla, esa pantalla muestra el error con «Reintentar» y «Volver a la app».

  **Hace falta confirmarlo en el teléfono con `adb logcat`.**
- **Otros bugs del cierre:**
  - Cerrar sesión desde «Completa tu perfil» dejaba al usuario en el formulario; ahora va al login.
  - Eliminar la cuenta esperaba sin límite a apagar el GPS y olvidar el teléfono; ahora espera como mucho 4 s.
  - Si la pantalla se desmontaba antes de que el GPS respondiera, la suscripción quedaba viva; ahora se cancela.
- **Zona de prueba (spec 012, criterio 8a).** El APK `preview` acepta una caja extra en `EXPO_PUBLIC_ZONA_PRUEBA` («sur,oeste,norte,este», máximo 2° por lado), para probar desde otra ciudad sin el aviso «fuera de Crucita». Si falta o está mal escrita se ignora. No va en producción.
- Pruebas: frontend 427/427, con 16 nuevas. `tsc` sin errores.

---

## [1.72.0] - 2026-10-20 (Hora Local)

### 002 · Salida sin bucles y pruebas de los tres roles
- Plan documentado en `535376e`, implementación en `adb43b4`, corrección solicitada tras un bloqueo real. Se reprodujo React #185: el guard raíz y el Redirect del layout privado competían por `/`, compartida con el mapa del pasajero. Solo el raíz navega ahora a `/explorar`; el layout privado no monta contenido sin sesión y el menú se cierra al cambiar la identidad.
- Revocación con espera máxima de 20 s, además de los 4 s de GPS/avisos; transporte Auth abortable a los 15 s. Listener síncrono con perfil diferido, cierre único compartido y error/reintento accesible. Un fallo conserva credenciales; no se anuncia una salida inexistente.
- Al salir o cambiar de cuenta se limpian viaje, hilo de chat, última referencia y conductores cercanos. Las lecturas tardías de viajes no restauran la cuenta anterior.
- Cabecera admin adaptable con acciones en segunda fila, ancho limitado en escritorio y carga/disabled; perfil y verificación comparten feedback de salida. El perfil no inventa «No disponible» si no recibió el estado operativo.
- Verificación web real: login/salida/recarga de pasajero, conductor y admin; ruta privada bloqueada después de salir; catálogo admin y búsqueda nombre+sector correctos. Ambos chats sin viaje activo; no se generaron solicitudes ni mensajes reales.
- **412 pruebas frontend, 388 backend**, TypeScript y export web correctos. Prueba con SDK real y almacenamiento simulado: error conserva sesión, reintento la elimina y reiniciar no la restaura. Android/Hermes exportado; teléfono pendiente por ausencia de dispositivo ADB. Capturas en `.impeccable/review/logout/`.
- Revisión independiente: capturas correctas; hallazgo P1 de respuestas tardías en mutaciones corregido y calificado **resolved, ship al P1 revisado**. Quince regresiones de acciones reales cubren solicitud, cancelación y pasos del conductor tras salir/cambiar/volver a la misma cuenta, incluidos finally y callbacks.
- Sin cambios de BD, dependencias nuevas ni credenciales guardadas. Detalle en `specs/002-identidad/cierre-sesion-campo.md`.
- Entrega: [PR #61](https://github.com/DavidCevallos15/Crucidrive---APP/pull/61), backend/frontend y Vercel en verde; Supabase Preview omitido. Abierto para revisión y fusión de David.

---

## [1.71.0] - 2026-10-20 (Hora Local)

### 003 · Usar nombres de lugares aunque no estén en el catálogo
- Petición de David, ya cubierta por D-09/criterio 20: aclaración y plan en `60807a3`; implementación en `f8e63a0`.
- El buscador ofrece **«Usar este nombre»** aunque esté cargando, falle o devuelva otras coincidencias. El usuario conserva y puede editar el nombre, elige el sector y lo ve como referencia en la ficha/solicitud. Sirve para recogida y destino de viajes/encomiendas y permite ambos puntos dentro del mismo sector.
- Usa la ubicación aproximada del sector: no inventa coordenadas del negocio ni añade el texto al catálogo público. JWT, RLS y precios del servidor conservan sus reglas.
- Corregida durante la revisión la referencia antigua al sustituir un punto: elegir otro origen/destino limpia su nota; solo elegir explícitamente un nombre libre la reasigna. Probado origen libre → La Boca → nombre libre nuevo, conservando destino y datos de encomienda; volver al buscador conserva el texto.
- **CORS de la captura:** se añadieron los orígenes exactos localhost/127.0.0.1:8082 al ejemplo/default y a la lista local ignorada por Git. OPTIONS real a la API LAN: **204**, `Access-Control-Allow-Origin: http://127.0.0.1:8082`. Una lista de producción explícita sigue sin autorizar orígenes locales ni ajenos; el GET continúa exigiendo JWT.
- Verificación: **388 frontend, 388 backend**, TypeScript y export web correctos. Revisión independiente: hallazgo resuelto, verdict **ship sobre la corrección y evidencia web**. Documentación del sistema mantenida.
- Capturas `.impeccable/review/referencia-libre/`; detalle en `specs/003-despacho/referencia-libre.md`. Sin Android físico ni envío real de solicitudes; no se generó otro APK en esta corrección. Sin migraciones ni dependencias nuevas; `.env` permanece fuera de Git.

---

## [1.70.0] - 2026-10-20 (Hora Local)

### 012 · Navegación y mapa, aprobados por David
- Spec y decisiones A/B registradas en `303e30b`; implementación en `d2b6e0a`. Buscar lugares por nombre y sector, ocultos mediante filtro; conductor fuera de Crucita recibe aviso sin bloqueo nuevo durante el piloto.
- Menú siempre a la izquierda, apertura desde un borde reservado y cierre por gesto, exterior, botón o Atrás. Spring 300 ms con reducción de movimiento; ajustes conserva el gesto Atrás del sistema. «Mi cuenta» queda en el menú.
- Sector y SOS comparten cabecera fija en las hojas; el contenido se desplaza debajo. GPS exterior no se usa como origen del pasajero, que puede elegir lugar/sector; el mapa vuelve a Crucita. La zona es una aproximación documentada del piloto.
- Lugares admin inicia en visibles y combina nombre, sector y visibilidad en el servidor antes del límite de 200; carga/reintento conservan filtros sin presentar resultados viejos como actuales.
- **Verdad del SOS:** conserva la pulsación de 2 s para abrir el marcador 911. Registro de alertas D-05 aún pendiente del 006; se corrigió la descripción accesible para no prometerlo.
- Revisión independiente **ship al alcance código y capturas web**. Evidencia en `.impeccable/review/campo012/`; sistema y guía actualizados. Android físico, estados activos y sesión admin siguen pendientes.

### Correcciones operativas del registro compartido
- `9273e79`: nodemon vigila solo `src`, para que la cobertura no provoque reinicios continuos. Reiniciar una vez el proceso de desarrollo para cargar la configuración.
- `TRUST_PROXY` conserva modo directo con vacío/false/0; admite proxy explícito y rechaza valores inválidos en vez de convertirlos en un salto confiable. La cabecera por sí sola no habilita confianza; `.env` local no se modifica. La topología real debe verificarse si el aviso persiste.
- Pruebas: **381 frontend, 386 backend**, TypeScript sin errores; exportaciones Expo web y Android/Hermes correctas. Sin dependencias ni migraciones nuevas.

### APK solicitado y prueba de campo pendiente
- EAS preview Android **FINISHED**, build `f9ece896-1611-4e6a-8d86-987dcf00ca72`, desde main `360395c` con PR #58. Es anterior a 012; descarga entregada en el chat.
- Se encontró LDPlayer abierto, pero su ADB no muestra dispositivos y localhost:5555 rechaza conexión. Se envió GPS Crucita por consola del fabricante, sin poder confirmarlo en Android. No se canceló el viaje remoto ni se afirmó haber probado chat/logout físicos.
- Procedimiento y límites: `docs/validacion-campo-012.md`. T3, T7 y validación de campo siguen abiertos.

---

## [1.69.0] - 2026-10-21 (Hora Local)

### Correcciones de la prueba en emulador y teléfono (APK del 011)
- **Cerrar sesión ya no se queda en «Cerrando sesión…».** Antes de revocar la sesión se apaga el GPS y se olvida el teléfono para avisos, y esa limpieza esperaba sin límite:
  - en un emulador sin Google Play, pedir el token de avisos no responde nunca, y «olvidar» quedaba en cola detrás para siempre;
  - en Android `fetch` no tiene límite de tiempo, así que con un backend que no responde la petición quedaba colgada.

  Ahora la limpieza espera como mucho 4 s, la cola de avisos avanza a los 15 s y `authFetch` cancela a los 15 s y falla como «sin conexión».
- **Chat:**
  - el teclado ya no tapa el campo de escribir;
  - sin conexión no se envía ni se borra lo escrito, y se avisa;
  - los errores del servidor (por ejemplo, el chat cerrado) se muestran;
  - la cabecera dice «Sin conexión» cuando corresponde.
- **Íconos que no se veían:** «Abrir chat», «Lugares» del administrador y «Usar mi ubicación» eran blancos sobre botón claro.
- **El error de un campo** («Escribe tu contraseña») pasa de 12 a 14 px y en negrita. En web ya aparecía, pero en el teléfono pasaba desapercibido.
- **Mapa:** se ven los lugares de Google (restaurantes, tiendas), como pidió David. Solo se oculta el transporte público.
- **Spec 012 en borrador:** menú a la izquierda con deslizamiento, «Mi cuenta» dentro del menú, SOS y sector dentro de la hoja, y aviso fuera de la zona de Crucita. Espera la aprobación de David.
- **Lo que no era un bug del código:**
  - El APK probado salió de la rama del #56 (`f3c4df7`), antes del #55. Por eso el conductor no tenía la tarjeta del viaje ni «Cancelar viaje» y su chat decía «Sin chat activo».
  - El viaje de prueba del 20 oct (17:45) seguía «aceptado» en la BD. Por eso el pasajero veía «va en camino».
  - Los «hola» del pasajero sí se guardaron (4 mensajes); el conductor no los vio porque ese APK no recupera el chat.
  - La tricimoto en Madrid era la ubicación del emulador.
- Pruebas: frontend 365/365 (7 nuevas; las del cuelgue fallan sin el cambio). `tsc` sin errores.

---

## [1.68.0] - 2026-10-20 (Hora Local)

### 011 · Diseño costero y bienvenida (PR #56, integrado sobre el 005)
- **Por qué se renumeró:** el trabajo empezó como «010», pero `main` ya tenía `010-ajustes-de-campo`; pasa a **011** (`specs/011-diseno-motion/`). Los commits originales conservan el número viejo en su mensaje.
- **Paleta de David:** crema `#FEE8C1` (Silk Mango), vino `#7F1139` (Neon Candy) y azul `#88AEE0` (Wild Navy), con papel `#FFFCF7` y tinta `#291B25`. La app pasa a un tema claro.
  - Los nombres viejos (`darkBg`, `glass*`, `primaryLight`, `secondary`) se mantienen como alias para no renombrar en masa, pero **ahora apuntan a colores claros**: `darkBg` es papel y `secondary` es crema. No hay modo oscuro automático.
  - Adaptados: componentes base, mapa, acceso, menú, ajustes, chat, botón SOS e iconos de instalación.
- **Marca:** logo adaptado y una tricimoto propia para la interfaz y los marcadores del mapa. Los recursos, con procedencia y prompts, están en `frontend/assets/premium/`.
- **Bienvenida:** animación de 2,4 s solo la primera vez (logo, agua y espuma), con «Omitir» y sin sonido.
  - Con movimiento reducido se muestra una versión estática.
  - Si no se puede leer la preferencia guardada, se entra directo al mapa.
- **Accesibilidad:** respuesta táctil de 100/140 ms, foco visible en web y botón pequeño de 48 dp en Android (44 en iOS y web). El SOS conserva el progreso de la pulsación sostenida.
- **Dependencia nueva:** `react-native-svg`, compatible con Expo, para las curvas. No se agrega librería de animación.
- **Documentación:**
  - guía en `docs/sistema-diseno-crucidrive.md`;
  - catálogo en `/diseno` y reproducción manual de la bienvenida en `/bienvenida`;
  - tokens exportables con `frontend/scripts/export-design-tokens.mjs`.

### Integración con el 005 (pantallas del conductor, #55)
El #56 se armó sobre `bbb5e71`, antes de fusionar el #55, y los dos usaban la versión 1.67.0. Por eso GitHub no lo dejaba fusionar. Se integró `main` (`1aa864a`): el 005 queda como 1.67.0 y el 011 como 1.68.0.

La oferta y la tarjeta del viaje siguen oscuras y opacas (regla 6). Con los alias nuevos, cinco colores dejaron de leerse y se corrigieron:

| Dónde | Antes | Ahora |
| --- | --- | --- |
| Ícono de recogida en la oferta y en la tarjeta del viaje | vino sobre oscuro, 1,72:1 | azul `#88AEE0`, 7,75:1 |
| Estrellas y promedio de «Tus reseñas» | crema sobre blanco, 1,20:1 | vino, 10,29:1 |
| «Desliza para ver más» sobre las tarjetas oscuras | franja blanca | variante oscura, con el degradado del color de la tarjeta |
| Estado «En un viaje» en la consola | crema sobre blanco, 1,20:1 | marrón `secondaryLight`, 7,73:1 |
| Estrella de «Calificación» en el perfil del pasajero | crema sobre blanco | vino |

- Pruebas: `tests/contraste011.test.ts` (5) falla con los colores anteriores. Frontend 359/359, backend 363/363, `tsc` sin errores.
- Capturas en 360 × 640 en `docs/capturas/011-integracion-005/`: tarjeta del viaje, oferta y reseñas.
- `npm audit --omit=dev` del frontend: 32 alertas, las mismas que ya tiene `main` y que vienen de dependencias de Expo. El 011 no agrega ninguna. El CI solo audita el backend: 0 alertas.

### Evidencia del PR #56 (antes de integrar el #55)
- Frontend 335/335, backend 363/363, TypeScript sin errores y exportación web y Android (Hermes) correctas. Auditoría de dependencias del backend: 0 alertas.
- Ocho combinaciones de color pasan contraste AA. Cinco pruebas cubren la preferencia de bienvenida y los fallos de almacenamiento.
- Revisión visual web (390 × 844 y 1440 × 900): aprobada después de corregir dos hallazgos, la persistencia de la variante estática y el mínimo de 48 dp en Android. Capturas en `.impeccable/review/premium/`.
- **Pendiente en teléfono:** APK nuevo y prueba de movimiento reducido, tipografía ampliada, lector de pantalla, marcador nativo y fluidez en un teléfono modesto. Que el empaquetado funcione no demuestra esos resultados.

---

## [1.67.0] - 2026-10-20 (Hora Local)

### 005 · Viaje en curso: pantallas del conductor (PR 3)
- **BD:** la 0017 quedó aplicada en producción y revisada. Seguridad: solo D-10. Rendimiento: nada nuevo, salvo los índices recién creados, que aún no se usan. T1 y T5 cerradas.
- **Consola del conductor:** al aceptar aparece la tarjeta del viaje en lugar del aviso «Coordina por chat». Muestra:
  - recogida, destino y distancia a la recogida;
  - total y personas, o en una encomienda el contenido y quién recibe;
  - nombre del pasajero;
  - **Cómo llegar** (abre la app de mapas del teléfono con la recogida como destino, sin clave ni costo), **Llamar** y **Chat**.
- **El botón del paso:** «Llegué» → «Empezar viaje» (o «Paquete recogido») → «Llegamos» (o «Paquete entregado»).
  - Empezar y terminar piden confirmación.
  - Solo cambia de estado si el servidor responde bien; sin conexión queda deshabilitado y lo dice.
- **Cancelar viaje:** solo mientras está aceptado, con motivo («No encuentro al pasajero» u «Otro»).
- **Aviso al conductor:** si el pasajero cancela o termina, la tarjeta se cierra con un aviso y se vuelve a leer la disponibilidad. Si se perdió el aviso, la tarjeta se quita al reconectar.
- **Viaje en curso al abrir la app:** si la tricimoto está ocupada, el viaje se recupera de la BD.
- **Perfil del conductor:** «Tus reseñas», con promedio, número de reseñas y comentarios. Solo se ve la fecha, nunca quién calificó. La consola muestra «★ 4,7 · 3 reseñas» o «Nuevo» en lugar de «Rating: Sin datos».
- **360 × 640:** el paso, Cómo llegar, Llamar y Chat quedan fijos; el resto de la tarjeta se desplaza con «Desliza para ver más». Capturas en `docs/capturas/005-conductor/`.
- Pruebas: frontend 341/341, con 19 nuevas en `tests/viajeConductor.test.ts`. `tsc` sin errores.

---

## [1.66.0] - 2026-10-20 (Hora Local)

### 005 · Viaje en curso: BD y backend (PR 2)
- **Alcance:** el pasajero también puede terminar el viaje, solo en curso. Queda registrado y se le avisa; con 3 en 30 días no puede pedir durante 24 h. El conductor queda libre y recibe aviso. Ese viaje no se confirma ni se califica (spec, criterios 5b y 5c).
- **BD** (`0017_viaje_en_curso.sql`, **sin aplicar en producción**):
  - Funciones `marcar_llegada`, `iniciar_viaje`, `terminar_viaje`, `cancelar_viaje` (motivo obligatorio si ya hay conductor), `confirmar_llegada`, `punto_recogida`, `calificar_viaje`, `mis_resenas` y `resumen_conductor`.
  - Se quita el `update` directo de `estado`. La tabla `calificaciones` no tiene lectura directa, así el conductor no sabe quién lo calificó. El chat queda en solo lectura al terminar.
- **Backend:**
  - `POST /api/viajes/:id/llegada`, `/iniciar`, `/terminar`, `/cancelar`, `/confirmar` y `/calificar`, y `GET /api/conductores/resenas`. `PATCH /:id/estado` sigue, ahora sobre las mismas funciones.
  - Errores de la BD → 400, 403 o 409, sin detalles internos.
  - Avisos a la otra parte por socket (`viaje_estado`) y con la app cerrada, sin nombre ni teléfono.
  - Las reseñas (promedio y número) van en los datos del conductor que recibe el pasajero.
  - Sanción en `solicitarViaje`: 429 con «Podrás pedir de nuevo a las HH:MM». Parámetros `SANCION_*` en `.env.example`, validados al arrancar.
  - Escribir en el chat de un viaje terminado devuelve «El chat se cerró…».
- **Humo:** el conductor termina el viaje (no el pasajero, para no sancionarlo) y se prueban el chat cerrado y la calificación única.
- Pruebas:
  - `rls_007.sql`: 20 en verde. `rls_001` a `rls_006` siguen en verde.
  - Backend: 363/363. Incluye `tests/viaje005.test.js` (64 pruebas) y las del 001 y 003, reescritas a las funciones de la BD.
- **Antes de desplegar el backend hay que aplicar la 0017.** Sin ella, los endpoints nuevos responden 500.

---

## [1.65.0] - 2026-10-20 (Hora Local)

### Plan del 005 (viaje en curso) para revisión
- `specs/005-viaje/plan.md` y `tasks.md`.
- **BD (0017):**
  - Las transiciones del viaje pasan a funciones que validan quién y en qué orden (llegada, iniciar, terminar, cancelar con motivo, confirmar). Se quita el permiso de `update` directo sobre `estado`.
  - `punto_recogida` da las coordenadas solo al conductor asignado y solo durante el viaje.
  - Tabla `calificaciones` sin lectura directa, para que el conductor no pueda saber quién lo calificó (LOPDP), con funciones para calificar, ver las reseñas propias y ver el resumen.
  - El chat queda en solo lectura al terminar el viaje.
- **Backend:** endpoints por paso y avisos a la otra parte por socket y con la app cerrada, sin nombre ni teléfono.
- **App:** tarjeta del viaje activo del conductor con «Cómo llegar» (enlace de Google Maps, sin clave ni costo), estados para el pasajero y hoja final para confirmar y calificar.
- Entrega en 3 PRs: BD y backend; conductor; pasajero y calificaciones.
- `specs/README.md`: el 010 queda implementado; falta revisarlo en el APK.

---

## [1.64.0] - 2026-10-20 (Hora Local)

### 011 · Parte B: lista de ofertas sin quitar D-11 (D-15)
- **BD** (`0016_varias_ofertas.sql`): un conductor puede tener hasta 3 ofertas abiertas (parámetro `p_max_ofertas`). `crear_ofertas` bloquea la tricimoto antes de contar, para que dos solicitudes a la vez no superen el tope. Al aceptar, las demás ofertas del conductor quedan como **«liberada»**, un resultado nuevo, y no como «rechazada», para no ensuciar las métricas del piloto.
- **Backend:** `OFERTAS_MAX_POR_CONDUCTOR` (1 a 5, por defecto 3; con 1, como en el 003). Al aceptar, las solicitudes liberadas se retiran de la pantalla del conductor y pasan al siguiente candidato sin esperar a que venzan.
- **App:** la consola muestra las ofertas en una lista, primero la que vence antes, cada una con su cuenta atrás, Aceptar y Rechazar. Rechazar quita solo esa. La lista reutiliza `TarjetaOferta` y `HojaDesplazable` de la parte A.
- Pruebas:
  - `rls_006.sql`: 17 en verde; falla sin la 0016.
  - `rls_003`: el criterio 7 del 003 pasa a probarse con tope 1. `rls_001` a `rls_005` siguen en verde.
  - Backend 296/296 (6 nuevas): la de aceptar falla sin el cambio.
  - Frontend 322/322; `tsc` sin errores.
- **Orden de despliegue:** primero la 0016 en el SQL Editor y después el backend. El backend anterior sigue funcionando con la BD nueva; al revés no.
- **0016 aplicada en producción** (20 oct 2026, SQL Editor). Un primer intento falló porque el SQL llegó cortado (`unterminated dollar-quoted string`) y no aplicó nada: el editor lo ejecuta en una sola transacción. Verificado: índice viejo quitado, «liberada» en el check, funciones nuevas con bloqueo y permisos solo para `service_role`, y `aceptar_viaje` que libera. Linter de seguridad: solo D-10; rendimiento: sin hallazgos nuevos. Como en la 0014 y la 0015, no figura en `schema_migrations`.

---

## [1.63.0] - 2026-10-20 (Hora Local)

### 011 · Parte A: interfaz compacta
- Modo compacto por debajo de **880 px** de alto (`utils/compacto.ts`). Cubre 360 × 640, 360 × 800 (el teléfono de David) y 393 × 852; deja fuera 412 × 915. David aprobó subir el umbral desde 720.
- **Login** (criterio 1): sin bienvenida ni pie, marca compacta y espacios apretados. En 360 × 640 el contenido pasó de 929 px a 640 y el botón Entrar queda en y = 448; en 360 × 800, en y = 528.
- **Panel del mapa** (criterios 2 y 3): el panel de destino u origen deja al menos un 35 % del mapa, también con la barra de pestañas. `HojaDesplazable` avisa «Desliza para ver más» mientras queda contenido abajo; en la prueba del 20 oct, el buscador y los sectores pasaron desapercibidos.
- **Oferta del conductor** (criterio 4): pasa a `components/TarjetaOferta.tsx`, que también usará la lista de la parte B. En el peor caso (textos largos, aviso abierto, sin conexión) cabe entera en 360 × 640, con Aceptar y Rechazar de 64 px.
- Capturas en 360 × 640, 360 × 800 y 412 × 915 en `docs/capturas/010-a/`, más el login de antes.
- Deuda encontrada: el modo ligero sin blur de la regla 6 no existe en el código. Se propone para `007-hardening`. Lo nuevo no usa blur.
- `specs/010-ajustes-de-campo/plan.md` y `tasks.md`: parte A hecha (T1 a T6); falta que David la revise en el APK (T7). La parte B empieza por completar su plan.
- Pruebas: frontend 321/321 (4 nuevas en `tests/compacto.test.ts`) y `tsc` sin errores en `src/` ni `app/`.

---

## [1.62.0] - 2026-10-20 (Hora Local)

### Specs 005 y 010 aprobadas; decisiones de David para el 005
- David fusionó el #49: las specs 005 y 010 quedan aprobadas y D-15 (lista de hasta 3 ofertas sin quitar D-11) entra en la constitución.
- Respuestas a las preguntas abiertas del 005:
  - **Calificaciones: sí.** El pasajero califica al conductor (1 a 5 estrellas y un comentario opcional); el conductor ve su promedio, sus reseñas y los comentarios, sin datos de quien los escribe (criterios 15 a 19).
  - **Motivos de cancelación: sí**, la lista propuesta.
  - **Llegada confirmada por las dos partes:** el conductor marca «Llegamos» o «Paquete entregado» y el pasajero confirma «Llegué» o «Se entregó» antes de calificar. Un «No llegué» queda para el administrador y, sin respuesta en 30 min, la llegada se da por confirmada (criterio 5a).
- Sin cambios de código.

---

## [1.61.0] - 2026-10-20 (Hora Local)

### Specs 005 y 010 en borrador, tras la prueba de las encomiendas
- David probó con dos teléfonos hasta las encomiendas: salieron bien y los avisos llegan rápido con la app cerrada.
- Pidió lo que falta del viaje: cancelar después de aceptar, seguimiento de la tricimoto y el lugar donde está el pasajero. Es el paso 005, que el 003 y el 004 dejaron fuera a propósito. `specs/005-viaje/spec.md`: recogida con «Cómo llegar», «Llegué», viaje en curso, cierre, cancelación con motivo y chat en solo lectura al terminar. Con 3 preguntas abiertas: calificaciones, motivos y «Llegué» manual o automático.
- El seguimiento en el mapa de Android depende de la clave de Google Maps (D-02); sin ella se ve la distancia, como hoy.
- Pidió que el diseño quepa en pantallas pequeñas y una lista de solicitudes para el conductor. Decidió compactar la interfaz (sin ajuste de tamaño) y la lista sin quitar D-11. `specs/010-ajustes-de-campo/spec.md`, con la medida del login: 929 px en una pantalla de 640 (versión web, 360 × 640) y D-15 propuesta (hasta 3 ofertas abiertas por conductor).
- El origen que solo mostraba «Usar mi ubicación (La Loma)» era el panel tapado por la barra de pestañas (corregido en el #48) y sin señal de que se podía desplazar: lo cubre el criterio 3 del 010.
- Sin cambios de código. Esperan la aprobación de David.

---

## [1.60.0] - 2026-10-20 (Hora Local)

### Prueba del APK del 009: el viaje funciona, pero la barra de pestañas tapaba cosas
- Prueba de David con 2 teléfonos (hora local 12:43 a 12:49; logs de Supabase en UTC). El flujo completo respondió bien:
  - 17:43:13 y 17:45:00: login de conductor y pasajero. A los 5 s, `registrar_dispositivo` 204 en cada uno (T8 confirmada también en el APK del 009).
  - 17:45:29: primer pedido sin conductor disponible, que se cerró como `sin_conductor` (el conductor aún no estaba disponible).
  - 17:45:51: segundo pedido. El backend leyó el token del conductor (`dispositivos_push`) para avisarle, y a los 10 s `aceptar_viaje` 200 y se leyó el token del pasajero para el aviso de aceptado. Tarifa 1,00 USD con 2 personas, `tipo_servicio = viaje`.
  - 17:48:32 y 17:48:33: los dos cerraron sesión. `olvidar_dispositivo` 200 en ambos y luego `logout` 204, por eso `dispositivos_push` quedó en 0.
- Sin pruebas todavía: una encomienda (0 filas en `encomiendas`) y la sesión migrada de SecureStore (en ambos teléfonos se inició sesión de nuevo).
- Se corrige lo que se ve en las capturas, antes de la 009 también:
  - La barra de pestañas mide 85 fijos y es `absolute`: con navegación de 3 botones de Android quedaban sus etiquetas debajo del sistema; además no reserva espacio y tapaba el botón «Abrir chat» de la hoja del viaje del pasajero y la caja de escribir del chat.
  - Ahora la barra crece lo que ocupa el sistema abajo, las hojas del mapa suben lo que mide la barra (solo con sesión; sin sesión no hay barra) y la caja del chat también.
- Código: `src/utils/barraPestanas.ts` (medidas, con prueba), `AppTabLayout`, `MapScreen` y `ChatScreen`. Frontend 317/317, `tsc` sin errores en `src/` ni `app/`. Sin revisión en el teléfono: el cambio es de diseño y hay que verlo en el APK.
- Backend de David: `[despacho] Recuperación: column viajes.tipo_servicio does not exist` salía de arrancar el código del 009 antes de aplicar la 0015; ya no sale. El `ValidationError: X-Forwarded-For` es de ngrok: en `backend/.env` falta `TRUST_PROXY=1`.

---

## [1.59.0] - 2026-10-20 (Hora Local)

### T8 cerrada: el APK registra el token de avisos
- Prueba de David con el APK `preview` recompilado con la anon key correcta. Logs de Supabase (UTC):
  - 05:50:52 `auth/v1/token?grant_type=password` 200 desde `okhttp/4.9.2` (login en el teléfono).
  - 05:50:56 `rpc/registrar_dispositivo` 204 desde el backend (`node`), vía ngrok. Para llegar ahí el teléfono tuvo que obtener permiso y token de Expo, lo que exige Firebase en el APK.
  - 05:51:31 `rpc/olvidar_dispositivo` 200 y luego `auth/v1/logout` 204: al cerrar sesión el token se borra antes del logout (criterio 11, ahora también en el teléfono real).
- `dispositivos_push` queda con 0 filas por ese cierre de sesión. Es lo esperado.
- El buscador (`rpc/buscar_lugares` 200) y la lectura de perfil y tricimoto también funcionan en el APK.
- Pendiente fuera de la T8: el `EXPO_ACCESS_TOKEN` del backend desplegado se configura con el despliegue del piloto (008). Hoy el único backend es el del PC de David, que ya lo tiene.
- Sin cambios de código. Siguiente paso: T17 (prueba de campo con dos teléfonos).

### 0015 aplicada en producción (009, T6)
- David la ejecutó completa desde el SQL Editor tras fusionar el #47; no se usó `apply_migration` (con la 0014 se cortó a los 60 s). Verificado en producción: `viajes.tipo_servicio` y su check de precio, tabla `encomiendas` con RLS y las políticas `encomiendas_select` e `encomiendas_insert`, los triggers `viajes_encomienda_completa` y `viajes_tipo_inmutable`, y las funciones con los permisos esperados. Los 14 viajes existentes siguen como `viaje`.
- Linter de seguridad: solo D-10. Rendimiento: sin hallazgos nuevos. La 0015 no figura en `supabase_migrations.schema_migrations`, igual que la 0014.
- Con esto el backend del 009 ya puede desplegarse. Siguen pendientes de la 009: Auth y Storage reales en la T9, la revisión formal (T1) y el teléfono (T12).

---

## [1.58.0] - 2026-10-20 (Hora Local)

### Identidad, seguridad, navegación y encomiendas · ampliación 009
- Alcance solicitado por David: identidad costera moderna y tecnológica; adaptar el mapa, menú y configuración del video a tricimotos y encomiendas. Precio de encomienda confirmado: acordado con el conductor; no se calcula con la tarifa de pasajeros (D-14). El importe negociado no se registra en esta versión.
- `specs/009-experiencia-encomiendas/` deja historias, criterios, plan y tareas con evidencia. La documentación se formalizó después de la implementación local: se registra la desviación de «spec primero» y se mantiene la revisión formal pendiente. No se declaran completos los pasos 005–008 ni se fusiona a main desde esta tarea.
- `702d66f` · Sesiones nativas protegidas mediante SecureStore, migración desde AsyncStorage, fragmentación y serialización; respuestas vinculadas a la sesión y logout comprobado. Caché PWA limitada a recursos públicos y API con no-store. Parches compatibles de Expo y corrección de tipos. El módulo nativo exige nueva compilación.
- `1eb7870` · Marca, logo, iconos de instalación y fondo costero propios; acceso adaptable y componentes compartidos accesibles. Procedencia y generación de recursos conservadas en `frontend/assets/brand/` y evidencia visual en `.impeccable/review/`.
- `ba1cc86` · Menú lateral, configuración, cuenta, permisos, privacidad, seguridad y ayuda. Dos servicios: Tricimoto y Encomienda. Solicitud de entrega con autorización y datos privados separados de las ofertas; eliminación de cuenta con contraseña, confirmación y bloqueo de servicios activos. Consentimiento 0.3 sigue como borrador. SOS abre el marcador al 911; el registro de alertas del paso 006 continúa pendiente.
- Migración nueva `0015_encomiendas.sql` y prueba `rls_005.sql`: tipo de servicio, tarifa NULL para encomiendas, datos privados bajo RLS, creación transaccional y eliminación restringida al backend tras reautenticación. Storage y base de datos no constituyen una única transacción global.

### Evidencia y límites
- Reejecución antes de subir: frontend **314/314**, backend **289/289**; **603 pruebas** en total. Auditoría actual de dependencias de producción del backend: **0 alertas**.
- TypeScript sin errores y exportaciones Expo web y Android completadas; la exportación Android es un bundle, no un APK. Revisión visual independiente «ship» para el alcance web responsive documentado.
- Pendientes antes de fusionar/publicar: revisión formal del PR, pruebas SQL/RLS 001–005 en base limpia y advisors, eliminación de una cuenta desechable en pruebas, revisión legal de privacidad, CI verde y validación de permisos/almacenamiento/notificaciones/marcador en teléfono. Docker Desktop apagado impidió validar SQL localmente. No se modificó la base remota ni se eliminó una cuenta real.
- Detalles reproducibles y límites en `docs/diseno-seguridad-2026-10.md` y `docs/navegacion-encomiendas-2026-10.md`. Video de referencia, credenciales, builds y cobertura local excluidos del commit.

### Revisión del PR
- Corrección: el aviso push de una oferta de encomienda decía «Nuevo viaje · $0.00» y «1 persona», porque `avisos/mensajes.js` formateaba la tarifa NULL como cero. Contradecía el criterio 4 y D-14 justo en el canal que usa el conductor con la app cerrada. Ahora dice «Nueva encomienda · Precio a convenir» y «Encomienda». Prueba nueva en `backend/tests/avisos.test.js`, que falla con el código anterior (backend 290/290).
- SQL validado sin Docker (Postgres 16 + PostGIS 3): las 15 migraciones aplican en bases limpias y `rls_001` a `rls_005` quedan en verde. `rls_005` amplía con 5 intentos bloqueados y el borrado de cuentas con historial (T6 y parte SQL de T9). Faltan los advisors del proyecto real.

---

## [1.57.0] - 2026-10-20 (Hora Local)

### Causa encontrada: el APK no llegaba a Supabase
- En el bundle del APK `524b8707`, la anon key compilada era `eyJhbGci` seguida de 200 puntos `•` (U+2022). Era la clave **enmascarada**, tal como la muestra el panel de Supabase antes de pulsar "Reveal", copiada en la variable de EAS `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- OkHttp rechaza un header con caracteres no ASCII antes de enviarlo. Por eso el login y el buscador fallaban sin que ninguna petición llegara a Supabase.
- Expo Go funcionaba porque usa el `frontend/.env` local, con la clave correcta.
- Corrección del diagnóstico anterior (1.55.0): la anon key **no** estaba bien. En el log del build los puntos parecían el enmascarado normal de EAS.
- Arreglo de configuración (David): reemplazar el valor en EAS por la clave real y recompilar.

### Endurecimiento
- `variablesFaltantes` ahora también marca como mal configurado un valor con caracteres que no pueden ir en una URL o en un header (puntos `•`, espacios, saltos de línea, comillas tipográficas). La pantalla "Falta configurar esta versión de la app" lo nombra en vez de fallar en silencio.

### Pruebas
- 2 pruebas nuevas en `tests/configuracion.test.ts`, que fallan con el código anterior. Frontend 281/281. El bundle de Android compila.

---

## [1.56.0] - 2026-10-20 (Hora Local)

### Corrección: Expo Go se caía con una pantalla roja al abrir la app
- Síntoma (prueba A en Expo Go): `[runtime not ready]: Error: expo-notifications: Android Push notifications (remote notifications) functionality ... was removed from Expo Go with the release of SDK 53`.
- Causa: `avisos.ts`, `avisosFondo.ts` y `useRespuestaAvisos.ts` importaban `expo-notifications` de forma estática. En Expo Go (Android, SDK 53 o más) ese módulo lanza al **importarse**, aunque no se use. El APK no se veía afectado; la web ya tenía su propio arreglo (#40).
- Arreglo:
  - `src/servicios/notificaciones.ts` carga `expo-notifications` con `require` solo si hay avisos (fuera de la web y de Expo Go). Si no, devuelve `null` y la app sigue sin avisos.
  - Los tres archivos pasan por ahí. `avisosFondo.ts` solo conserva un `import type`, que se borra al compilar.
  - `src/utils/cargadorAvisos.ts` (puro): decide si hay avisos y carga el módulo una sola vez; si cargarlo falla, la app sigue sin avisos.
- Efecto: Expo Go sirve de nuevo para probar login, buscador y mapa. Los avisos remotos y la ubicación en segundo plano siguen necesitando el APK.

### Pruebas
- `tests/cargadorAvisos.test.ts`: 5 pruebas. La que revisa que ningún archivo importe `expo-notifications` de forma estática falla con el código anterior (señala `avisos.ts`). Frontend 279/279. Sin errores de tipos en `src/` ni `app/`. Los bundles de Android y web compilan.

---

## [1.55.0] - 2026-10-20 (Hora Local)

### Diagnóstico: el APK no llega a Supabase
- Síntoma (APK `524b8707`): el login dice "No se pudo completar la acción" y el buscador "No se pudo buscar. Revisa tu conexión". El mapa de Google sí carga.
- En los logs de Supabase **no hay ninguna petición del APK** (ni de este build ni de los anteriores). Las variables del build están bien: URL, anon key de 208 caracteres sin comillas, URL del backend y Firebase. El error ocurre en el teléfono, antes de llegar a la red de Supabase.
- La app ocultaba el error real. Ahora:
  - `useSupabaseAuth` registra con `console.warn` el error de Supabase Auth (nombre, estado y mensaje), visible con `adb logcat`.
  - El buscador de lugares registra el error real.
  - `src/utils/mensajesAuth.ts` (puro): un error de red ahora dice "No se pudo conectar con el servidor de cuentas" en vez de parecer un error de la cuenta.

### Pruebas
- `tests/mensajesAuth.test.ts`: 7 pruebas. Frontend 274/274.

---

## [1.54.0] - 2026-10-19 (Hora Local)

### Paso 004 · T16, prueba de humo ampliada (41/41 en verde)
`backend/scripts/smoke.js` y `smokeHelpers.js` comprueban de punta a punta contra Supabase y el backend reales los criterios del paso 004:
- Registro, reasignación a otra cuenta y borrado del token de avisos (`POST`/`DELETE /api/dispositivos`, criterio 11).
- Envío de la posición del conductor durante un viaje (`conductor_ubicacion` de 144 B por socket y `POST /api/conductores/ubicacion` con 204 por REST) que solo recibe el pasajero de ese viaje y deja de recibirse al finalizar (criterios 13, 14 y 15).
- Límite de 2 envíos REST cada 5 s por conductor (el tercero responde 429).
- Proyección de consumo en una jornada de 10 h en segundo plano (criterio 18): **0,71 MB** por socket con avisos y pings (referencia si todo fuera por REST: **13,63 MB**, también por debajo del tope de 15 MB).
- Pruebas unitarias en `backend/tests/smokeHelpers.test.js` (backend 278/278 en verde) y corrida real `PRUEBA DE HUMO: TODO OK`.

---

## [1.53.0] - 2026-10-19 (Hora Local)

### Corrección: el inicio de sesión desmontaba la pantalla y devolvía al mapa sin entrar ni mostrar error
En `app/_layout.tsx`, `<AppRaiz>` reemplazaba `<Slot />` por la pantalla de carga completa cada vez que `isLoading` pasaba a `true`. Como `signIn` y `signUp` activan `isLoading`, al pulsar «Entrar» se desmontaba todo el árbol de navegación (incluido `LoginScreen`):
- Si el inicio de sesión fallaba, el error se perdía al desmontarse `LoginScreen` y en Android `<Slot />` volvía a montarse en la ruta raíz `/` (`MapScreen`).
- Si el inicio de sesión tenía éxito pero `<Slot />` se remontaba en `/` (`segments = []`), la guardia solo redirigía desde `(auth)` o dentro de `(app)`, dejando al usuario en el mapa de visitante sin entrar a su consola.

Cambios:
- `src/utils/routing.ts` y `app/_layout.tsx`: `mostrarCargaInicial` solo espera a `isInitialized` y a las fuentes (sin `isLoading`, que ya muestra el botón de `LoginScreen`), y `destinoGuardia` redirige a la pantalla del rol también cuando una cuenta con sesión y perfil está en `/`.
- Pruebas: 3 pruebas nuevas en `tests/identidad.test.ts` (268/268 en verde, 100 % de cobertura en `routing.ts`, 0 errores de tipos en `src/` y `app/`).

---

## [1.52.0] - 2026-10-19 (Hora Local)

### Corrección: la versión web (PWA) se caía al abrir por los avisos del paso 004
`useRespuestaAvisos` llama a `Notifications.useLastNotificationResponse`, que en web lanza `UnavailabilityError` y derribaba el layout raíz (`<AppRaiz>`) antes de pintar nada. Los avisos push no existen en la PWA.
- Nuevo `src/hooks/useRespuestaAvisos.web.ts`: versión vacía que Metro usa solo en web. En Android sigue el original.
- Prueba: `tests/respuestaAvisosWeb.test.ts` (la versión web no importa `expo-notifications` ni lanza).

## [1.51.0] - 2026-10-09 (Hora Local)

### Corrección: el APK preview se cerraba al abrirse
Se juntaban tres causas:
1. **Las variables `EXPO_PUBLIC_*` no llegaban al APK.** El `.env` del frontend está en `.gitignore`, así que EAS no lo sube, y el log del build solo mostraba `GOOGLE_SERVICES_JSON`. Además `config.ts` leía las variables con `process.env[nombre]`, y Expo solo incrusta en el bundle los accesos literales (`process.env.EXPO_PUBLIC_...`). Con la URL vacía, `createClient('')` lanzaba "supabaseUrl is required." al importar y la app se cerraba.
2. **Sin clave de Google Maps para Android**, `react-native-maps` cierra la app al pintar el mapa, que es la pantalla inicial.
3. **El APK se compiló desde `9e546bb`**, 23 commits detrás de `main`: no llevaba nada del 004.

Cambios:
- `config.ts`: acceso literal a las 4 variables. Comprobado con un bundle de prueba: antes el valor no aparecía, ahora sí.
- `supabaseClient.ts` ya no lanza si falta la URL. El layout raíz muestra "Falta configurar esta versión de la app" con los **nombres** de las variables que faltan (nunca valores).
- `app.config.js`: con la variable de EAS `GOOGLE_MAPS_API_KEY` agrega la clave al manifiesto (plugin de `react-native-maps`). Sin ella, el mapa muestra "Mapa no disponible en esta versión" en vez de cerrar la app; en Expo Go se usa la clave de Expo Go.
- `eas.json`: `environment` por perfil (development, preview, production), para que cada build cargue las variables de su entorno en EAS.
- `.env.example`: cómo cargar las variables en EAS.

### Paso 004 · T8 (en curso)
- Registrado lo que hizo David y lo que falta, en `tasks.md`.

### Pruebas
- `tests/configuracion.test.ts`: 6 pruebas. La de acceso literal falla con el código anterior. Frontend 264/264. Sin errores de tipos en `src/` ni `app/`. Los bundles de Android y web compilan.

---

## [1.50.0] - 2026-10-09 (Hora Local)

### Paso 004 · T13, consentimiento 0.2 en la app y "Estuviste fuera del despacho"
- Consentimiento 0.2 (criterio 5):
  - Si ponerse disponible responde 428, la consola muestra `ConsentimientoVigenteScreen` con el texto 0.2 completo y la casilla de aceptación.
  - Al aceptar registra la versión con `POST /api/auth/consentimiento` y vuelve a pedir la disponibilidad.
  - **Así se cierra el pendiente de la T7**: un conductor con la 0.1 ya puede ponerse disponible desde la app.
- "Estuviste fuera del despacho" (criterio 20):
  - Cada envío correcto de ubicación se guarda en el teléfono.
  - Al abrir la app y al volver a primer plano, si sigue disponible y el último envío tiene más de 60 s, lo avisa con un botón a los ajustes de la app para quitar el ahorro de batería.
  - No se muestra si ya está el aviso de "solo con la app abierta".

### Paso 004 · T14, tipos
- 0 errores en `src/`, `app/` e `index.ts`. Los errores restantes son los tipos de Jest en `tests/` (T18).

### Pruebas
- 6 nuevas en `tests/avisos.test.ts`. Frontend 258/258. Los bundles de Android y web compilan.

---

## [1.49.0] - 2026-10-09 (Hora Local)

### Paso 004 · T12, el pasajero ve a su conductor
- `useConductorDelViaje` (lógica pura en `src/utils/conductorDelViaje.ts`):
  - Escucha `conductor_ubicacion`, que solo llega a la sala del pasajero.
  - Al abrir el viaje y al reconectar, lee la RPC `ubicacion_conductor_viaje` (criterio 17).
  - Si los datos pasan de 15 s, relee cada 30 s como respaldo.
  - Un evento atrasado no hace retroceder al conductor.
  - Al terminar el viaje, el marcador desaparece en ese momento (criterio 15).
- Mapa del pasajero: marcador propio del conductor, "Tu conductor está a 240 m" (en línea recta al punto de partida) y "Última posición hace X s" cuando los datos no son frescos.
- Los avisos de aceptado y sin conductor llevan al mapa al tocarlos, que ya sincroniza el viaje con la BD (T11, R23 del 003).

### Pruebas
- 13 nuevas en `tests/avisos.test.ts`. Frontend 252/252. Sin errores de tipos en `src/` ni `app/`.

---

## [1.48.0] - 2026-10-09 (Hora Local)

### Paso 004 · T11, aviso de oferta en la app
- `src/utils/avisoOferta.ts` (lógica pura): lee el `data` del aviso (objeto o texto JSON, según cómo lo entregue Expo), decide qué se muestra con la app abierta, valida la oferta leída de la BD y elige adónde lleva tocar el aviso.
- Con la app abierta (criterio 9): el aviso de oferta no se muestra si la consola está en pantalla y conectada, porque ya está el modal. Sin socket sí se muestra.
- Al tocar el aviso (criterio 7): la consola lee su oferta en `ofertas_viaje` con el viaje. Si ya no está pendiente, venció o el viaje no sigue solicitado, muestra "Esta oferta ya no está disponible".
- Retirada (criterio 8): `src/tareas/avisosFondo.ts` recibe el aviso de datos `oferta_retirada` y quita el aviso de la barra. También se quita al llegar la retirada por socket, al vencer, al aceptar y al rechazar.
- `useRespuestaAvisos` en el layout raíz navega solo cuando la cuenta está lista, para que la guardia de rutas no deshaga la navegación. Los avisos del pasajero llevan al mapa, que ya sincroniza el viaje (R23 del 003).

### Pruebas
- 21 nuevas en `tests/avisos.test.ts`. Frontend 239/239. Sin errores de tipos en `src/` ni `app/`. Los bundles de Android y web compilan.

### Pendiente
- Comprobar en el APK el aviso y su retirada (T17, con la T8).

---

## [1.47.0] - 2026-10-09 (Hora Local)

### Paso 004 · T15, migración 0014 en producción
- David aplicó `0014_avisos_y_privacidad.sql` desde el SQL Editor. El `apply_migration` del MCP se cortó dos veces a los 60 s sin dejar nada a medias.
- Verificado en producción:
  - `dispositivos_push` con RLS y una política de lectura propia. Sin escritura directa ni lectura anónima.
  - `registrar_dispositivo`, `olvidar_dispositivo` y `ubicacion_conductor_viaje` solo para `authenticated`. Las funciones de `private` son `security definer` con `search_path` vacío.
  - **`tricimotos.ubicacion_actual` ya no se lee por REST** (ni `authenticated` ni `anon`). El conductor la sigue actualizando.
- Linter de seguridad: solo D-10 (protección de contraseñas filtradas), igual que antes.
- Linter de rendimiento: el índice nuevo aún sin uso, más hallazgos previos al 004.
- Al ir por el SQL Editor, la 0014 no figura en el historial de migraciones del proyecto.

---

## [1.46.0] - 2026-10-09 (Hora Local)

### Paso 004 · T10, ubicación del conductor en segundo plano
- `src/tareas/ubicacionFondo.ts`: tarea de `expo-location` con servicio en primer plano y aviso permanente ("CruciDrive está usando tu ubicación"). Se define en `index.ts`, antes de Expo Router, para que exista si Android relanza la app sin interfaz.
- Frecuencia adaptativa (`src/utils/seguimiento.ts`, D-13): pide una posición cada `fondoMovSeg` y solo la envía si se movió más de 15 m o si pasaron `fondoQuietoSeg`. Las frecuencias llegan en la respuesta de disponibilidad; si no son válidas se usan las de por defecto.
- `src/servicios/canalUbicacion.ts`: un solo canal para la consola y la tarea. Usa el socket si está conectado y, si no, `POST /api/conductores/ubicacion` con el JWT guardado. Un 403 o la falta de sesión apagan el seguimiento.
- Arranque y parada (`useSeguimientoFondo`): sigue con `disponible` u `ocupado` y se detiene con `inactivo` y al cerrar sesión.
- `PermisoUbicacionScreen`: explicación propia antes del diálogo del sistema (qué, para qué, cuándo se detiene). Si el conductor no concede el permiso, la consola muestra "Solo recibirás ofertas con la app abierta" con un botón a los ajustes.
- Cambio en la consola: con la app abierta ahora también envía la ubicación cuando está **ocupado**, para que el pasajero vea a su conductor. La frecuencia la fija el servidor (`abiertaSeg`).
- `app.json`: `isAndroidForegroundServiceEnabled` y el texto del permiso "todo el tiempo".

### Pruebas
- 26 nuevas en `tests/avisos.test.ts`. Frontend 218/218. Sin errores de tipos en `src/` ni `app/`.

### Pendiente
- Revisión en el APK de los criterios 1, 3 y 4: necesita la T8 y va con la T17. En Expo Go no hay ubicación en segundo plano; la consola muestra el aviso de "solo con la app abierta".

---

## [1.45.0] - 2026-10-09 (Hora Local)

### Paso 004 · T9, avisos en la app
- Dependencias nuevas con `npx expo install` (las justifica el plan del 004): `expo-notifications` y `expo-task-manager` (esta la usa la T10). `npm audit --omit=dev` lista los mismos paquetes que antes.
- `app.config.js` extiende `app.json` (P21):
  - `android.googleServicesFile` sale de la variable de archivo `GOOGLE_SERVICES_JSON` de EAS o, en local, de `frontend/google-services.json` si existe. Sin ninguno, la app compila sin avisos.
  - Plugin `expo-notifications` con el ícono monocromo y el color de la marca.
  - `google-services.json` va en `.gitignore`.
- `src/servicios/avisos.ts`: canales de Android `ofertas` (importancia máxima) y `viaje`, y token de Expo. En la web y en Expo Go no hay token, y la app sigue igual.
- `src/servicios/registroAvisos.ts`: registro y borrado del token (criterio 11). Se registra al tener sesión con perfil y se borra al cerrar sesión, antes de invalidar el JWT. Las dos operaciones van en cola para que un inicio y un cierre seguidos no se crucen.

### Pruebas
- `tests/avisos.test.ts`: 12 pruebas con una API simulada. Frontend 192/192. `npx expo config --type public` sin errores, con y sin `google-services.json`.

### Pendiente
- Para que lleguen avisos al APK falta la T8 de David (Firebase y clave FCM V1 en EAS).

---

## [1.44.0] - 2026-10-09 (Hora Local)

### Paso 004 · T7, consentimiento 0.2
- Texto 0.2 en `consentimiento-lopdp.md`, `consent.js` y `consentimiento.ts`:
  - Ubicación del conductor en segundo plano mientras está disponible, con un aviso permanente en el teléfono.
  - Identificador del teléfono para avisos, que se borra al cerrar sesión.
  - Durante el viaje, el pasajero ve a su conductor y nadie más.
  - Expo y Google entregan los avisos, sin datos del pasajero.
  - **Corrección:** la 0.1 decía que se guardaba un historial de ubicaciones con un identificador anónimo. En realidad solo se guarda la última posición.
- `PATCH /api/conductores/disponibilidad` con `disponible: true` responde 428 si el conductor no aceptó la versión vigente. Dejar de estar disponible no lo exige.
- `POST /api/auth/consentimiento { consentimiento: true }` registra la versión que fija el servidor.
- `npm run smoke` acepta la 0.2 antes de probar la disponibilidad.

### Pruebas
- 6 nuevas en `spec004.test.js`. Las pruebas de disponibilidad del 003 incluyen la consulta de consentimiento. Backend 275/275 y frontend 180/180.

### Pendiente
- La pantalla de la app que pide la 0.2 es la T13. Hasta entonces, un conductor con la 0.1 recibe 428 al ponerse disponible desde la app.

---

## [1.43.0] - 2026-10-09 (Hora Local)

### Paso 004 · T6, el despacho envía avisos
- **Candidato (P5, enmienda de R6 del 003):** socket conectado **o** teléfono registrado para avisos. La ubicación de menos de 60 s la sigue exigiendo la BD.
  - Solo se consulta quién tiene teléfono cuando hay candidatos sin socket.
- Cada oferta sale por socket y por aviso (P6; la app descarta el aviso si está abierta).
- Avisos de retirada al vencer, al cancelar el pasajero o al perder la carrera; al pasajero, avisos de aceptado y de sin conductor.
- Los avisos se envían sin esperar el resultado. Si fallan, o falla la lectura de teléfonos, el despacho sigue por el socket (criterio 12).

### Pruebas
- 9 nuevas en `despachador.test.js`. Backend 269/269.

---

## [1.42.0] - 2026-10-09 (Hora Local)

### Paso 004 · T5, avisos de Expo en el backend
- `src/avisos/expo.js`: cliente de la API de Expo con `fetch`, sin SDK (regla 8).
  - Lotes de 100, límite de 5 s y sin reintentos.
  - `EXPO_ACCESS_TOKEN` opcional (seguridad reforzada).
  - Devuelve los tokens con `DeviceNotRegistered` para borrarlos.
- `src/avisos/mensajes.js`: oferta (personas, total, origen y destino, sin datos del pasajero; caduca con la oferta), retirada (aviso de datos, sin texto), aceptado y sin conductor.
- `src/avisos/index.js`: lee los tokens con la clave de servicio, envía sin que el despacho espere (criterio 12) y borra los tokens muertos (11).
- `POST /api/dispositivos` y `DELETE /api/dispositivos/:token`, con el JWT del usuario.
- `.env.example`: `EXPO_ACCESS_TOKEN` y `AVISOS_ACTIVOS`.

### Pruebas
- `tests/avisos.test.js`: 25 nuevas. Backend 260/260.

---

## [1.41.0] - 2026-10-09 (Hora Local)

### Paso 004 · T4, el pasajero ve a su conductor
- Con el conductor `ocupado`, cada envío de ubicación (socket o REST) va como `conductor_ubicacion { viajeId, lat, lng, en }` **solo** a la sala del pasajero de su viaje `aceptado` o `en_curso` (criterios 13 y 14).
- **Cambio de comportamiento (criterio 14):** la posición de un conductor ocupado ya no se reenvía a todo el sector, con su nombre, como pasaba desde el 001.
- `inactivo`: no se reenvía a nadie. Al terminar el viaje la tricimoto vuelve a `disponible` y el pasajero deja de recibirla (15).

### Pruebas
- 6 nuevas en `spec004.test.js`. Backend 235/235.
- `despachador.test.js` (R10 del 003) ahora usa un conductor disponible, porque el caso ocupado cambió por el criterio 14.

---

## [1.40.0] - 2026-10-09 (Hora Local)

### Paso 004 · T3, ubicación del conductor por socket y por REST
- `src/ubicacion/servicio.js`: un solo camino para guardar la última posición y reenviarla al sector. Lo usan el socket (`update_location`, la vía normal) y el nuevo `POST /api/conductores/ubicacion` (respaldo cuando la app está en segundo plano y el socket se cayó).
  - Este respaldo responde 204 sin cuerpo.
  - Tiene un límite de 2 envíos cada 5 s por conductor (no por IP, por el CGNAT).
- `src/ubicacion/config.js`: `UBICACION_ABIERTA_SEG=5`, `UBICACION_FONDO_MOV_SEG=10` y `UBICACION_FONDO_QUIETO_SEG=30` (D-13).
  - La app los recibe en la respuesta de `PATCH /api/conductores/disponibilidad`.
  - El servidor no arranca si el valor de detenido no cabe en la ventana de 60 s del despacho.
- `app.set('io', io)`: los controladores REST pueden reenviar por socket.

### Pruebas
- `tests/spec004.test.js`: 18 nuevas, entre ellas que el socket y el REST dan el mismo resultado y que el tercer envío en 5 s recibe 429. Backend 229/229.

---

## [1.39.0] - 2026-10-09 (Hora Local)

### Paso 004 · T2, migración 0014 (avisos y privacidad de la ubicación)
- `dispositivos_push`: los tokens de avisos solo se escriben con `registrar_dispositivo` y `olvidar_dispositivo`.
  - Si el teléfono cambia de cuenta, el token pasa a la nueva (criterio 11).
  - Como mucho 3 teléfonos por cuenta.
  - El sistema los lee con la clave de servicio.
- **Privacidad (criterio 14):** se cerró la lectura de `tricimotos.ubicacion_actual` con permisos por columna. Antes cualquier usuario autenticado podía seguir por la API REST a un conductor durante un viaje ajeno.
- `ubicacion_conductor_viaje(viaje)`: el pasajero de un viaje `aceptado` o `en_curso` ve a su conductor; nadie más, y al terminar el viaje deja de verse (13, 15, 17). No se guarda historial (16).
- Ajustes necesarios por el cierre de la columna:
  - `authController.registerProfile` insertaba la tricimoto con `.select()` (todas las columnas). Ahora pide columnas explícitas; sin el cambio, el registro de conductores habría fallado.
  - `rls_003` refrescaba la ubicación leyendo la misma columna; ahora usa un valor literal.

### Pruebas
- `rls_004.sql`: 21 en verde. `rls_001` (20), `rls_002` (18) y `rls_003` (60) siguen en verde, en Postgres 16 + PostGIS 3 local.
- Backend 211/211; la prueba del registro falla con el código anterior.

---

## [1.38.0] - 2026-10-09 (Hora Local)

### Paso 004 · plan y tareas
- `specs/004-tracking-push/plan.md`: 21 decisiones (P1 a P21), cada una con la alternativa descartada.
  - Avisos por la API HTTP de Expo, sin SDK nuevo en el backend.
  - El token del teléfono se reasigna si el teléfono cambia de cuenta.
  - Un conductor es candidato con socket **o** token de avisos, siempre con ubicación de menos de 60 s.
  - La ubicación en segundo plano se envía por socket, con REST como respaldo, para cuidar los 15 MB.
- Hallazgo de privacidad que el plan corrige (criterio 14): hoy cualquier usuario autenticado puede leer `tricimotos.ubicacion_actual` por la API REST de Supabase, y el servidor reenvía la posición de un conductor **ocupado** a todo su sector.
  - La 0014 cierra la columna con permisos por columna.
  - Durante un viaje, la posición va solo al pasajero.
- `tasks.md`: T1 a T17. T8 (Firebase, EAS y Expo) y T17 (prueba en campo) le tocan a David.

---

## [1.37.0] - 2026-10-09 (Hora Local)

### Paso 004 · borrador de la spec
- `specs/004-tracking-push/spec.md`: avisos con la app cerrada (conductor y pasajero), ubicación del conductor en segundo plano y seguimiento del conductor en el mapa del pasajero.
- 20 criterios en total, incluidos el permiso y la explicación de la ubicación en segundo plano, una nueva versión del consentimiento, nada de recorridos guardados y el presupuesto de 15 MB.
- Decisiones abiertas para David:
  - D-12: servicio de avisos (Expo, Firebase directo o un tercero).
  - D-13: frecuencia de ubicación (fija o adaptativa).
- Sin código hasta que la spec esté aprobada.
- David resolvió D-12 (A: servicio de avisos de Expo) y D-13 (B: frecuencia adaptativa), anotadas en la constitución.

---

## [1.36.0] - 2026-10-09 (Hora Local)

### Paso 003 completo · T18, prueba de humo real
- `npm run smoke` contra la BD y el backend reales: **TODO OK, 29 de 29**.
- Recorrido:
  - Disponibilidad del conductor y una oferta de 270 B, sin datos del pasajero, que vence en 15 s según el servidor (desfase de -1 ms).
  - Una segunda solicitud responde 409; tras el rechazo, el viaje queda "sin conductor".
  - "Volver a pedir", aceptación con chat y aviso al pasajero con placa `SMK-001`; una segunda aceptación responde 409.
  - Con un viaje en curso no puede cambiar su disponibilidad (409); la tricimoto vuelve sola a disponible al terminar.
- Datos (criterio 27): ubicación de 91 B cada 5 s y 40 ofertas en 10 h → 1,27 MB con margen x2 (límite: 15 MB).
- Paso 003 cerrado (T1 a T18). Sigue el 004: avisos push y tracking.

---

## [1.35.1] - 2026-10-08 (Hora Local)

### Paso 003 · T18, sincronización y limpieza de la prueba de humo
- La conexión espera `connect` y `hora_servidor`, con listeners registrados antes de conectar y un límite de espera; el desfase se mide al recibir la hora.
- Se comprueba en la BD que el GPS se guardó antes de solicitar el viaje; una oferta ausente o de otro viaje detiene el guion antes de aceptar.
- La limpieza comprueba las respuestas y solo cierra viajes de las cuentas de prueba con referencia "Prueba de humo". Un viaje ajeno bloquea la corrida sin modificarlo.
- Tras un fallo intermedio se cierran los viajes de prueba, se desactiva la disponibilidad y se desconectan los sockets. Las peticiones HTTP tienen límite de tiempo.
- `.env.example` documenta las seis credenciales del guion y aclara que la clave de servicio es obligatoria desde el 003.
- Validación local: sintaxis válida y **211/211 pruebas de backend**, incluidas 16 de sincronización, vencimientos y limpieza. **T18 permanece pendiente:** faltan las credenciales SMOKE locales para ejecutar contra Supabase. La medición de datos se identifica como proyección de ubicación y ofertas.

## [1.35.0] - 2026-10-09 (Hora Local)

### Paso 003 · T18, prueba de humo ampliada (guion listo, falta correrlo)
- `npm run smoke` fallaba con 409 en la aceptación: aceptaba el viaje directo, como en el 002, y desde la 0012 la BD exige una oferta vigente (criterio 9).
- El guion ahora recorre el despacho:
  - Limpia los viajes activos que dejaron corridas anteriores.
  - Verifica `hora_servidor` y el cambio de disponibilidad (criterio 1).
  - Oferta al conductor conectado: menos de 2 KB, sin datos del pasajero y unos 15 s según el servidor (criterios 4, 15 y 27; R14).
  - Una segunda solicitud responde 409 (criterio 13).
  - Rechazo y luego "sin conductor" (criterios 6 y 11).
  - "Volver a pedir", aceptación con chat y aviso al pasajero con nombre, placa y teléfono (criterios 10 y 16).
  - Aceptar dos veces responde 409 (criterio 8) y con un viaje en curso no puede cambiar la disponibilidad (criterio 3).
  - Chat, `en_curso`, `finalizado` y la tricimoto vuelve a disponible (R11).
  - Proyección de datos de una jornada de 10 h con margen x2 (criterio 27).
- En la rama del conductor sin aprobar, el viaje de prueba puede quedar como `sin_conductor` antes de que el pasajero lo cancele; ambos estados se aceptan.

---

## [1.34.0] - 2026-10-09 (Hora Local)

### Paso 003 · T16 y T17, verificación
- T16: `npx tsc --noEmit` sin errores en `src/` ni `app/` con todo el frontend del 003. Solo queda el aviso de `baseUrl` (deuda conocida, paso 007).
- T17: las migraciones 0011, 0012 y 0013 están en el historial del proyecto real. El linter de seguridad de Supabase muestra solo `auth_leaked_password_protection` (D-10, pospuesta).

### Pendiente del 003
- T18: prueba de humo de punta a punta. Necesita el backend con `SUPABASE_SERVICE_ROLE_KEY` y cuentas reales de pasajero y conductor.

---

## [1.33.0] - 2026-10-09 (Hora Local)

### Paso 003 · T15, lugares del administrador
- Botón "Lugares" en el panel del administrador.
- Lista (`GET /api/admin/lugares`):
  - Búsqueda por nombre con espera de 300 ms y sin respuestas viejas; filtro Todos / Visibles / Ocultos.
  - Cada lugar con su categoría, sector y fuente, e insignias "Oculto" y "Editado".
- Formulario de nuevo lugar y de corrección (`POST` y `PATCH /api/admin/lugares`):
  - Nombre, categoría y ubicación. La ubicación se marca tocando el mapa en Android, con "Usar mi ubicación" o escribiendo latitud y longitud (también con coma decimal).
  - "Visible en la búsqueda" para ocultar un lugar; no hay borrado.
  - `PATCH` envía solo lo que cambió; la BD fija el sector y marca el lugar como editado, así OSM no lo pisa (criterio 22).
  - Validación igual a la BD (nombre de 2 a 120, categorías del CHECK). Además, un punto a más de ~11 km de los sectores se rechaza, porque casi siempre es latitud y longitud cruzadas.
- `src/utils/lugaresAdmin.ts`: lógica sin React, para probarla.

### Pruebas
- `tests/despacho.test.ts`: 12 nuevas (frontend 180/180, sin errores de tipos nuevos).
- Navegador a 390 px con lugares de ejemplo: lista con filtros, edición sin cambios ("No hay cambios que guardar") y un punto fuera de Crucita rechazado. Falta con sesión de admin y backend reales (T18).

---

## [1.32.0] - 2026-10-09 (Hora Local)

### Paso 003 · T14, consola del conductor
- Interruptor de disponibilidad real: llama a `PATCH /api/conductores/disponibilidad` y muestra lo que responde el servidor (criterio 1).
  - Estado inicial leído de `tricimotos.estado` (antes se leía `perfiles.estado_operativo`, que no existe en la BD).
  - Con un viaje en curso muestra "En un viaje" y el interruptor queda bloqueado (409).
- Oferta por socket (`oferta_viaje`):
  - Personas, total, origen y destino con referencia y sector, distancia al pasajero y aviso si es la fase abierta (criterio 15).
  - Cuenta regresiva desde `venceEn` corregida con `hora_servidor`; antes era un contador local fijo de 15 s (R14).
  - Rechazar emite `rechazar_oferta`; `oferta_retirada` y el vencimiento cierran el modal (criterios 6 y 12).
  - Aceptar usa la RPC atómica; si otro ganó, se muestra "ya fue tomado". El hilo del chat queda listo en la pestaña Chat.
- Regla 6 (criterio 28, enmienda R24 del plan): modal opaco y sin blur, botones de 64 px con contraste AA y aviso "Sin conexión" en la consola y en el modal. Sin conexión no se puede aceptar.
- La ubicación se envía al ponerse disponible y luego cada 5 s, sin `estado` (R10).

### Pruebas
- `tests/despacho.test.ts`: 19 nuevas (frontend 168/168, sin errores de tipos nuevos).
- Navegador a 360 px con la oferta inyectada en el estado local: cuenta regresiva, Rechazar, cierre al vencer y aviso sin conexión. Falta con backend y conductor reales (T18).

### Pendiente
- Un modo ligero global (sin blur en toda la app) aún no existe. Se propone para el paso 007.

---

## [1.31.0] - 2026-10-09 (Hora Local)

### Paso 003 · T13, origen y estados de la solicitud del pasajero
- Origen del viaje (criterio 21):
  - Con GPS se usa la ubicación del pasajero; si no hay GPS, la ficha dice "Sin GPS: elige desde dónde sales".
  - "Cambiar" o "Elegir" abre "¿Desde dónde sales?" con el mismo buscador de lugares, los sectores y "Usar mi ubicación".
  - Con un sector como origen aparece "¿Dónde te recogen?" para la referencia que ve el conductor.
- Estados tras pedir:
  - "Buscando tricimoto…" con "Cancelar solicitud" (criterios 12 y 16).
  - "No hay tricimotos disponibles ahora" con "Volver a pedir", que reenvía la misma solicitud con la posición actual del GPS, y "Cambiar el viaje" (criterio 11).
  - "Tu tricimoto va en camino" con nombre, placa, "Llamar" y "Abrir chat" (criterio 10).
- `useViajePasajero`: escucha `viaje_aceptado` y `viaje_sin_conductor` y vuelve a leer el viaje de la BD (con RLS) al conectar y cada 30 s mientras busca (enmienda R23 del plan). Con un 409 muestra el viaje activo.
- Los avisos que llegan antes que la respuesta de `/solicitar` (sin candidatos, el cierre es inmediato) se guardan y se aplican al crear el viaje local.
- `useSocket`: los listeners se vuelven a enganchar si el socket se recrea (antes se perdían al cambiar el token) e `isConnected` es reactivo.
- `src/utils/solicitud.ts` y `src/utils/viaje.ts`: lógica sin React para probarla. El cuerpo de la solicitud no lleva precio.

### Pruebas
- `tests/despacho.test.ts`: 23 nuevas. Frontend 149/149, sin errores de tipos nuevos en `src/` ni `app/`.
- Navegador a 390 px como visitante sin GPS: elegir origen por búsqueda ("muelle") y destino por sector. Los tres estados se revisaron forzando el estado local; sin errores en la consola. Falta el flujo real con backend y sesión (T18).

---

## [1.30.0] - 2026-10-09 (Hora Local)

### Paso 003 · T12, buscador de lugares en la app
- Ficha "¿A dónde vas?":
  - Buscador de lugares que llama a `buscar_lugares` directamente con supabase-js, también sin sesión, sin API de pago ni descarga de mapa.
  - Espera 250 ms entre teclas, descarta respuestas viejas y muestra un aviso si no hay conexión.
  - Cada resultado lleva ícono por categoría y su sector, y se muestra la atribución "© OpenStreetMap".
  - Sin coincidencias, el pasajero elige el sector y escribe una referencia, como antes.
- Al elegir un lugar, la solicitud envía `lugarDestinoId` y el servidor toma coordenadas, nombre y sector.
- `src/utils/texto.ts` (`normalizar`, igual que en la BD) y `src/utils/lugares.ts`: buscador sin React, para poder probarlo.
- `.claude/launch.json`: `frontend-web-2` en el puerto 8082, para previsualizar cuando otra sesión ocupa el 8081.

### Pruebas
- `tests/despacho.test.ts` (12 nuevas). Frontend 126/126, sin errores de tipos nuevos en `src/` ni `app/`.
- Navegador, como visitante y contra la BD real:
  - "farmacia" devuelve las 4 farmacias.
  - "muele crusita" encuentra el Muelle.
  - Sin coincidencias aparece el aviso.
  - Elegir "Letras Crucita" abre la ficha con el destino por nombre.
  - Sin errores en la consola.

---

## [1.29.0] - 2026-10-09 (Hora Local)

### Paso 003 · T11, oferta y lugares del administrador
- `/api/admin/lugares` (solo admin, con el JWT del usuario):
  - `GET ?q=&visible=`: busca sin tildes y devuelve `lat` y `lng`.
  - `POST`: crea un lugar con nombre, categoría y ubicación; la BD fija fuente, sector y la marca del admin.
  - `PATCH /:id`: corrige, mueve u oculta con `visible: false`. No hay borrado.
- `utils/geo.js`: `puntoDesdeEwkb` lee la ubicación tal como la devuelve Supabase; probada con un punto real de producción.
- `utils/texto.js`: `normalizar`, compartida con el importador de OSM.
- `utils/validation.js`: categorías y largo del nombre, iguales a los CHECK de 0011.

### Pruebas
- 10 nuevas en `spec003.test.js`. La oferta del peor caso pesa menos de 2 KB y no lleva teléfono, identidad ni coordenadas del pasajero. Backend 195/195.

### Estado del backend del 003
- T7 a T11 completas. Siguen las pantallas de la app (T12 a T16), el linter (T17) y la prueba de humo (T18).

---

## [1.28.0] - 2026-10-09 (Hora Local)

### Producción
- **`0012_despacho.sql` aplicada al proyecto real** con la herramienta de Supabase (autorizada por David).
  - El viaje `solicitado` que quedaba de las pruebas del 8 oct quedó `sin_conductor`.
  - Linter de seguridad: solo el aviso conocido de D-10.
  - Comprobado: `authenticated` no ejecuta las funciones del despachador ni puede escribir `conductor_id`, `anon` no ejecuta `aceptar_viaje` y `cerrar_vencidos` corre sin errores.

### Paso 003 · T10, disponibilidad y rechazo
- `PATCH /api/conductores/disponibilidad` `{ disponible }`:
  - Pone la tricimoto en `disponible` o `inactivo`.
  - Responde 403 si el conductor no está aprobado y 409 si tiene un viaje en curso (la tricimoto está `ocupado` y vuelve sola al terminar).
  - Al dejar de estar disponible con una oferta abierta, el despachador pasa al siguiente sin esperar los 15 s.
- Socket `rechazar_oferta` `{ viajeId }`: el conductor rechaza con su propio JWT (`rechazar_oferta` de la 0012) y el despachador pasa al siguiente candidato.

### Pruebas
- 10 nuevas en `spec003.test.js`. Backend 185/185.
- Arranque real contra la BD con la 0012 durante 20 s: despachador iniciado y 4 barridos sin errores.

---

## [1.27.0] - 2026-10-09 (Hora Local)

### Paso 003 · T9, solicitar y aceptar con el despacho
- `POST /api/viajes/solicitar`:
  - Acepta `lugarOrigenId` y `lugarDestinoId`; con un lugar no hace falta enviar coordenadas ni sector, porque la BD los toma del lugar.
  - Responde 409 si el pasajero ya tiene un viaje activo, y 400 claro si el lugar ya no está disponible.
  - Al crear la solicitud arranca el despachador, sin esperar la primera oferta.
- `POST /api/viajes/aceptar`:
  - Usa la RPC atómica `aceptar_viaje` en lugar de los 3 pasos con rollback manual.
  - Responde 409 si el viaje ya fue tomado o la oferta venció, y 403 si el conductor no está aprobado.
  - Avisa al pasajero (`viaje_aceptado`) con nombre, placa y teléfono del conductor, y retira la oferta de los demás.
- `PATCH /api/viajes/:id/estado`: cancelar una solicitud que busca conductor avisa al despachador para retirar las ofertas; un viaje `sin_conductor` ya no se puede cancelar.

### Pruebas
- `tests/spec003.test.js` (13 nuevas). Se quitaron las pruebas del flujo viejo de aceptación en 3 pasos (`viajeController.test.js`, `spec001.test.js`). Backend 175/175.

### Pendiente
- Aplicar `0012` a producción: sin ella, la RPC `aceptar_viaje` no existe.

---

## [1.26.0] - 2026-10-09 (Hora Local)

### Paso 003 · T8, despachador
- `src/despacho/despachador.js`, regla mixta de D-11:
  - Ofrece de uno en uno a los 3 candidatos más cercanos y conectados, 15 s cada uno.
  - Si ninguno acepta, avisa a la vez a los demás hasta los 2 minutos y vuelve a mirar cada 15 s por si se conectó alguien.
  - Cierra como "sin conductor" si no hay candidatos, si todos rechazan o al cumplirse el máximo.
  - Avisa por socket: `oferta_viaje`, `oferta_retirada`, `viaje_aceptado` y `viaje_sin_conductor`.
  - Las tareas de un mismo viaje van en cola, porque el temporizador, el rechazo y el barrido pueden coincidir.
  - Espera lo que le falta a cada oferta según la BD, para no perder 15 s si los relojes difieren.
- `src/despacho/oferta.js`: lo que ve el conductor (personas, total, origen, destino, distancia y vencimiento), sin teléfono ni coordenadas del pasajero.
- `src/despacho/index.js`: arranca con el servidor, retoma las solicitudes pendientes (cierra las de más de 2 minutos) y barre cada 15 s. Sin `SUPABASE_SERVICE_ROLE_KEY` el servidor no arranca.

### Pruebas
- `tests/despachador.test.js` (13 nuevas) con temporizadores falsos y una BD falsa que imita la 0012. Backend 165/165.
- `spec001.test.js` ya no depende de que el `.env` local tenga o no la clave de servicio.

### Pendiente
- Contra producción, el barrido registra errores hasta que se aplique `0012` (no existe `cerrar_vencidos`). Se aplica con la T9.

---

## [1.25.0] - 2026-10-09 (Hora Local)

### Paso 003 · T7, base del despacho en el backend
- `src/despacho/config.js`: lee `DESPACHO_SECUENCIALES` (3), `DESPACHO_OFERTA_SEG` (15), `DESPACHO_MAX_SEG` (120), `DESPACHO_UBICACION_MAX_SEG` (60) y `DESPACHO_BARRIDO_SEG` (15). Un valor fuera de rango, o una fase secuencial que no deja tiempo para el aviso abierto, impide arrancar el servidor. Documentadas en `.env.example`.
- `src/despacho/conexiones.js`: registro de quién tiene un socket abierto (el despachador solo ofrece a conductores conectados).
- Sockets: cada usuario entra a su sala `usuario:{id}` y recibe `hora_servidor` al conectar; `update_location` ya no cambia el estado de la tricimoto (antes la ponía en `disponible` en cada envío, pisando `ocupado`) y avisa al sector con el estado real de la BD.

### Pruebas
- `tests/despachador.test.js` (14 nuevas); `hardening.test.js` ajustada a la sala personal. Backend 152/152.

### Pendiente
- Mientras no llegue `PATCH /api/conductores/disponibilidad` (T10), un conductor no puede ponerse disponible desde la app: T7 a T11 se fusionan juntas.

---

## [1.24.0] - 2026-10-09 (Hora Local)

### Paso 003 · T5, importación de lugares desde OpenStreetMap
- `backend/scripts/importar-lugares.js` (`npm run lugares:importar`):
  - Consulta Overpass con `User-Agent` propio y servidor de respaldo, o lee una respuesta guardada (`--entrada`).
  - Toma la parroquia Crucita más 1,5 km alrededor de cada sector: el límite de OSM no llega a La Boca.
  - Descarta calles, ríos, casas, bosques, divisiones administrativas y nombres genéricos.
  - Asigna categoría y fusiona el mismo lugar mapeado dos veces (mismo nombre a menos de 150 m).
  - Pasa a minúsculas los nombres escritos todo en mayúsculas.
  - Genera una migración idempotente.
- `0013_lugares_osm.sql`: 108 lugares (datos de OSM al 2026-10-09), todos con sector: Malecón 80, Los Arenales 13, Las Gilces 12, La Loma 3, La Boca 2.
- Algunos lugares que existían en OSM en mayo (Cevichería El Manaba, Licorería La Bodega…) ya no están en los datos actuales; el administrador puede añadirlos.

### Pruebas
- `tests/importarLugares.test.js` 14 en verde; backend 138/138. SQL: rls_001 20, rls_002 18, rls_003 60 y concurrencia 1, todo en verde; `0013` aplicada dos veces sin duplicar y respetando una edición del admin.

### Producción
- T6: David aprobó la lista. `0013` aplicada al proyecto real con la herramienta de Supabase: 108 lugares de OSM y 2 de David, todos con sector; `buscar_lugares('farmacia')` devuelve las 4 farmacias.
- `0012` sigue sin aplicar a propósito: va con el backend (T9). Al fusionar el #20 y el #21, la integración de GitHub no aplicó ninguna migración.

---

## [1.23.0] - 2026-10-08 (Hora Local)

### Paso 003 · T3 y T4, despacho (BD)
- `0012_despacho.sql`:
  - Estado `sin_conductor`; `lugar_origen_id` y `lugar_destino_id`, de los que el viaje toma coordenadas, nombre y sector (el cliente no puede mover el lugar).
  - Un viaje activo por pasajero, impuesto por un índice único.
  - Tabla `ofertas_viaje` (sin coordenadas, con distancia en metros) y una oferta pendiente por conductor.
  - `ubicacion_en` y `disponible_desde` en `tricimotos`, mantenidos por triggers.
  - Funciones del sistema `candidatos_despacho`, `crear_ofertas`, `cerrar_vencidos` y `cerrar_sin_conductor` (solo la clave de servicio).
  - Funciones del conductor `aceptar_viaje` (atómica: asigna, ocupa la tricimoto, crea el chat y retira las demás ofertas) y `rechazar_oferta`.
- **Hueco cerrado:** un conductor ya no puede tomar un viaje sin oferta ni un pasajero escribir `conductor_id`. Un trigger valida las transiciones de estado y un conductor solo ve un viaje solicitado si tiene su oferta.
- Al cerrar un viaje, la tricimoto vuelve a `disponible`; al cancelar o quedar sin conductor se cierran sus ofertas; si el conductor deja de estar disponible, suelta su oferta.

### Pruebas
- `rls_003.sql` 60 en verde; `rls_001` (20) y `rls_002` (18) actualizadas: ahora se acepta con oferta y un pasajero no tiene dos viajes activos.
- `concurrencia_003.sh`: dos sesiones aceptan a la vez y solo una gana. `run-docker.sh` la ejecuta.
- La imitación de Supabase da permisos a `service_role`, como en Supabase.

### Pendiente
- `0012` **no** está aplicada al proyecto real: el `POST /api/viajes/aceptar` actual dejaría de funcionar. Se aplica junto con el backend (T9).

---

## [1.22.0] - 2026-10-08 (Hora Local)

### Paso 003 · T2, catálogo de lugares (BD)
- `0011_lugares.sql`: `pg_trgm` y `unaccent` en `extensions`; tabla `lugares` (nombre normalizado, categoría, ubicación, sector por el centro más cercano, fuente `osm`/`admin`/`david`, `osm_id` único, `editado_por_admin`, `visible`); RLS (todos leen lo visible, también visitantes; solo el admin crea, corrige u oculta; nadie borra); `buscar_lugares(q)` con hasta 20 resultados, sin tildes y tolerante a errores leves; semilla de David (Muelle de Crucita, Los Ranchos).
- Una edición del admin queda marcada y una nueva importación de OSM no la pisa.

### Pruebas
- `supabase/tests/rls_003.sql`: 21 en verde en Docker (Postgres 16 + PostGIS). rls_001 (17) y rls_002 (16) siguen en verde.

### Producción
- `0011` aplicada al proyecto real con la herramienta de Supabase (autorizado por David). Linter de seguridad: solo el aviso conocido de D-10. `buscar_lugares('muelle')` responde.

---

## [1.21.0] - 2026-10-08 (Hora Local)

### Paso 003 · plan y tareas (en revisión)
- Spec aprobada al fusionar el PR #18.
- `plan.md`: despachador en el backend con la BD como fuente de verdad (`ofertas_viaje`), aceptación atómica por RPC, catálogo `lugares` con búsqueda por trigramas sin tildes y semilla de OSM como migración generada y revisable.
- **Hueco que se cierra en 0012:** hoy un conductor aprobado puede tomar un viaje libre por la API REST de Supabase sin oferta, y un pasajero puede escribir `conductor_id` en su propio viaje. Se revoca la columna y un trigger valida las transiciones.
- `tasks.md`: 18 tareas, cada una con su prueba.

---

## [1.20.0] - 2026-10-08 (Hora Local)

### Paso 003 · spec de despacho y catálogo de lugares (en revisión)
- `specs/003-despacho/spec.md`: disponibilidad real del conductor, asignación por distancia, aceptación atómica, cierre "sin conductor" a los 2 minutos, cancelación mientras busca, registro de ofertas sin coordenadas y catálogo de lugares desde OpenStreetMap con búsqueda tolerante a tildes y errores (D-09).
- **D-11** (David): asignación mixta, de uno en uno a los 3 más cercanos (15 s cada uno) y luego aviso abierto a los demás disponibles. Añadida a la constitución.
- Consulta a OpenStreetMap: unos 180 lugares con nombre en Crucita y alrededores, con duplicados y lugares fuera de la parroquia que hay que filtrar.

---

## [1.19.0] - 2026-10-08 (Hora Local)

### Cierre del paso 002
- **Prueba de humo con 3 cuentas (pasajero, conductor y administrador): 28 de 28 pasos OK.** Cubre consentimiento obligatorio, fotos privadas (y que nadie sube a la carpeta de otro), cédula con dígito verificador, conductor sin aprobar que no puede aceptar viajes ni usar el panel, aprobación del administrador con enlace firmado, viaje de 3 pasajeros con tarifa 1,50, chat en vivo y finalizado.
- La primera ejecución falló en cascada por un error del guion: el conductor de prueba usaba el teléfono `0990000002`, que el administrador conserva de una prueba anterior (`perfiles.telefono` es único). Ahora usa `0990000003`.
- La cuenta del conductor se había creado con "Invite user" y por eso no tenía contraseña; se recreó con "Create new user" y "Auto Confirm User".
- El perfil del administrador se renombró de "Conductor Prueba" a "Administrador".

### Pendiente (no es del 002)
- La consola del conductor aún no recibe solicitudes de viaje (`setIncomingRequest` nunca se alimenta) y no hay despacho: eso es el paso 003.

---

## [1.18.0] - 2026-10-08 (Hora Local)

### Paso 002 · pantallas de identidad (frontend)
- **Cuenta:** inicio de sesión y creación de cuenta con correo y contraseña (mínimo 8, validado en la app y exigido por Supabase Auth); reemplaza el SMS. Tras crear la cuenta, "Completa tu perfil": rol, nombre, teléfono, placa (conductor) y consentimiento LOPDP con el aviso de privacidad v0.1 a la vista.
- **Verificación del conductor:** cédula validada con dígito verificador y 3 fotos (tomadas con la cámara o de la galería) que se reducen a ≤ 1280 px y JPEG 0,6 antes de subirse al bucket privado; estados sin enviar, pendiente, rechazado con motivo (y reenvío) y aprobado.
- **Panel del administrador:** lista de solicitudes pendientes, detalle con las 3 fotos (enlaces de 5 min), aprobar con confirmación y rechazar con motivo.
- **Navegación por rol** (`app/_layout.tsx` + `utils/routing.ts`): sin sesión solo mapa y login; sin perfil, "Completa tu perfil"; un conductor sin aprobar solo ve su verificación; un pasajero no ve los paneles de conductor ni de administrador. El mapa público muestra "Entrar" o "Mi cuenta" y pedir un viaje sin cuenta lleva al login.
- **Corrección:** `fetchProfile` pedía columnas que no existen (`estado_operativo`, `calificacion`, `avatar_url`), así que el perfil nunca cargaba y nadie podía pasar del login.
- **Hook de sesión:** el arranque (restaurar sesión y escuchar cambios) corre una sola vez, en el layout raíz; antes cada pantalla creaba su propia suscripción.
- **Dependencias:** `expo-image-picker` y `expo-image-manipulator` (SDK 57) con permisos de cámara y galería en `app.json`.

### Pruebas
- Frontend 114/114, sin errores de tipos en `src/` ni `app/`. Revisado en el navegador: login, crear cuenta y perfil (conductor, aviso de privacidad, errores de validación), sin errores en consola.

### Pendiente
- T14: ejecutar `npm run smoke` con 3 cuentas (el conductor `jcevallos6547@utm.edu.ec` debe confirmar su correo) y revisar las pantallas del conductor y del administrador con sesiones reales.

---

## [1.17.0] - 2026-10-08 (Hora Local)

### Paso 002 · identidad y aprobación de conductores (BD y backend)
- **BD (`0010_identidad.sql`, aplicada al proyecto real):** tabla `consentimientos` (de solo anexar; la fecha la fija la BD; sin consentimiento no hay perfil), `conductores_verificacion` (cédula única, rutas de fotos dentro de la carpeta del conductor, estado pendiente/aprobado/rechazado, quién y cuándo revisó), funciones `es_conductor_aprobado` y un trigger que devuelve a "pendiente" una solicitud rechazada que el conductor corrige.
- **Un conductor sin aprobar no opera, y lo impide la BD**, no solo el backend: no puede ponerse disponible, actualizar ubicación, ver viajes solicitados ni aceptar.
- **Storage:** bucket privado `verificacion` (1 MB, solo JPEG); el conductor sube a su carpeta y el administrador lee todo. Nadie más.
- **Backend:** registro con consentimiento obligatorio; `POST/GET /api/conductores/verificacion`; `/api/admin/conductores` (listar, detalle con enlaces firmados de 5 min, aprobar, rechazar con motivo); validación de cédula ecuatoriana; el socket avisa si un conductor no está aprobado.
- **Primer administrador:** `jimdav1506ceva@gmail.com` (`supabase/one-off/2026-10-08_primer_admin.sql`). Se borraron los datos de la prueba de humo anterior (1 viaje, 1 chat, 1 mensaje y la tricimoto de esa cuenta).
- **Pruebas:** `supabase/tests/run-docker.sh` ejecuta las suites SQL en Docker (rls_001: 17 en verde; rls_002: 16 en verde, más los bloqueos esperados). La prueba detectó y corrigió un fallo real: un conductor rechazado no podía reenviar sus datos. Backend 124/124.
- **Prueba de humo:** `npm run smoke` ahora cubre todo el 002 (reemplaza a `smoke-001.js`) y necesita 3 cuentas.

### Pendiente
- T8 a T10 (pantallas de registro, verificación y panel de administrador), T12 (contraseña mínima en Supabase, la hace David) y T14 (ejecutar la prueba de humo con 3 cuentas).

---

## [1.16.0] - 2026-10-08 (Hora Local)

### Frontend: pulido de interfaz (impeccable + design-taste + emil-design-eng)
- **Legibilidad:** el cristal pasa de blanco al 7 % a `glassSurface` (negro azulado al 82 %), que cumple contraste AA sobre cualquier mapa. Mapa nativo con estilo nocturno de Google; versión web con OpenStreetMap y velo oscuro (sin filtro CSS, que era costoso de pintar) y atribución visible.
- **Honestidad de la interfaz:** la barra "¿A dónde vas?" era texto decorativo; ahora es una píldora de estado ("Estás en …" / "Activa tu ubicación") y la pregunta vive en la ficha de destinos.
- **SOS:** sube arriba a la derecha (ya no se monta sobre la ficha), relleno de progreso mientras se mantiene (2 s lineal, 200 ms al soltar), un solo anillo de latido lento y apagado con "reducir movimiento".
- **Movimiento:** entradas de 220 ms con ease-out y salidas de 140 ms (antes 400 a 500 ms con retardos de 200 a 400 ms); `PressableScale` con respuesta táctil asimétrica 100/160 ms.
- **Botones accesibles:** `GlassButton` ya no depende de `Gesture.Tap` (no respondía al clic ni al teclado en web); usa `PressableScale`.
- **Layout:** márgenes de zona segura arriba y abajo, ficha centrada con ancho máximo 520 en pantallas anchas, numerales tabulares en precio y contador.
- **Corrección:** la región inicial del mapa (`config.ts`) seguía en las coordenadas viejas, ~19 km al sur de Crucita; ahora enmarca los 5 sectores.
- Sin guiones largos en el texto visible; `absoluteFillObject` (inexistente en RN 0.86) reemplazado.
- Recuperado de la rama anterior: registro 1.14.0 y cierre de T16 en `tasks.md` y `specs/README.md` (no habían llegado a `main`); la entrada 1.15.0 no se había escrito.

### Pruebas
- Frontend 72/72; sin errores de tipos en `src/` ni `app/`. Verificado en el navegador integrado a tamaño de teléfono y de escritorio.

---

## [1.15.0] - 2026-10-08 (Hora Local)

### Corregido (frontend web, detectado al abrir la app en el navegador; PR #12)
- `#root` medía 0 de alto: los paneles pegados abajo (selector de destino y ficha del viaje) quedaban fuera de la pantalla. `public/index.html` ahora da altura completa a `html`, `body` y `#root`.
- Las fuentes se registraban como `Outfit-Regular`, `Inter-Medium`… pero los estilos piden `Outfit` e `Inter`: todo el texto caía a serif. Se añadieron los alias en `app/_layout.tsx`.
- El service worker de la PWA servía el paquete viejo en desarrollo; ya no se registra en `localhost`.

### Añadido
- `.claude/launch.json` con `backend` (puerto 3000) y `frontend-web` (puerto 8081) para previsualizar.

---

## [1.14.0] - 2026-10-08 (Hora Local)

### Verificado (T16, cierra el paso 001)
- Prueba de humo `npm run smoke` con 2 usuarios reales contra Supabase: 11/11 pasos OK (registro de pasajero y conductor, solicitud de 3 pasajeros con tarifa 1,50 fijada por la BD, aceptación, chat por socket e historial REST, `en_curso`, `finalizado`).
- Datos de prueba que quedan en la BD: 2 perfiles, 1 tricimoto, 1 viaje finalizado, 1 hilo de chat con 1 mensaje.
- Pendiente del 001: solo T18 (deuda de tipos del frontend), que pasa a `007-hardening`.

---

## [1.13.0] - 2026-10-08 (Hora Local)

### Cambiado
- **Sectores definitivos** (`0009_sectores_definitivos.sql`, aplicada al proyecto real): La Boca, Las Gilces, Los Arenales, Malecón de Crucita (las letras) y La Loma (parapente), con pines reales de Google Maps. Se retiran Centro, Playa y San Jacinto. Frontend (`sectors.ts`) y pruebas alineados.
- Puntos extra para el catálogo de lugares del paso 003 (D-09): Los Ranchos (−0,84971; −80,53152) y Muelle de Crucita (−0,84791; −80,53351).
- El guion de humo muestra un mensaje claro cuando el backend no está corriendo.

---

## [1.12.0] - 2026-10-08 (Hora Local)

### Corregido
- **Centros de sector con pines reales de Google Maps** (`0008_centros_sectores_reales.sql`, aplicada al proyecto real): Crucita (−0,86298; −80,53691), La Boca (−0,80148; −80,52098) y Las Gilces (−0,82141; −80,52406). Las Gilces y La Boca están ~4 y ~7 km al norte del centro; mi ubicación provisional de la 1.11.0 era incorrecta. Playa, Los Arenales y San Jacinto siguen provisionales.

### Decidido
- **D-09** Selector de negocios con catálogo propio desde OpenStreetMap, sin API de pago (se especifica en 003). **D-10** Protección de contraseñas filtradas de Supabase: pospuesta para no pagar plan; queda abierta.

---

## [1.11.0] - 2026-10-08 (Hora Local)

### Cambiado (decisión D-08: 0,50 USD por persona, sin precio por ruta)
- **BD (`0007_tarifa_por_persona.sql`, aplicada al proyecto real):** se eliminan `tarifas` y `obtener_tarifa`; `zonas.precio_por_persona` (0,50); `viajes.pasajeros`, `origen_descripcion` y `destino_descripcion`; trigger `private.fijar_tarifa_viaje` que fija `tarifa = precio × pasajeros` e ignora lo que envíe el cliente; sector nuevo `la_boca`.
- **Coordenadas de sectores corregidas:** estaban ~19 km al sur de Crucita (lat −1,04). Ahora giran en torno al punto de la parroquia (−0,8706; −80,5375). **Son provisionales**; La Boca es aproximada. Pendiente T22b.
- **Backend:** `POST /api/viajes/solicitar` acepta `pasajeros` (1–20), `sectorOrigenId`, `sectorDestinoId`, `origenDescripcion`, `destinoDescripcion`; ya no inserta `tarifa` (antes fijaba 1,50 para todos).
- **Frontend:** `MapScreen` con selector de pasajeros, total en vivo y referencia de destino en texto; `sectors.ts` sin matriz de tarifas (`calculateFare`, `PRICE_PER_PERSON_USD`); consola del conductor muestra personas y referencia.

### Corregido
- `MapScreen` enviaba `sector_origen`/`sector_destino`, pero el backend exige `origen`/`destino` con coordenadas: toda solicitud de viaje devolvía 400. Ahora envía el payload correcto.

### Pruebas
- Backend 89/89, frontend 71/71, SQL/RLS 17/17 (Postgres 16 + PostGIS en Docker). `get_advisors(security)`: solo avisa "Leaked Password Protection" (ajuste del panel de Supabase).

---

## [1.10.0] - 2026-10-08 (Hora Local)

### Verificado en producción (Supabase)
- Limpieza única ejecutada y migraciones 0001–0006 aplicadas por la integración Supabase–GitHub al fusionar #7.
- 9 tablas con RLS, 20 políticas, semilla de Crucita (5 sectores, 10 tarifas), `obtener_tarifa` simétrica, PostGIS en `extensions`.
- Linter de seguridad de Supabase: 0 hallazgos (antes 1 ERROR y 2 WARN).

### Seguridad
- `npm audit fix` en backend: 0 vulnerabilidades en dependencias de producción (proxy-addr crítica, engine.io, socket.io-parser, qs). CI con `npm audit --omit=dev --audit-level=high`.

### Añadido
- `CLAUDE.md`: reglas de la constitución, flujo por specs, reglas de BD/backend y comandos para Claude Code.

---

## [1.9.0] - 2026-10-08 (Hora Local)

### Integrado (sustituye a los PR #1 y #2, que tenían conflictos con `main`)
- **PR #1 · manejo de errores:** frontend envía `viajeId` (antes `viaje_id`) y lee `data.data` (antes `data.viaje`/`data.messages`); alertas al usuario en solicitar/aceptar viaje; `useSocket` no emite si no hay conexión; rollbacks registran su propio fallo; 404 y manejador global de errores; sockets sin perfil se rechazan en vez de asumir "pasajero".
- **PR #2 · endurecimiento:** helmet, CORS con lista blanca (`ALLOWED_ORIGINS`), límite de cuerpo, rate limiting, `errorResponse` sin detalles internos, validación de coordenadas, UUID, nombre, teléfono, placa, sector y longitud de mensajes (REST y sockets).
- **Ajustes propios:** límites de rate limit holgados por CGNAT y configurables; `TRUST_PROXY`; placa validada con el mismo patrón que la BD (el formato ecuatoriano `ABC-1234` del PR #2 no aplica a todas las tricimotos); app Express separada en `src/app.js` para probarla.

### Pruebas
- Nuevo `tests/hardening.test.js`. Backend 80/80, frontend 69/69.

---

## [1.8.0] - 2026-10-08 (Hora Local)

### Añadido
- **Paso 001 (spec aprobada):** `plan.md` y `tasks.md`; migraciones `supabase/migrations/0001` a `0006` (PostGIS en `extensions`, catálogo `zonas`/`sectores`/`tarifas` con semilla de Crucita, `tricimotos`, RLS con permisos por columna); limpieza única en `supabase/one-off/`.
- **CI:** `.github/workflows/ci.yml` (tests de backend y frontend) y `supabase-keepalive.yml` (lectura cada 3 días).
- **Backend:** `createUserClient(jwt)` y `getAdminClient()` en `config/supabase.js`; `authMiddleware` adjunta `req.supabase`; sockets usan `socket.supabase`. Nuevo `tests/spec001.test.js`.
- `backend/.env.example`.

### Corregido
- `asyncHandler` no devolvía la promesa: 18 tests fallaban en `main`. Ahora backend 56/56 y frontend 69/69.
- Código alineado al esquema: `thread_members` sin columna `id`, `threads.created_by`, sin `updated_at` manual (trigger), `aceptado_en`/`finalizado_en`, placa normalizada, validación de `destino.lng`.

### Decidido
- D-02 Google Maps · D-03 solo tricimotos · D-04 conductores aprobados por admin · D-05 SOS llama al 911 · D-06 cliente por usuario (ver `specs/constitution.md`).

### Pendiente
- Ejecutar la limpieza única y aplicar las migraciones en Supabase (requiere confirmación). `backend/database.sql` marcado como obsoleto.

---

## [1.7.0] - 2026-10-08 (Hora Local)

### Añadido
- **Spec-Driven Development:** creada carpeta `specs/` con `README.md` (índice de los 8 pasos), `constitution.md` y `001-cimientos/spec.md` (borrador).
- **EAS:** `frontend/app.json` enlazado al proyecto de Expo (`extra.eas.projectId`); creado `frontend/eas.json` con perfiles `development`, `preview` (APK) y `production`.

### Analizado
- **Auditoría de Supabase** (proyecto reactivado tras pausa por inactividad): falta la tabla `tricimotos`, `perfiles` y `viajes` con RLS sin políticas, backend con clave anon sin JWT de usuario, columna `messages.body` vs `content` en código, 0 migraciones. Detalle en `specs/001-cimientos/spec.md`.
- **Estado:** pendiente de aprobación de la spec 001. Sin cambios aplicados a la BD.

---

## [1.6.0] - 2026-07-01 20:30 (Hora Local)

### Añadido
- **Implementación Completa de la UI y Lógica del Frontend (Expo / React Native / TypeScript):**
  - **Sistema de Diseño (Glassmorphism & Componentes Visuales):**
    - Centralizados los tokens de diseño (colores, fuentes Outfit/Inter, espaciado de 4/8dp, formas, sombras, efectos visuales y constantes de animación) en el archivo de constantes [theme.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/constants/theme.ts).
    - Creados componentes reutilizables de cristal con soporte de desenfoque (`expo-blur`) y gradientes (`expo-linear-gradient`): [GlassCard.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/GlassCard.tsx), [GlassButton.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/GlassButton.tsx), [GlassInput.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/GlassInput.tsx), [BlurContainer.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/BlurContainer.tsx), [PanicButton.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/PanicButton.tsx) (con animación de pulsación y retención de 2 segundos para emergencias SOS) y [LoadingSpinner.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/components/LoadingSpinner.tsx).
  - **Manejo de Estado Global (Zustand Stores):**
    - [useAuthStore.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/store/useAuthStore.ts): Gestión de sesión, autenticación y persistencia local mediante AsyncStorage.
    - [useLocationStore.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/store/useLocationStore.ts): Almacenamiento de geolocalización en tiempo real, sector identificado y estado de disponibilidad del conductor.
    - [useRideStore.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/store/useRideStore.ts): Ciclo de vida y estados del viaje (`solicitado`, `aceptado`, `en_ruta`, `completado`, `cancelado`).
  - **Hooks de Integración (Supabase, WebSockets, Geolocalización y Tarifas):**
    - [useSupabaseAuth.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useSupabaseAuth.ts): Flujo de autenticación telefónica sin contraseña (OTP simulado) contra Supabase.
    - [useSocket.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useSocket.ts): Conectividad bidireccional en tiempo real con Socket.io del backend para chat, seguimiento de ubicación e interacciones de viaje.
    - [useLocation.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useLocation.ts): Rastreo de geolocalización en primer plano y en segundo plano (optimizado para batería) con detección y mapeo de geocercas locales.
    - [useTariff.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/hooks/useTariff.ts): Cálculo de tarifa fija según la geocerca de origen y destino basándose en el mapeo de sectores en [sectors.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/constants/sectors.ts).
  - **Pantallas Clave de la Aplicación:**
    - [LoginScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/LoginScreen.tsx): Pantalla de acceso mediante número de teléfono con diseño Glassmorphic.
    - [MapScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/MapScreen.tsx): Mapa a pantalla completa, caja flotante de destino, Bottom Sheet translúcido con cálculo de tarifa/búsqueda de conductor y botón de pánico SOS integrado.
    - [DriverConsoleScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/DriverConsoleScreen.tsx): Consola del conductor con switch de disponibilidad, recibidor de solicitudes entrantes de viajes con contador de 15 segundos y control de estados del servicio.
    - [ChatScreen.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/src/screens/ChatScreen.tsx): Panel de mensajería en tiempo real y persistente entre conductor y pasajero, suscrito a salas de WebSocket exclusivas.
  - **Enrutamiento y Navegación Dinámica con Expo Router (File-Based):**
    - Configurado el layout raíz [_layout.tsx](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/app/_layout.tsx) para cargar fuentes de Google Fonts (Outfit, Inter) y proveer el contexto global de la sesión.
    - Definidas rutas para autenticación en `(auth)` y flujos protegidos diferenciados por rol en `(app)/(passenger)` y `(app)/(driver)`.
  - **Configuración de Proyecto y Dependencias:**
    - Inicializado el proyecto con Expo SDK 57, configurando [app.json](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/app.json), [tsconfig.json](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/tsconfig.json), [package.json](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/package.json), [.env.example](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/.env.example) e [index.ts](file:///c:/Users/David/Documents/Proyectos/PLANIFICACIÓN DE PROYECTO- CRUCIDRIVE/CruciDrive - APP/frontend/index.ts).
  - **Archivos Modificados:** `/REGISTRO_CAMBIOS.md`.
  - **Archivos Creados (Frontend):** Todos los archivos bajo `/frontend` detallados arriba.
  - **Estado:** Completado y listo para pruebas de integración de punta a punta (End-to-End).

## [1.5.0] - 2026-07-01 18:10 (Hora Local)

### Añadido
- **Definición del Sistema de Diseño (Glassmorphism & Google Stitch):**
  - Creado archivo `DESIGN.md` en la raíz del proyecto para definir los tokens del tema (colores translúcidos, tipografía, bordes de cristal, sombras, efectos de desenfoque e intensidades) y guías visuales de componentes clave (Login, Mapa, Ficha de Viaje, Botón de Pánico y Chat).
  - Actualizado `masterPrompt.md` en la raíz del proyecto para establecerlo como el Master Prompt definitivo e integrar la directriz del frontend, instruyendo el uso de `DESIGN.md` para evitar el desplazamiento de estilos.
  - **Archivos Modificados:** `/DESIGN.md`, `/masterPrompt.md`, `/REGISTRO_CAMBIOS.md`.
  - **Estado:** Completado y listo para que cualquier agente de IA o diseñador proceda a generar la UI móvil.

## [1.4.0] - 2026-07-01 17:40 (Hora Local)

### Añadido
- **Implementación completa de API REST y WebSockets para MVP:**
  - Instalado `socket.io` como dependencia del backend.
  - Creado `backend/database.sql` conteniendo el script de creación de tablas, PostGIS e índices.
  - Creados middlewares de seguridad `authMiddleware.js` (validación JWT Supabase) y `roleMiddleware.js` (RBAC).
  - Creados controladores `authController.js`, `viajeController.js`, `chatController.js` y expuestas sus respectivas rutas REST protegidas.
  - Creado `socketHandler.js` para gestionar eventos en tiempo real (Tracking GPS de conductores, suscripción a geocercas locales y chat instantáneo).
  - Reestructurado `index.js` para iniciar el servidor Express acoplado de forma híbrida con Socket.io.
  - **Verificación:** Ejecución de pruebas locales de conexión a Supabase y peticiones HTTP completada exitosamente.
  - **Estado:** Completado y listo para integración con el frontend.

## [1.3.0] - 2026-07-01 17:30 (Hora Local)

### Analizado
- **Análisis de preparación de Backend para Frontend:**
  - Realizado un escaneo del monorepo y contrastado con las directrices de `ESTRUCTURA.md`, `PLAN.md`, `SEGURIDAD.md`, y `BASE_DE_DATOS_Y_BACKEND.md`.
  - Creado reporte de análisis en `backend_analysis.md`.
  - **Estado:** Completado (Pendiente de decisión sobre Prisma/Supabase y estado de BD en Supabase).


## [1.2.0] - 2026-06-30 13:20 (Hora Local)

### Reestructurado
- **Reorganización del monorepo según `ESTRUCTURA.md`:**
  - Migrado todo el código backend (`src/`, `package.json`, `package-lock.json`, `.env`, `.env.example`) desde la raíz a `./backend/`.
  - Eliminado `node_modules/` de la raíz y reinstalado dependencias dentro de `./backend/`.
  - Creados directorios faltantes del backend: `src/middlewares/`, `src/models/`, `src/sockets/` (con `.gitkeep`).
  - Creado scaffolding completo del frontend en `./frontend/src/` con 9 subdirectorios: `assets/`, `components/`, `constants/`, `hooks/`, `navigation/`, `screens/`, `store/`, `styles/`, `utils/` (todos con `.gitkeep`).
  - Actualizado `.gitignore` de raíz para cubrir rutas de monorepo (`backend/.env`, `frontend/.expo/`, etc.) y exclusiones de Expo/React Native.
  - **Verificación:** Backend carga correctamente desde `./backend/` con `npm install` y conexión a Supabase validada.
  - **Estado:** Completado.

---

## [1.1.0] - 2026-06-30 13:12 (Hora Local)

### Añadido
- **Documentación base del proyecto desde `masterPrompt.md`:**
  - Creado `ARQUITECTURA.md` — Definición técnica del stack, patrones de diseño y directriz de UI (Glassmorphism).
  - Creado `PLAN.md` — Fases de ejecución iterativa del MVP (Fase 1 a Fase 5).
  - Creado `CASOSDEUSO.md` — Requerimientos funcionales por actor (Pasajero, Conductor, Administrador).
  - Creado `ESTRUCTURA.md` — Árbol de directorios del monorepo (`/backend`, `/frontend`) con convenciones.
  - Creado `SKILLS.md` — Reglas técnicas obligatorias para el agente de IA.
  - Creado `SEGURIDAD.md` — Directrices de seguridad y cumplimiento LOPDP (Ecuador).
  - **Archivos Modificados:** `REGISTRO_CAMBIOS.md` (actualizado con esta entrada).
  - **Estado:** Completado.

---

## [1.0.0] - 2026-06-30 13:08 (Hora Local)

### Añadido
- **FASE 1: Inicialización de Git y GitHub:**
  - Repositorio Git inicializado localmente (`git init`).
  - Configurado `user.name` como "DavidCevallos15" y `user.email` como "jimdav1506ceva@gmail.com".
  - Creado y configurado el archivo `README.md` inicial.
  - Subido el commit inicial a la rama `main` del repositorio remoto `https://github.com/DavidCevallos15/Crucidrive---APP.git`.
- **FASE 2: Estructura de Node.js y Dependencias:**
  - Proyecto Node.js inicializado (`npm init -y`).
  - Instaladas dependencias principales de producción: `express`, `cors`, `dotenv`, `@supabase/supabase-js`.
  - Instalada dependencia de desarrollo: `nodemon`.
  - Configurado script de desarrollo `"dev": "nodemon src/index.js"` en `package.json` para facilitar la ejecución interactiva.
- **FASE 3: Arquitectura y Conexiones:**
  - Creado archivo `.gitignore` para excluir estrictamente `.env`, `node_modules` y directorios temporales de editores.
  - Creado `.env.example` como plantilla para configuración de puerto y Supabase.
  - Creado `.env` con las claves reales suministradas para el desarrollo local (nunca subidas a Git).
  - Estructurado el archivo de conexión `src/config/supabase.js` que inicializa el cliente de Supabase usando variables de entorno.
  - Creados los directorios de arquitectura limpia `src/controllers/` y `src/routes/` con archivos `.gitkeep` correspondientes.
  - Creado punto de entrada `src/index.js` para levantar el servidor Express en el puerto 3000 con un endpoint de health check `/` que verifica la conectividad a la API de Supabase.

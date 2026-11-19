# 017 · Plan

Spec aprobada el 19 nov 2026 (R1 a R8, D-21). Por R1 el plan tiene dos entregas:

| Entrega | Criterios | Cuándo | Cambia |
| --- | --- | --- | --- |
| **Parte A** | 1 a 3 | Ya, antes del piloto | Solo la app (JavaScript). Sale por actualización por aire (D-17), sin APK nuevo |
| **Partes B a G** | 4 a 23 | Después del PR 2 del 007 | BD, backend, app y un número receptor |

## Parte A · Pedir sin depender del mapa

### P1 · Cuándo hay «sin internet»
- La app ya mantiene un socket con el servidor (`useSocket().isConnected`). Se usa ese estado: si hay sesión y el socket lleva **6 s** sin conectar, hay «sin internet».
- La gracia de 6 s evita que el aviso parpadee al abrir la app, cuando el socket todavía está conectando.
- La regla es una función pura, `estaSinInternet` en `src/utils/conexion.ts`. El temporizador vive en el hook `useSinInternet`.
- Sin sesión no hay socket, así que no se muestra el aviso. Un visitante no puede pedir.
- **Descartado: NetInfo o `expo-network`.**
  - Son código nativo: obligan a generar un APK nuevo y a subir la versión de ejecución (D-17).
  - Sin megas, Android sigue diciendo «conectado a la red móvil». Lo que importa es llegar al servidor, y el socket ya lo mide.
- **Descartado: un ping periódico a `/health`.** Gasta datos y repite lo que ya hace el socket.

### P2 · Aviso «Sin internet»
- Es una píldora en la fila de arriba, junto al menú: ícono `cloud-offline`, «Sin internet» y «Revisa tus datos o megas».
- Se ve siempre mientras dure, también con un viaje activo (regla 6).
- Lleva `accessibilityLiveRegion="polite"` para que el lector de pantalla lo anuncie.
- Convive con el aviso que ya existe en la hoja del viaje (005, criterio 20).

### P3 · Plano simple de los sectores
- Es el componente `PlanoSectores`, dibujado con `react-native-svg`, que ya está instalado. No hace ninguna petición de red.
- La proyección es una función pura en `src/utils/planoSectores.ts`:
  - equirectangular, con norte arriba y el mar (oeste) a la izquierda;
  - con la misma escala en los dos ejes, corrigiendo la longitud por `cos(lat)`, para no deformar la costa;
  - deja una reserva a la derecha para los nombres de los sectores.
- Dibuja los 5 centros de `SECTORS` unidos de norte a sur, el mar a la izquierda de esa línea y los nombres.
- Resalta el sector de origen y el de destino elegidos y marca «Tú» si hay GPS. El GPS funciona sin internet.
- Si el GPS cae fuera del plano (fuera de Crucita), no se dibuja.
- Se superpone al mapa en la franja que el mapa siempre deja a la vista (35 % del alto, `MAPA_VISIBLE_MIN`). El mapa sigue montado debajo y vuelve solo al reconectar.
- **Descartado: una imagen estática de OpenStreetMap.** Pesa más, hay que atribuirla y no puede resaltar lo elegido.
- **Descartado: guardar el mapa de Google para usarlo sin conexión.** La app no controla esa caché.

### P4 · Pedido sin respuesta y reintento
- `solicitar` ya corta a los 15 s (`LIMITE_PETICION_MS`). Cuando la red falla o se acaba el tiempo, ahora devuelve `{ ok: false, sinConexion: true, mensaje }`.
- La pantalla muestra «No se pudo enviar» con «Reintentar» y «Cerrar». Ya no usa el «No se pudo completar» genérico.
- **Sin viajes duplicados:** el índice único `uq_viajes_activo_por_pasajero` (0012) ya impide un segundo viaje activo.
  - Si el primer intento sí llegó, el reintento recibe 409.
  - Con un 409, la app sincroniza el viaje y, si lo encuentra, lo muestra como pedido hecho, sin error.
- **Descartado: una clave de idempotencia en `POST /api/viajes/solicitar`.** Pide migración y backend, y el índice único ya da la garantía.

### Criterio 1
El formulario está encima del mapa y el botón «Solicitar» solo depende de que haya origen y destino (`!origen || !destino`), no de que cargue el mapa. El origen sale del GPS o de un sector elegido, y los dos funcionan sin red. Se prueba que con solo los datos guardados en la app (sectores y GPS) se arma un pedido completo para cada par de sectores.

## Partes B a G · Pedir por SMS (después del PR 2 del 007)
Este es el diseño de partida. Se revisa con la T8 antes de escribir código.

### P5 · Número receptor
- Un teléfono Android con el chip prepago de David y un paquete de SMS (R6), con wifi y cargador.
- Una app de pasarela SMS de código abierto:
  - reenvía cada SMS entrante a un webhook HTTPS del backend;
  - envía las respuestas por una API local o en la nube.
- Candidata: *SMS Gateway for Android* (`capcom6/android-sms-gateway`, Apache-2.0). La T8 comprueba la firma del webhook, los reintentos y el envío por API.
- **Descartado: un proveedor en la nube con número extranjero.** El pasajero pagaría un SMS internacional.
- **Descartado: un código corto con las operadoras.** Requiere trámite y su costo no cabe en el presupuesto.

### P6 · Entrada en el backend
- `POST /api/sms/entrante`:
  - sin JWT de usuario, porque llega de la pasarela;
  - con firma HMAC y marca de tiempo (`SMS_PASARELA_SECRETO`), y rate limit propio.
- Es una **tarea del sistema**, igual que el despacho del 003: el pasajero no tiene sesión ni internet. Por eso usa `getAdminClient()` para llamar a una función `private.crear_viaje_por_sms(...)`.
- Esa función reutiliza las reglas de `solicitar`: tarifa por trigger, índice único, sanción y topes.
- La respuesta al pasajero sale por la API de la pasarela, con un máximo de 3 SMS por pedido (criterio 17).

### P7 · Código del mensaje
- Al activar, el servidor genera un secreto por dispositivo. La app lo guarda en SecureStore.
- Código = HMAC-SHA256(secreto, ventana de 5 min), truncado a 6 caracteres base32.
- El servidor acepta la ventana actual ± 2, por si el reloj del teléfono no está en hora, y guarda los códigos usados para rechazar repeticiones.
- Activarlo en otro teléfono rota el secreto (criterio 6).

### P8 · Migración
- Toma el número libre siguiente; la 0018 es del 007.
- `private.sms_activaciones`: perfil, teléfono, confirmado_en, secreto, versión y fecha del consentimiento.
  - El pasajero solo ve su estado por una función. El secreto nunca sale por REST.
- `sms_recibidos`: hora, número enmascarado, resultado, viaje y texto. El texto se borra a los 30 días (criterio 22). Solo lo lee el admin.
- `viajes.canal` (`app` o `sms`), para la marca del conductor (criterio 20).
- Cada tabla y política nueva lleva su `rls_NNN.sql`, y los advisors tienen que quedar sin hallazgos.

### P9 · Abrir la aplicación de mensajes
- Primero con `Linking.openURL('sms:<número>?body=<texto>')`: no necesita módulo nativo y sale por actualización por aire.
- Si en algún teléfono el texto no aparece, se pasa a `expo-sms` (APK nuevo, D-17).
- **La app no pide `SEND_SMS`.** Google Play reserva los permisos de SMS a las apps de mensajería predeterminadas, y enviarlo solo iría contra el criterio 8.

### P10 · Formato
- GSM-7 sin tildes, como máximo 160 caracteres y con nombres cortos de sector.
- El servidor lo lee con un parser tolerante a mayúsculas y espacios.
- Las pruebas generan todos los pares de sectores con la referencia más larga y comprueban que cada uno cabe.

### P11 · Mensajes viejos
Se usa la hora que trae la pasarela (la de la operadora). Si el SMS tiene más de 10 minutos, no se despacha y se responde una sola vez (criterio 21).

### P12 · Costo
Chip prepago y paquete de SMS. Se anota el costo real en la T8 para cumplir el criterio 23 (regla 5).

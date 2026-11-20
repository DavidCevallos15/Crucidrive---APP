# 007 · Auditoría del APK `preview` (T18 y T19; criterios 25 y 26; D-20)

Fecha: 19 nov 2026. Solo análisis estático del APK propio (D-20): no se ejecutó ni se decompiló el JavaScript, que va en bytecode Hermes.

## APK auditado
| Dato | Valor |
| --- | --- |
| Compilación EAS | `efa4b568-712b-4443-930b-6f9e001f21c4`, perfil `preview`, del 4 nov 2026 |
| Origen del archivo | Copia local de David (`Downloads/MEmu Download/`): el enlace de EAS ya había caducado |
| SHA-256 del APK | `1cb7723f4701d9058f6b2597a975735dfaec1ba84134abb5d0aba33ac6c635d6` |
| Paquete y versión | `com.crucidrive.app` 1.0.0 (código 1) |
| SDK | mínimo 24 (Android 7), objetivo 36 |
| Herramienta | androguard 4.1.3 en un entorno aislado. REA no se usó: el SDK de Android de la PC no tiene `build-tools` y androguard cubre lo que pide el criterio 25 (permisos, componentes, firma y meta-datos). El JavaScript va fuera de alcance de todos modos (D-20) |

## Firma
| Dato | Valor |
| --- | --- |
| Esquema | v2 (sin v1 ni v3). Basta para el SDK mínimo 24 |
| Certificado | Generado por EAS, sin nombre (`C=US`), válido del 9 oct 2026 al 24 feb 2054, RSA |
| **SHA-1** | `78:46:15:05:E4:E0:5B:A5:A4:6B:40:A0:71:8E:F6:C4:51:94:6B:9C` |
| SHA-256 | `C0:25:94:3F:CA:43:CC:68:9D:CA:ED:11:16:3B:E4:F0:AA:7D:E7:0A:BA:C0:61:87:85:6A:7B:17:D1:F6:1C:4F` |

El SHA-1 es el que debe figurar en la restricción de la clave de Maps para Android (abajo). Si un día se publica en Play Store con «Firma de apps de Play», hay que agregar también el SHA-1 que da Play.

## Permisos
| Permiso | ¿Se usa? | Justificación o acción |
| --- | --- | --- |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Sí | API, socket, Supabase y estado de la red |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Sí | Origen del pasajero y posición del conductor (003 y 004) |
| `ACCESS_BACKGROUND_LOCATION` | Sí, solo conductores | El conductor disponible sigue recibiendo ofertas con la pantalla apagada (004, D-13). Texto para Play Store abajo |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` | Sí | El servicio con aviso permanente que mantiene la ubicación del conductor (004) |
| `CAMERA` | Sí | Fotos de verificación del conductor: él, su cédula y su tricimoto (002) |
| `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `c2dm.RECEIVE` | Sí | Avisos de ofertas y del viaje (004, D-12) |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | **No** | Los agrega `expo-secure-store`; la app no pide huella. **Quitado** (A1) |
| `RECORD_AUDIO` | **No** | Lo agrega `expo-image-picker` para grabar video; la app solo toma fotos. **Quitado** (A1) |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | **No** | Heredados de librerías; el selector de fotos usa el selector del sistema. **Quitados** (A1) |
| `SYSTEM_ALERT_WINDOW` | **No** | Ventana flotante, solo útil para depurar React Native. **Quitado** (A1) |
| Permisos de insignias de lanzadores (Samsung, Huawei, Oppo, HTC, Sony…) y `READ_APP_BADGE` | Indirecto | Los agrega la librería de avisos para el número sobre el ícono. Son permisos de cada lanzador, sin acceso a datos. Se aceptan |
| `BIND_GET_INSTALL_REFERRER_SERVICE` | Indirecto | De Google Play Services. Sin datos personales. Se acepta |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Sí | Lo crea Android para proteger los receptores internos |

### Texto para Play Store: ubicación en segundo plano
> CruciDrive usa la ubicación en segundo plano solo para los conductores, mientras marcan «Disponible». Así el sistema de despacho puede ofrecerles los viajes más cercanos aunque tengan la pantalla apagada. Mientras está activa, se muestra un aviso permanente. Al marcar «No disponible», o con la app cerrada, la ubicación deja de enviarse. Los pasajeros nunca comparten su ubicación en segundo plano. No se guarda el historial de recorridos.

## Componentes exportados
De 35 componentes, 5 están exportados:

| Componente | Protección | ¿Hace falta? |
| --- | --- | --- |
| `MainActivity` (lanzador y enlaces `crucidrive://`) | Ninguna, como toda app | Sí. Los enlaces solo abren pantallas; las acciones exigen sesión y las valida el servidor |
| `androidx.work…SystemJobService` | `BIND_JOB_SERVICE` (solo el sistema) | Sí, tareas programadas |
| `androidx.work…DiagnosticsReceiver` | `DUMP` (solo el sistema o adb) | De la librería; inofensivo |
| `com.google.firebase.iid.FirebaseInstanceIdReceiver` | `c2dm.permission.SEND` (solo Google Play Services) | Sí, avisos |
| `androidx.profileinstaller.ProfileInstallReceiver` | `DUMP` | De la librería; inofensivo |

No hay proveedores de contenido exportados.

## Otros puntos del manifiesto
| Punto | Resultado |
| --- | --- |
| `debuggable` | No está activo |
| Tráfico sin cifrar | No está permitido: el SDK objetivo 36 bloquea HTTP por defecto y no hay `usesCleartextTraffic` |
| `allowBackup` | Estaba en `true`: Android podía copiar los datos de la app a la nube de Google. **Corregido** a `false` (A2) |
| Clave de Maps en el manifiesto | Está presente, como exige Google Maps en Android. Es pública por diseño; la protege la restricción de la clave (abajo) |
| Secretos | No aparecen la clave de servicio de Supabase (`service_role`) ni claves de Stripe en los recursos del APK |

## Clave de Maps para Android (D2)
La clave del manifiesto empieza con `AIzaSyDF` y termina en `J21I`. En Google Cloud, la clave «Crucidrive Android Maps» debe estar restringida a:
- **Apps para Android:** paquete `com.crucidrive.app` con el SHA-1 `78:46:15:05:E4:E0:5B:A5:A4:6B:40:A0:71:8E:F6:C4:51:94:6B:9C`;
- **APIs:** solo Maps SDK for Android.

El 19 nov 2026 se vio en Google Cloud que la clave está restringida a Android. **Falta que David confirme que el SHA-1 de la restricción coincide con este** (tarea D2).

## Hallazgos
| # | Gravedad | Hallazgo | Estado |
| --- | --- | --- | --- |
| A1 | Alta | Seis permisos que la app no usa, entre ellos micrófono y ventana flotante. Play Store los revisa y dan acceso que nadie necesita | **Corregido** en `app.json`: `blockedPermissions` y `microphonePermission: false`. Sale en el próximo APK |
| A2 | Media | `allowBackup=true`: Android podía copiar a la nube de Google los datos guardados fuera del llavero (preferencias, caché) | **Corregido**: `allowBackup: false`. Sale en el próximo APK |
| A3 | Media | La restricción de la clave de Maps para Android debe usar el SHA-1 de este certificado | Pendiente de confirmar por David (D2). Sin eso, el riesgo es el uso de la clave desde otra app; el gasto lo limita la cuota de Google |
| A4 | Baja | Firma solo v2 | Se acepta: el SDK mínimo es 24 |
| A5 | Baja | Permisos de insignias de lanzadores | Se aceptan: son de cada lanzador y no dan acceso a datos |

Ningún hallazgo alto queda abierto (criterio 26). Las correcciones A1 y A2 son nativas: se publican en el **próximo APK `preview`**, no por aire. Comprobación: `npx expo config --type introspect` genera `allowBackup="false"` y marca los seis permisos con `tools:node="remove"`. `frontend/tests/permisosApk007.test.ts` evita que la configuración vuelva atrás.

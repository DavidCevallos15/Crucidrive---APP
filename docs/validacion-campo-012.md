# Validación de campo · PR #58 y extensión 012

20 oct 2026, hora de Ecuador.

## APK de main con el PR #58

- EAS build `f9ece896-1611-4e6a-8d86-987dcf00ca72`, perfil preview, Android APK, resultado **FINISHED**.
- Commit compilado: `360395c458e830bf9a8db62f66a510a73df82d5b`, comprobado con `eas build:view --json`.
- La compilación terminó el 20 oct a las 20:27 de Ecuador (21 oct 01:27 UTC). Enlace de descarga entregado a David en el chat.
- Este APK contiene #58; la extensión 012 requiere fusionar su PR y generar un APK posterior.

## Evidencia de la extensión 012

- Frontend: **381/381** pruebas; TypeScript sin errores.
- Backend: **386/386** pruebas, incluidos filtros combinados y configuración del proxy. Cobertura de `trustProxy.js`: 100 % de líneas y ramas.
- Expo export web y Android/Hermes correctos. El export Android conserva un aviso previo de Babel sobre la exportación de tipo `Region`; no impidió el empaquetado.
- Capturas web `.impeccable/review/campo012/`: mapa, menú, ficha, encomienda y ajustes en 360×640; mapa en 1280×800. Se seleccionaron origen/destino y servicio sin enviar solicitudes.
- Revisión independiente Impeccable: **ship al alcance código y web**, sin hallazgos bloqueantes. Documentación del sistema actualizada; no equivale a certificación en Android.
- No se observaron estados buscando/aceptado/en curso con sesión real ni filtros en una sesión admin.

## Android disponible y bloqueo concreto

David confirmó APK en teléfono y emulador. Se encontró LDPlayer abierto y su ADB en `C:/LDPlayer/LDPlayer9/adb.exe`; `adb devices -l` no devuelve dispositivos. `adb connect 127.0.0.1:5555` falla por conexión rechazada; `ldconsole adb --index 0 --command get-state` responde dispositivo no encontrado.

Se envió a la instancia 0 `ldconsole locate --index 0 --LLI -80.5440,-0.8710`, orden longitud,latitud según el fabricante. La orden no produjo error, pero sin acceso Android no se verificó la posición resultante. No se modificó la configuración de depuración ni se leyó almacenamiento de cuentas.

Para continuar hace falta una conexión de depuración local autorizada de LDPlayer, y teléfono conectado para las comprobaciones físicas. No se canceló el viaje remoto usando privilegios del servidor ni se fingió una prueba de chat.

## Secuencia pendiente con cuentas de prueba

1. Instalar el APK de #58 y comprobar acceso a la API; reiniciar una vez `npm run dev` para cargar el nuevo `nodemon.json`.
2. Fijar GPS del emulador en latitud -0.8710 y longitud -80.5440, y verificar el mapa en la app.
3. Con Conductor Prueba, recuperar el viaje aceptado del 20 oct, abrir Cancelar, elegir un motivo verdadero para el servicio de prueba y confirmar. Verificar en Pasajero Prueba que ya no dice «va en camino».
4. Probar cierre de sesión y reentrada en ambos dispositivos. Si Android se cierra inesperadamente, capturar logcat del momento y redactar identificadores/tokens antes de compartirlo.
5. Crear otro viaje de prueba únicamente para el chat: aceptar como conductor, enviar en ambos sentidos, comprobar recepción, reconexión y que el teclado no oculte el compositor. Terminar o cancelar ese servicio con el flujo normal.
6. Después de fusionar 012 y compilar su APK, probar gesto del borde/cierre/interrupción/Atrás, aviso GPS exterior sin bloqueo al conductor, SOS visible en todos los estados y filtros admin combinados. No completar una llamada real al 911 durante una prueba.

## Aviso de proxy y reinicios del registro

La API del frontend local usa conexión LAN directa, y `TRUST_PROXY` está vacío. Se conserva desactivado: una cabecera `X-Forwarded-For` por sí sola no demuestra que exista un proxy confiable. Para un túnel ejecutado en este PC y conectado al backend por loopback, configurar `TRUST_PROXY=loopback` después de verificar esa topología; en un despliegue usar IP/CIDR o saltos exactos. No usar `true` ni desactivar la validación del limitador. Referencias: [Express](https://expressjs.com/en/guide/behind-proxies/) y [express-rate-limit](https://express-rate-limit.mintlify.app/reference/error-codes#err-erl-unexpected-x-forwarded-for).

`nodemon.json` vigila exclusivamente `src`; los archivos JSON/JS de cobertura y pruebas dejan de provocar ciclos de reinicio. Un `401` con sesión ausente requiere correlacionarlo con la acción y el momento; el registro compartido por sí solo no prueba pérdida de mensajes.

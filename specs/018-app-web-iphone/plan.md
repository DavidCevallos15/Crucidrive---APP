# 018 · Plan

Spec aprobada por David el 19 nov 2026, con las propuestas de W1 a W4. Para W5, David no tiene un iPhone ahora. La prueba en un iPhone real queda pendiente (T9), y mientras tanto se revisa con WebKit, el motor de Safari, y un iPhone emulado.

## P1 · Publicar la web (criterios 1, 3, 12 y 13)
- **Problema encontrado:** el proyecto `crucidrive-app` de Vercel nunca compiló la app. No tenía carpeta raíz, comando de compilación ni salida, así que cada despliegue tardaba unos 4 s, no publicaba nada y `crucidrive-app.vercel.app` respondía 404. Las «vistas previas» de los PR estaban vacías.
- `frontend/vercel.json`:
  - Compila con `npm ci` y `npx expo export --platform web`, y publica `dist`.
  - Toda ruta sin archivo cae en `index.html`, porque la app es de una sola página (`web.output: single`).
  - Cabeceras: `Cache-Control: no-cache` para `index.html`, `sw.js` y el resto, así una versión nueva llega en la siguiente apertura (criterio 3). `immutable` para `/_expo/static/*`, que lleva un hash en el nombre.
  - Seguridad: `X-Frame-Options: DENY`, `nosniff` y `Permissions-Policy`, con la ubicación y la cámara solo para la propia página.
- **Proyecto de Vercel:**
  - Carpeta raíz `frontend`. **La cambia David**: el modo automático no me deja cambiar la configuración del proyecto.
  - Variables `EXPO_PUBLIC_*` en producción y vista previa, con los mismos valores que el APK `preview`. Ya están cargadas.
  - Dominio `app.tricimoto.app` (W1). Ya está agregado. Falta el registro CNAME en Name.com, que agrega David.
- `tricimoto.app`, la página de confirmación del correo del 015, sigue en su propio proyecto (`tricimoto-web`) sin cambios.
- **Descartados:**
  - Un proyecto nuevo de Vercel, porque `crucidrive-app` ya está conectado al repositorio y ya hace las vistas previas de los PR.
  - Publicar `dist` a mano, porque cada fusión a `main` tiene que publicar sola.

## P2 · Caché sin conexión (criterios 3 y 10)
- `public/sw.js` ya sirve la navegación primero desde la red y, sin conexión, desde la caché. Los paquetes con hash se guardan después de la primera visita.
- Se sube la versión de la caché a `v3` para limpiar lo que hayan guardado las vistas previas.
- Riesgo aceptado: la primera carga baja unos 3,5 MB de JavaScript. Las siguientes salen de la caché.

## P3 · Guía de instalación (criterios 1 y 2, W4)
- `src/utils/instalarIphone.ts` es puro, para poder probarlo. Detecta iPhone o iPad, incluido el iPad que se presenta como Mac, si ya se abrió desde el ícono y si es Safari. Guarda en el almacenamiento del navegador que la persona cerró la guía, sin fallar si no hay almacenamiento.
- `AvisoInstalarIphone` va en el layout raíz y solo sale en la web, en un iPhone sin instalar y si la persona no la cerró. La misma guía está en Configuración → «Instalar en el iPhone», que lleva a Ayuda.
- `index.html` y `manifest.json` ya tenían `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-touch-icon` y `display: standalone` (criterio 2).

## P4 · Conductor en la web (criterio 11, W2)
- `ConductorSoloAndroidScreen` explica por qué hace falta la app de Android y ofrece «Cerrar sesión».
- En la web reemplaza el layout `(driver)` y la ruta `verificacion`. La guardia de rutas no cambia.

## P5 · Backend y correo (criterios 4 y 12)
- `ALLOWED_ORIGINS` en `/etc/crucidrive/api.env` de la VM incluye `https://app.tricimoto.app`. **Lo agrega David** y después reinicia el servicio. La API y el socket usan la misma lista.
- El enlace del correo sigue llevando a `tricimoto.app` (015). Después de confirmar, la persona abre CruciDrive desde el ícono. Supabase Auth no cambia.

## Pruebas
- `frontend/tests/appWeb018.test.ts`: guía, almacenamiento, montaje, `index.html` y `manifest`, conductor en la web, `vercel.json`, `sw.js` y que la app solo lea variables `EXPO_PUBLIC_*`.
- Revisión con WebKit 18.2 (Playwright) y un iPhone 13 emulado sobre `dist`. Es una herramienta temporal, fuera del repositorio: la guía sale en Safari, no vuelve tras «Entendido», no sale con la app instalada y no hay errores de JavaScript.
- Prueba en un iPhone real (T9): pendiente de W5.

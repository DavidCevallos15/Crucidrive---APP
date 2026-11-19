# 018 · Tareas

Cada tarea se tilda cuando su prueba pasa, nunca antes.

- [x] **T1 · `frontend/vercel.json`.** *Prueba (criterios 3, 12 y 13):* `appWeb018.test.ts` revisa el comando de compilación, la salida, la reescritura a `index.html` y las cabeceras de caché y seguridad. `expo export --platform web` compila en local.
- [x] **T2 · Caché sin conexión `v3`.** *Prueba (criterios 3 y 10):* la navegación va primero a la red y la caché solo se usa sin conexión; la versión de caché es `v3`.
- [x] **T3 · Guía de instalación.** *Prueba (criterios 1 y 2, W4):* `instalarIphone.ts` con 7 pruebas. En WebKit con un iPhone emulado, la guía sale en Safari, no vuelve tras «Entendido» y no sale con la app instalada.
- [x] **T4 · Conductor en la web.** *Prueba (criterio 11, W2):* la consola y la verificación remiten a Android en la web.
- [x] **T5 · Variables y dominio en Vercel.** *Prueba:* `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SOCKET_URL`, `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` están en producción y vista previa, y `app.tricimoto.app` está agregado al proyecto `crucidrive-app`.
- [ ] **T6 · David: carpeta raíz `frontend` en Vercel.** *Prueba:* el despliegue de este PR compila la web, tarda más de 4 s y la vista previa muestra CruciDrive.
- [ ] **T7 · David: registro DNS en Name.com.** `CNAME app → 32204ce3689949ae.vercel-dns-017.com`. *Prueba:* Vercel deja de marcar el dominio como mal configurado y `https://app.tricimoto.app` carga con HTTPS.
- [ ] **T8 · David: `ALLOWED_ORIGINS` en la VM.** Agregar `https://app.tricimoto.app` y reiniciar `crucidrive-api`. *Prueba (criterio 12):* desde `app.tricimoto.app` se inicia sesión y se pide un viaje; desde otro origen el navegador lo bloquea.
- [ ] **T9 · Prueba en un iPhone real (W5).** iOS 16.4 o más nuevo: instalar, crear cuenta, pedir, ver al conductor, «Llamar», chat, SOS y abrir sin internet (criterios 1 a 10). Pendiente: David no tiene un iPhone ahora.

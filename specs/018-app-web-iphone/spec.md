# 018 · CruciDrive en iPhone como app web instalable

Estado: **Aprobada por David el 19 nov 2026**, con las propuestas de W1 a W4. W5: David no tiene un iPhone ahora; la prueba en un iPhone real queda pendiente (T9). Ver `plan.md` y `tasks.md`.

> **Enmienda 1 (19 nov 2026, pedido de David): Google Maps también en la web.** Después de publicar, David pidió que el mapa se vea como en Google Maps en todos los teléfonos. W3 pasa a **c)**: la web usa Google Maps, con el mismo estilo claro que Android y con los marcadores (tricimotos cercanas, tu conductor y el punto del administrador). Necesita una clave propia de Google para la web, restringida a `app.tricimoto.app`, porque la clave del APK solo sirve en Android. Si la clave falta o Google no carga, la web vuelve al mapa de OpenStreetMap, y sin internet muestra el plano del 017. Criterios nuevos: 14 y 15.

## Por qué
David quiere usar CruciDrive en un iPhone. Un APK solo se instala en Android, y una app nativa para iPhone exige la cuenta de desarrollador de Apple (99 USD al año), que sale del presupuesto del piloto (regla 5). Además, D-02 deja el piloto en Android.

Un iPhone sí puede instalar una página web en la pantalla de inicio desde Safari. Se abre a pantalla completa, con su ícono, como una app. CruciDrive ya tiene casi todo lo necesario para eso: versión web, ícono, manifiesto y caché sin conexión, que hoy se usan solo para previsualizar. Lo que falta es publicarla en una dirección fija y cerrar lo que no funciona bien en el iPhone.

El iPhone limita a una web en tres cosas:

| Límite | Efecto |
| --- | --- |
| La ubicación solo se lee con la app abierta y en pantalla | Un **conductor** no puede compartir su ubicación con la pantalla apagada, así que no puede recibir ofertas (004) |
| Los avisos con la app cerrada son limitados | El pasajero se entera de que lo aceptaron con la app abierta, como en la web del 003 |
| No hay Google Maps nativo | El mapa es un mapa web sin marcadores, o el plano simple del 017 |

Por eso esta spec es para el **pasajero**. Los conductores siguen en Android.

## Historias
- Como **pasajero con iPhone**, quiero instalar CruciDrive desde Safari y abrirlo desde un ícono, sin tienda de apps.
- Como **pasajero con iPhone**, quiero crear mi cuenta, pedir una tricimoto, ver quién viene, llamarlo, chatear y usar el SOS, igual que en Android.
- Como **conductor con iPhone**, quiero saber claramente que para trabajar necesito un Android, en lugar de una consola que no recibe viajes.
- Como **David**, quiero que una corrección llegue al iPhone sin que el pasajero reinstale nada.

## Criterios de aceptación

### A. Instalar
1. **Dado** un iPhone con Safari, **cuando** el pasajero abre la dirección de CruciDrive (W1), **entonces** la app carga por HTTPS y una guía corta le dice cómo instalarla («Compartir → Añadir a pantalla de inicio»). La guía no vuelve a salir si ya está instalada o si la cerró.
2. **Dado** la app instalada, **cuando** el pasajero toca el ícono, **entonces** se abre a pantalla completa, sin la barra de Safari, con el nombre y el ícono de CruciDrive. El contenido no queda debajo de la muesca ni de la barra de inicio.
3. **Dado** una versión nueva publicada, **cuando** el pasajero vuelve a abrir la app, **entonces** recibe la versión nueva sin reinstalar. Una versión vieja guardada en caché nunca impide cargar la nueva más de una apertura.

### B. Cuenta
4. **Dado** un pasajero nuevo en el iPhone, **cuando** crea su cuenta y confirma el correo, **entonces** el enlace del correo lo lleva a la confirmación (015) y después puede entrar en la app instalada.
5. **Dado** un pasajero con sesión, **cuando** cierra y vuelve a abrir la app instalada, **entonces** sigue con su sesión.

### C. Pedir y viajar (pasajero)
6. **Dado** el pasajero en la pantalla principal, **cuando** permite la ubicación, **entonces** la app usa su GPS para el origen. Si no la permite, puede elegir el sector a mano (017, criterio 1).
7. **Dado** un pedido, **cuando** un conductor lo acepta con la app abierta, **entonces** el pasajero ve el nombre, la placa y el botón «Llamar», igual que en Android.
8. **Dado** un viaje activo, **cuando** el pasajero toca «Llamar» o el SOS, **entonces** se abre el marcador del iPhone con el número (el del conductor o el 911). El SOS además registra la alerta (regla del SOS en CLAUDE.md y 006).
9. **Dado** un viaje activo, **cuando** el pasajero abre el chat, **entonces** envía y recibe mensajes como en Android.
10. **Dado** el iPhone sin internet, **cuando** el pasajero abre la app instalada, **entonces** la app carga desde la caché y muestra «Sin internet» y el plano simple (017, criterio 2), en lugar de una página de error de Safari.

### D. Conductor en iPhone
11. **Dado** una cuenta de conductor, **cuando** entra desde el iPhone, **entonces** ve un mensaje claro: para recibir viajes necesita la app de Android, porque el iPhone no comparte la ubicación con la pantalla apagada. No ve un botón «Disponible» que no le traería ofertas (W2).

### E. Seguridad
12. **Dado** la app web publicada, **cuando** el backend recibe sus peticiones, **entonces** solo acepta el origen de la dirección de W1 (CORS por `.env`, como hoy). Las reglas de datos (RLS, 007) son las mismas que en Android.
13. **Dado** la app web, **cuando** se revisa lo que publica, **entonces** no contiene la clave de servicio ni ningún secreto. Solo lleva la URL de la API y la clave pública de Supabase, igual que el APK.

### F. Mapa (Enmienda 1)
14. **Dado** la app web con la clave de Google configurada, **cuando** el pasajero abre la pantalla principal, **entonces** ve Google Maps con el estilo claro de Android, su punto de ubicación si la permitió, las tricimotos cercanas y, durante el viaje, a su conductor.
15. **Dado** que falta la clave o Google no carga, **cuando** se abre el mapa, **entonces** la app muestra el mapa de OpenStreetMap y el resto de la pantalla sigue funcionando. Sin internet se ve el plano del 017.

## Decisiones de David
- **W1 · Dirección.**
  - a) `app.tricimoto.app`, un subdominio del dominio que ya tienes (propuesta). Es gratis, fácil de dictar y queda separado de la página de confirmación del correo.
  - b) `crucidrive-app.vercel.app`. Es gratis pero más largo, y cambia si cambia el proyecto.
- **W2 · Conductores en iPhone.**
  - a) Mensaje que remite a la app de Android, sin consola (propuesta).
  - b) Consola solo con la app abierta y la pantalla encendida. Recibiría ofertas a medias y gastaría la batería.
- **W3 · Mapa en el iPhone.**
  - a) El mapa web que ya existe (OpenStreetMap, sin marcadores) y, sin internet, el plano simple del 017. Durante el viaje se muestran la distancia y «Última posición hace X s», como en Android sin la clave de Maps (005, criterio 12) (propuesta).
  - b) Dibujar la tricimoto en el mapa web. Es más trabajo y va mejor en el 014 (mapa y recogida).
  - c) **Google Maps en la web, como en Android (Enmienda 1, elegida por David).** El uso de Google entra en el cupo gratuito mensual de Google Maps Platform si se pone un tope diario de cargas del mapa en Google Cloud (regla 5).
- **W4 · Guía de instalación.** Propuesta: un aviso pequeño la primera vez, que se puede cerrar, y la misma guía en Configuración → «Instalar en el iPhone».
- **W5 · Teléfono para la prueba.** ¿Tienes un iPhone para la prueba de campo? ¿Qué versión de iOS tiene? En Ajustes → General → Información. La propuesta es exigir iOS 16.4 o más nuevo y probar en ese teléfono.

## Fuera de alcance
- App nativa para iPhone, App Store y TestFlight. Se puede retomar si un conductor la necesita (cambiaría D-02).
- Avisos con la app cerrada en el iPhone.
- El modo conductor en el iPhone (W2).
- Pedir por SMS desde el iPhone (017, partes B a G). Una web no puede abrir la aplicación de mensajes con el mismo control que en Android; se evalúa en el 017.
- Cambios en el backend, salvo agregar el origen nuevo a `ALLOWED_ORIGINS`.

## Riesgos
- **Caché vieja:** si la caché sin conexión guarda una versión rota, el pasajero se queda con ella. El criterio 3 lo cubre.
- **Safari cambia:** Apple cambia lo que puede hacer una web instalada. Por eso la prueba de campo es en el iPhone real (W5).
- **Sesión:** si el iPhone pasa semanas sin abrir la app, Safari puede borrar los datos guardados y pedir iniciar sesión otra vez. Es aceptable, pero el pasajero no debe perder nada más.

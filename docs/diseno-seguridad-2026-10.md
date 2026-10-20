# Diseño y seguridad de CruciDrive · 20 de octubre de 2026

## Cambios aplicados

- Identidad costera, moderna y tecnológica confirmada por el usuario. Símbolo C/ruta/ola, océano oscuro, turquesa y arena. Fondo original generado para la marca; es una ilustración, no una fotografía documental de Crucita.
- Acceso adaptable, registro con selector de modo, iconos Ionicons coherentes, mostrar/ocultar contraseña, errores por campo, bloqueo durante envíos y protección frente a doble envío. Se conservan acceso, registro y exploración del mapa.
- Componentes y tokens compartidos actualizados. Botones de al menos 44 px, crecimiento con texto, indicadores accesibles, foco web y zoom habilitado. Perfil con marca y sin puntuaciones ni verificaciones ficticias.
- Iconos opacos de instalación y PWA, foreground transparente de Android, máscara monocroma blanca y splash. Originales y prompts en `frontend/assets/brand`; `npm run brand:assets` reproduce tamaños y formatos mediante ffmpeg.
- Sesiones nativas en Expo SecureStore, cifradas con Keychain/Keystore. Migración desde AsyncStorage, sin fallback a texto plano; fragmentos para sesiones de más de 2 KB, publicación atómica y operaciones serializadas.
- Cambio de cuenta limpia perfil, rol y verificación anteriores. Errores inesperados de acceso pasan por mensajes públicos conocidos.
- Las respuestas asíncronas de perfil/verificación comprueban la generación de la sesión antes de modificar datos, también al volver a la misma cuenta. El logout intenta ambas limpiezas y comprueba el resultado de Auth: si falla la red, conserva la cuenta visible y muestra un error para reintentar; no simula una salida que restauraría credenciales al abrir de nuevo. No se implementó logout sin conexión.
- API con `Cache-Control: no-store`. PWA con lista explícita de recursos públicos; excluye autenticación, API, fotos privadas, URLs con parámetros y peticiones con Authorization. Respeta no-store/private y solo limpia sus propias cachés.
- Parches compatibles de Expo SDK 57 y dependencias. Se conserva Jest 30, usado por las pruebas existentes; Expo recomienda Jest 29, pero esa sustitución incrementaba las alertas de dependencias. Las pruebas propias usan ts-jest, no jest-expo.

## Recursos examinados

| Recurso | Decisión |
| --- | --- |
| [expo/skills](https://github.com/expo/skills) | Instalados y consultados expo-design-system y expo-native-ui. Aplicados sobre el tema existente, accesibilidad y recursos nativos. |
| [Code-with-Beto/skills](https://github.com/Code-with-Beto/skills) | Instalados app-icon y theming. Consultadas sus reglas; adaptados formatos y área segura. Se conserva una única fuente de tokens. |
| [aso-skills](https://github.com/appeeky/aso-skills) | Instalado aso-audit. Borrador local de metadatos más abajo; sin inventar auditorías de rankings, competidores o reseñas. |
| [designed-by-ai/skills](https://github.com/designed-by-ai/skills) | Integración de Sleek: requiere SLEEK_API_KEY y cuenta. No necesaria para implementar en este repositorio. |
| [android-reverse-engineering-skill](https://github.com/SimoneAvogadro/android-reverse-engineering-skill) | Especializado en analizar APK; no es una auditoría del código fuente ni aporta a este rediseño. |
| [SnapAI](https://github.com/Code-with-Beto/snapai) | CLI de generación con clave propia. Se usó el generador integrado disponible para evitar configurar un proveedor adicional. |

Se siguió el criterio del texto compartido: stack oficial primero, preparación de tienda después. No se añadió un framework de agentes ni se cambió Supabase.

## Borrador ASO para Ecuador

Propuesta para revisar antes de publicar; no se cambió el nombre instalado de la app.

- Título: **CruciDrive: tricimotos Crucita**.
- Subtítulo iOS: **Tu tricimoto en Crucita**.
- Descripción corta Android: **Pide una tricimoto en Crucita y sigue tu viaje desde la app.**
- Descripción: «Muévete por Crucita con CruciDrive. Elige tu origen y destino, solicita una tricimoto y consulta el estado de tu viaje. Comunícate con tu conductor desde el chat. Si conduces, registra tu perfil y tu unidad, completa la verificación y recibe solicitudes cuando estés disponible».
- Capturas a preparar con datos de prueba identificados: mapa/destino, solicitud, seguimiento, chat y consola del conductor. Icono sin texto pequeño y con área segura.

No se dispone de una ficha publicada ni acceso a métricas de tienda. No se asigna puntuación ASO ni se prometen mejoras de ranking.

## Verificación y límites

Pruebas de sesión cubren migración, Unicode, fallos del almacén seguro, limpieza al salir y concurrencia entre refresco/logout. Pruebas de PWA cubren API, URLs firmadas, Authorization, no-store, iconos públicos y aislamiento entre cachés. Se añadió cobertura de cambio de cuenta y no-store del backend.

Resultado final: **307 pruebas frontend + 278 backend = 585 pruebas**, todas correctas; TypeScript sin errores. Export web de producción y bundle Android/Hermes generados correctamente. Validación funcional en navegador: campos vacíos, cambio de acceso/registro, mostrar/ocultar contraseña y mínimo de registro, sin enviar credenciales a un servicio. Capturas de acceso a 390 × 845 y 1440 × 900 en `.impeccable/review`. Sin desbordamiento del documento en esos tamaños.

Revisión independiente: disposición `ship` para el alcance revisado, después de resolver el bloqueo de respuestas de otra sesión y el falso cierre de sesión. El detector mecánico se ejecutó una vez; se corrigió el color heredado del HTML. No equivale a certificación de seguridad ni a una prueba física en Android/iOS.

La auditoría npm del frontend quedó con **0 críticas, 20 altas y 31 moderadas** (inicialmente 2 críticas, 31 altas y 14 moderadas). El número total no es un porcentaje de riesgo; varias alertas son transitivas y pertenecen al toolchain de Expo. No se ejecutó audit fix --force ni una migración de SDK. Backend en dependencias de producción: **0 alertas**. Repetir auditorías antes de publicar, porque los avisos cambian.

SecureStore se aplica en Android/iOS; web conserva el almacenamiento del navegador y exige protección frente a XSS. Los tests y el empaquetado no sustituyen la prueba de Keychain/Keystore en dispositivos. El cambio de plugins, iconos y almacenamiento requiere una **nueva compilación nativa**; una actualización OTA no basta para añadir el módulo.

Pendiente de release: probar APK/iOS en dispositivo, login y logout en línea/sin conexión, migración con sesión existente, notificaciones y GPS con pantalla bloqueada; revisar permisos, URL de privacidad, controles de datos y límites de Auth en Supabase; validar políticas RLS y configuración real con un entorno de pruebas. No se modificó ningún servicio remoto ni se publicó una app.

Vista local: `npm run build:web` y después `npm run preview:web`, desde frontend. Abrir http://127.0.0.1:8082/login.

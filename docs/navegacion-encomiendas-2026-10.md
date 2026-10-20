# Navegación y encomiendas · 20 de octubre de 2026

## Referencia analizada

Video local `WhatsApp Video 2026-10-20 at 02.29.28.mp4`, duración 53,9 s. Se inspeccionaron 18 fotogramas a intervalos de 3 s y sus pantallas de mapa y selección de ruta. Se observa botón de menú, categorías de servicio, búsqueda de recogida/destino y selección en mapa. El video no enseña el contenido de un menú de configuración abierto: sus secciones se diseñaron para las funciones reales de CruciDrive.

## Adaptación aplicada

- Mapa como pantalla principal, botón de menú visible y panel lateral con marca y cuenta.
- Solo dos servicios: Tricimoto y Encomienda. No se agregan automóviles, carga pesada ni viajes interprovinciales.
- Configuración accesible a visitantes y cuentas de cualquier rol. Ubicación y notificaciones muestran estados reales; las acciones solicitan permisos o abren ajustes según la plataforma.
- Cuenta con consulta y exportación de datos del perfil, y eliminación permanente protegida por contraseña y confirmación. La API usa un cliente aislado para reautenticar, bloquea servicios activos y limpia fotos y mensajes antes de eliminar el usuario. La clave de servicio permanece solo en el servidor.
- Privacidad (borrador 0.3), seguridad y emergencias, ayuda y explicación de servicios, tarifas y versión. Sin contactos de soporte inventados ni promesas de certificación legal.
- SOS abre la llamada al 911 tras la pulsación sostenida; no promete avisos automáticos a una central.
- Precio de encomiendas **acordado con el conductor**, decisión confirmada por el usuario. NULL expresa precio no fijado; nunca se muestra como servicio gratuito.
- Solicitud de encomienda con origen, destino, contenido, destinatario y autorización para compartir sus datos. El conductor recibe el tipo y las referencias de la ruta antes de aceptar, pero no el contenido ni el destinatario. Una tabla privada con RLS limita esos datos al solicitante, conductor asignado y administrador.

## Activación del backend

Aplicar `supabase/migrations/0015_encomiendas.sql` antes de desplegar el nuevo frontend y backend. La migración agrega el tipo de servicio, tabla privada, políticas y RPC transaccional; conserva el cálculo por persona para viajes. Desplegar backend actualizado con clave de servicio para despacho y eliminación de cuentas. No se ha ejecutado ninguna eliminación real ni se ha alterado una base remota desde esta tarea.

Docker Desktop no está iniciado en esta máquina, por lo que no se pudieron ejecutar las pruebas reales de PostgreSQL/PostGIS. Se incluye `supabase/tests/rls_005.sql` para comprobar acceso del solicitante, privacidad antes de aceptar, acceso del asignado y aislamiento de otras cuentas cuando se ejecute el runner. No se presenta ese SQL como probado en una base activa.

## Antes de publicar

Probar permisos, notificaciones y apertura del marcador en un teléfono. Configurar responsable y contacto real en el aviso de privacidad y revisar el borrador con el responsable legal. La existencia de estas pantallas no certifica cumplimiento. Validar una política de retención y el flujo de eliminación de cuenta en un entorno de pruebas.

Referencias de plataforma: [Apple: eliminación de cuentas](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) y [Google Play: eliminación de datos](https://support.google.com/googleplay/android-developer/answer/13327111).

## Evidencia de continuidad visual y alcance de revisión

La pasada de documentación de Impeccable contrastó `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `AppMenuButton.tsx`, `SettingsScreen.tsx` y `MapScreen.tsx` con las seis capturas de `.impeccable/review/navigation/`: `map-mobile.jpg`, `menu-mobile.jpg`, `parcel-mobile.jpg`, `parcel-validation-mobile.jpg`, `settings-mobile.jpg` y `settings-desktop.jpg`.

La extensión conserva la identidad aprobada: marino de base, selección turquesa, acción arena, Outfit e Inter, controles compartidos y mensajes de error explícitos. Las capturas muestran menú lateral con marca, dos servicios, precio a convenir, campos de entrega con autorización, error de validación y configuración legible en móvil y escritorio. El menú, el ancho de configuración y la composición de encomiendas son decisiones de estas superficies; no establecen nuevos tokens ni reglas globales. `DESIGN.md` y su sidecar se mantienen sin cambios.

La revisión independiente comunicó disposición «ship» para la presentación web responsive. La ejecución reportada registra 603 pruebas aprobadas (frontend 314, backend 289) y TypeScript sin errores. Esta pasada documental no volvió a ejecutar esas pruebas ni convierte capturas en evidencia de funcionamiento nativo, permisos del sistema, apertura real de llamadas, eliminación efectiva de cuentas o privacidad SQL aplicada. La migración 0015 y su validación PostgreSQL/PostGIS siguen pendientes por Docker apagado, como se detalla arriba.

Se conserva fuera de la norma global la deriva previa de colores y movimiento del chat y los controles heredados con forma de píldora. No se reparó implementación ni se añadieron rasters productivos durante esta pasada.

Comprobación final: exportaciones Expo web y Android completadas; la exportación Android genera el bundle, no un APK instalable. El cierre local tras eliminar una cuenta comprueba que la sesión siga perteneciendo a quien inició la operación para no cerrar una cuenta distinta. TypeScript y las cinco pruebas existentes del aislamiento de respuestas por sesión pasan tras esa protección.

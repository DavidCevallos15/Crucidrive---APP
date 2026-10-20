# 009 · Plan técnico

La spec registra el alcance solicitado y la formalización posterior; este plan describe lo que se preparó localmente y lo pendiente. No añade servicios ni cambia el stack.

## Interfaz y navegación

Conservar Expo Router, Zustand, Outfit/Inter y tokens de `frontend/src/constants/theme.ts`. `BrandLockup`, recursos de marca y `AuthScaffold` comparten la identidad. `AppMenuButton` abre un modal lateral; rutas `(settings)` sirven cuenta, configuración, seguridad, ayuda, privacidad y acerca. `useServiceStore` elige viaje/encomienda y `MapScreen` reutiliza la selección de lugares/sectores.

Decisión: adaptar componentes y rutas existentes. Alternativa descartada: introducir otro sistema de navegación, reemplazar el stack o copiar categorías ajenas del video.

## Encomiendas y despacho

La migración nueva `0015_encomiendas.sql` agrega `viajes.tipo_servicio` y la tabla privada `encomiendas`, con descripción, destinatario y autorización. RLS limita lectura al solicitante, asignado y administrador. El trigger de tarifa conserva el cálculo de pasajeros y usa NULL para precio de encomienda no fijado. La RPC `solicitar_encomienda` inserta servicio y datos privados en una transacción; una restricción diferida impide servicios incompletos.

`POST /api/viajes/solicitar` valida tipo y datos, fuerza un solo servicio para encomiendas y usa el cliente `req.supabase`. La oferta de despacho y su representación por aviso incluyen el tipo y precio no fijado; no llevan destinatario ni contenido. Después de aceptar se leen los detalles con el cliente autorizado del conductor. Se reutilizan estados y eventos existentes, sin nuevos eventos de socket ni cambios de asignación.

Decisión: separar metadatos privados. Alternativa descartada: colocarlos en filas de viajes visibles a candidatos mediante las políticas de ofertas. Decisión de precio: conservar NULL y texto explícito; se descarta reutilizar 0,50 USD o cero.

## Cuenta y seguridad

`DELETE /api/auth/cuenta` exige JWT, contraseña y confirmación ELIMINAR, bajo el limitador de autenticación existente. Un cliente Auth aislado comprueba la contraseña y el mismo identificador sin modificar el cliente compartido. El servidor revisa servicios activos, borra archivos propios de Storage y llama a una RPC solo ejecutable por service role. La función privada bloquea usuario/perfil, vuelve a comprobar actividad y elimina mensajes propios, detalles propios de encomiendas y usuario Auth. Los registros históricos conservan sus reglas de desvinculación existentes.

El cliente privilegiado se reserva para esta operación del sistema, imposible con los permisos ordinarios de Auth, después de la reautenticación. Alternativa descartada: exponer la clave de servicio o permitir una RPC privilegiada directamente al usuario. Storage y PostgreSQL no forman una transacción global: si la segunda fase falla puede haber archivos ya eliminados; debe probarse recuperación y reintento antes de publicar.

En móvil, `expo-secure-store` sustituye el almacenamiento de sesión en texto plano, migra sesiones anteriores, fragmenta valores grandes y serializa operaciones. En web se conserva el almacenamiento del navegador. Las respuestas asíncronas verifican la sesión propietaria. API usa no-store y el service worker limita caché a recursos públicos. Se actualizan parches compatibles de Expo; no se fuerza una migración de SDK.

Decisión: un módulo nativo oficial para proteger sesiones. Alternativa descartada: seguir guardando tokens nativos en AsyncStorage o añadir un proveedor externo. Requiere nueva compilación nativa, no basta OTA.

## Consentimiento y activación

Frontend y backend usan versión 0.3, con tratamiento de datos de entrega. El texto continúa como borrador pendiente de responsable/contacto y revisión legal. El SOS abre el marcador; el registro de alerta de D-05 no se da por implementado.

Orden: validar migraciones 0001–0015 y scripts RLS en base limpia de pruebas; revisar advisors; aplicar 0015; desplegar backend y frontend; compilar APK y verificar en dispositivo. No fusionar este PR con esas validaciones pendientes. Docker Desktop apagado impidió ejecutar las pruebas SQL locales; no se alteró la base remota.

## Evidencia

Pruebas unitarias descritas en `tasks.md`; exportaciones web y Android completadas y TypeScript sin errores. Capturas y límites en `docs/diseno-seguridad-2026-10.md` y `docs/navegacion-encomiendas-2026-10.md`. El CI existente ejecuta ambas suites y audita las dependencias de producción del backend; no reemplaza pruebas de RLS ni de teléfono.

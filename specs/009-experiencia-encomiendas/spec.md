# 009 · Identidad, navegación, cuenta y encomiendas

Estado: **implementación local, pendiente de revisión del PR y de validación de base de datos y teléfono**.

## Origen y autorización del alcance

David solicitó mejorar diseño, seguridad, logo e iconos y eligió una identidad «costera moderna tecnológica». Después pidió adaptar la navegación del video de referencia, un menú desplegable y configuración para las funciones de CruciDrive: tricimotos y encomiendas. Confirmó «Precio acordado con el conductor» para las encomiendas y solicitó subir los cambios siguiendo las reglas del repositorio el 20 de octubre de 2026.

Esta carpeta formaliza esas instrucciones sin renumerar los pasos 005–008 del MVP. La documentación se redactó después de la implementación local: es una desviación de la regla «spec primero», no una aprobación documental retroactiva. El PR queda en borrador para revisión; no se declara aprobado ni listo para producción por tener pruebas unitarias en verde.

## Por qué

La marca y los controles deben expresar movilidad local de Crucita; la navegación debe reunir servicios y configuración sin añadir modalidades ajenas. El usuario necesita entender el precio de las encomiendas, controlar permisos y datos de su cuenta y distinguir claramente los límites de seguridad y asistencia.

## Historias

- Como visitante, quiero reconocer CruciDrive y explorar el mapa, el acceso y la configuración.
- Como pasajero, quiero elegir entre viajar en tricimoto y enviar una encomienda, indicando recogida y entrega.
- Como solicitante, quiero acordar el precio con el conductor sin que aparezca una tarifa automática ni un servicio gratuito.
- Como conductor, quiero distinguir una encomienda y recibir sus datos privados cuando me sea asignada.
- Como titular de una cuenta, quiero consultar y exportar mi perfil y poder eliminar mi cuenta con confirmación de identidad.

## Criterios de aceptación

1. **Dado** el acceso, **cuando** se muestra en móvil o escritorio, **entonces** conserva la identidad costera, etiquetas legibles, registro e inicio de sesión, errores comprensibles y bloqueo de envíos duplicados.
2. **Dado** el mapa, **cuando** se abre el menú, **entonces** ofrece únicamente los servicios Tricimoto y Encomienda al pasajero/visitante, y accesos a configuración, seguridad, ayuda, privacidad e información de la app según la cuenta.
3. **Dado** un visitante o una cuenta de cualquier rol, **cuando** entra en configuración, **entonces** puede consultar permisos y ayuda; los datos privados de cuenta requieren sesión.
4. **Dado** un viaje de pasajeros, **cuando** se solicita, **entonces** conserva la tarifa por persona vigente. **Dada** una encomienda, **cuando** se presenta o solicita, **entonces** indica precio a convenir con el conductor, sin calcularlo por personas ni mostrarlo como cero.
5. **Dada** una encomienda, **cuando** falta contenido, destinatario o autorización para compartir los datos, **entonces** no se solicita; con datos válidos conserva recogida, entrega y un solo servicio.
6. **Dada** una oferta de encomienda, **cuando** un conductor aún no está asignado, **entonces** no recibe contenido ni destinatario. Solo los consultan el solicitante, conductor asignado y administrador.
7. **Dado** un titular, **cuando** consulta su cuenta, **entonces** puede exportar los datos de su propio perfil sin incluir credenciales ni datos de otras cuentas.
8. **Dada** una eliminación de cuenta, **cuando** faltan contraseña válida o confirmación explícita, o existe un servicio activo, **entonces** se rechaza; los datos a eliminar pertenecen exclusivamente a la cuenta autenticada.
9. **Dado** un cambio de cuenta, **cuando** termina una respuesta de la sesión anterior, **entonces** no reemplaza los datos de la cuenta actual ni cierra una cuenta distinta tras una eliminación.
10. **Dada** una sesión guardada en el teléfono, **cuando** se migra o actualiza, **entonces** se conserva en almacenamiento protegido y un fallo no provoca una copia en texto plano. La caché web excluye datos privados y autenticación.
11. **Dado** el botón de emergencia, **cuando** se mantiene pulsado dos segundos, **entonces** abre el marcador al 911 y explica que no alerta automáticamente a una central. El registro de alertas del paso 006 sigue pendiente.
12. **Dados** los permisos del teléfono, **cuando** se consultan o cambian, **entonces** reflejan el estado del sistema; la app no finge permisos o avisos no disponibles en la plataforma.

## Fuera de alcance

Automóviles, motos de dos ruedas, transporte pesado, viajes interprovinciales, pagos en línea, fijar o registrar el importe negociado, prueba de entrega, publicación en tiendas, certificación legal y completar los pasos 005–008. No se implementa la central de alertas ni se presenta el borrador de privacidad como revisado legalmente.

## Condiciones para fusionar y publicar

Validar las políticas y eliminación de cuenta en una base de pruebas, revisar los avisos del servidor y verificar permisos y almacenamiento seguro en teléfono. La migración debe estar validada antes de fusionar: la integración del repositorio puede aplicar migraciones al llegar a `main`.

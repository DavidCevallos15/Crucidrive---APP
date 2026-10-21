# Campo 012 · Navegación y mapa

Mode: Operate. Platform: adaptive. Extensión del sistema 011, sin nueva dirección visual ni comp de reemplazo.

## Autoridad

David aprobó en este chat el 20 oct 2026: menú arriba a la izquierda, cuenta dentro del menú, SOS y sector dentro de la hoja, aviso fuera de Crucita; A: nombre + sector, ocultos solo mediante filtro; B: aviso al conductor sin bloqueo de disponibilidad durante el piloto.

## Contrato de dirección

OWN-WORLD: conservar papel #FFFCF7, vino #7F1139, arena #FEE8C1, azul #88AEE0, Outfit/Inter y tricimoto propia. Las tarjetas oscuras de ofertas del conductor conservan sus contrastes. No imágenes ni fuentes nuevas.

COMPOSICIÓN: un menú a la izquierda y mapa libre de cuenta/sector/SOS flotantes; cabecera fija de la hoja con ubicación y SOS de 64 puntos; contenido desplazable debajo. Áreas seguras y atribución del mapa visibles. Panel modal hasta 360 de ancho, filas 56, cierre 48.

INTERACCIÓN: apertura mediante botón y borde de 24 puntos únicamente en pantallas principales con menú; mantener gesto Atrás del sistema en ajustes secundarios. Cierre por deslizamiento izquierdo, exterior, cierre y Atrás. Spring 300 ms, sin rebote, ReduceMotion.System; actualización del arrastre en UI thread. Sin movimiento ornamental nuevo.

QUALITY BAR: tareas localizables en segundos, ninguna acción tapada por SOS, contenido legible en 360×640, conservar estado durante errores, ningún resultado viejo presentado bajo filtros nuevos. No confundir mapa web con prueba Android.

## Evidencia y límites

Capturas web en `.impeccable/review/campo012/`: mapa, menú, ficha, encomienda y configuración a 360×640; mapa a 1280×800. Selección manual de origen y destino, servicio y apertura/cierre/configuración comprobados sin enviar solicitudes.

Pruebas: frontend 381, backend 368; TypeScript y export web correctos. Sin ADB ni Android conectado; no hay sesión admin en el navegador. Los gestos nativos, estados activos con cuentas reales, filtro admin en dispositivo y recepción de mensajes siguen pendientes. El SOS actual abre el marcador; el registro de alertas de D-05 corresponde al paso 006 aún sin implementar.

No detector web: plataforma adaptive; revisión conforme a las convenciones nativas, sin certificar lo no observado.

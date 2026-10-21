# Corrección de usabilidad · Referencia libre (criterio 20)

Solicitada por David el 20 oct 2026. Ejecuta el respaldo ya aprobado en D-09 y el criterio 20; no crea un catálogo colaborativo.

## Plan

- Ofrecer «Usar este nombre» desde una búsqueda con al menos dos caracteres, incluso con resultados, fallo o carga. El nombre puede ajustarse después.
- Pedir el sector del lugar, incluidos destinos dentro del mismo sector de origen. Mantener el nombre como `origenNota` o `destinoNota`, usando las coordenadas aproximadas del sector que ya admite el contrato existente. Mostrar nombre + sector en ficha/solicitud; permitir editar la referencia. No escribir en `lugares` ni añadir geocodificación externa.
- Mantener selección, errores y datos de encomienda existentes; volver al buscador sin borrar nombre por una respuesta tardía.
- Corregir el CORS de la vista local 8082 mediante orígenes exactos en el ejemplo/default de desarrollo y la configuración local ignorada por Git. Respetar una lista explícita en producción, sin comodines ni desactivar JWT/RLS. Verificar preflight con Authorization y rechazo de otro origen.

## Tareas y evidencia

- [x] R1 · Nombre libre en origen/destino, sector obligatorio, sin publicación en catálogo. Prueba: nombre + sector generan descripciones correctas en la solicitud y no IDs de lugares; vacíos/sector inválido no avanzan. `tests/referenciaLibre.test.ts`.
- [x] R2 · Flujo en 360×640 y 1280×800, disponible durante búsqueda sin depender de resultados; ficha con nombre editable. Prueba web y revisión independiente: borrado al sustituir un punto corregido y verificado. Sin inducción de caída real de Supabase; disponibilidad en error revisada por código. Android físico pendiente.
- [x] R3 · CORS exacto para localhost/127.0.0.1:8082, con lista de producción respetada. Pruebas preflight, JWT y origen ajeno; OPTIONS real a la API LAN devolvió 204 y origen permitido exacto. Configuración local `.env` corregida sin subirla a Git.
- [ ] R4 · Suites/TypeScript/export, documentación, registro, commit y PR hacia main.

## Evidencia de cierre

- 388/388 frontend, 388/388 backend, TypeScript y export web correctos.
- Capturas `.impeccable/review/referencia-libre/`: selección, ficha y encomienda móvil; ficha amplia; transición a otro sector con nombre previo borrado.
- Navegador: nombre vacío deshabilita sectores; selección de origen/destino libres en Malecón; volver al buscador conserva nombre; cambiar origen libre por sector La Boca vacía el nombre y conserva destino/datos de encomienda; elegir nombre libre nuevamente lo reasigna sin perderlos.
- Revisión independiente: hallazgo de referencia antigua resuelto, verdict **ship limitado a esa corrección y evidencia web**. Sin Android físico ni envío real de solicitudes.
- Aclaración previa al código: `60807a3`.

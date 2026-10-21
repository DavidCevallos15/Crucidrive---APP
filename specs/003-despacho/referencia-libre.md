# Corrección de usabilidad · Referencia libre (criterio 20)

Solicitada por David el 20 oct 2026. Ejecuta el respaldo ya aprobado en D-09 y el criterio 20; no crea un catálogo colaborativo.

## Plan

- Ofrecer «Usar este nombre» desde una búsqueda con al menos dos caracteres, incluso con resultados, fallo o carga. El nombre puede ajustarse después.
- Pedir el sector del lugar, incluidos destinos dentro del mismo sector de origen. Mantener el nombre como `origenNota` o `destinoNota`, usando las coordenadas aproximadas del sector que ya admite el contrato existente. Mostrar nombre + sector en ficha/solicitud; permitir editar la referencia. No escribir en `lugares` ni añadir geocodificación externa.
- Mantener selección, errores y datos de encomienda existentes; volver al buscador sin borrar nombre por una respuesta tardía.
- Corregir el CORS de la vista local 8082 mediante orígenes exactos en el ejemplo/default de desarrollo y la configuración local ignorada por Git. Respetar una lista explícita en producción, sin comodines ni desactivar JWT/RLS. Verificar preflight con Authorization y rechazo de otro origen.

## Tareas y evidencia

- [ ] R1 · Nombre libre en origen/destino, sector obligatorio, sin publicación en catálogo. Prueba: nombre + sector generan descripciones correctas en la solicitud y no IDs de lugares; vacíos/sector inválido no avanzan.
- [ ] R2 · Flujo visible en 360×640, error de búsqueda y ficha con nombre editable. Prueba web y revisión independiente; Android físico pendiente.
- [ ] R3 · CORS exacto para localhost/127.0.0.1:8082, con lista de producción respetada. Prueba de preflight y verificación contra backend local.
- [ ] R4 · Suites/TypeScript/export, documentación, registro, commit y PR hacia main.

# 012 · Ajustes de campo (2): menú, SOS y ubicación fuera de Crucita

Estado: **Aprobada por David el 20 oct 2026 en este chat.** Decisiones: buscar lugares por nombre y sector, ocultos solo mediante filtro; fuera de Crucita, avisar al conductor sin impedir su disponibilidad durante el piloto. Sale de la prueba en el emulador y en el teléfono del 20 al 21 oct 2026, con el APK del 011.

## Por qué
En esa prueba David encontró dos grupos de problemas:

- **Bugs.** Ya están corregidos en el PR de esta spec y no necesitan aprobación: cerrar sesión se colgaba, el teclado tapaba el chat, los mensajes que no salían no avisaban, había íconos blancos sobre fondo claro y el aviso de contraseña vacía casi no se veía.
- **Cosas de diseño que cambian lo que ve la gente.** Esas van en esta spec:
  - El botón del menú está arriba a la **derecha**, pero el menú se abre desde la **izquierda**. Además, no se puede abrir deslizando.
  - «Mi cuenta» es un botón suelto sobre el mapa, fuera del menú.
  - El SOS flota sobre el mapa y tapa parte de él.
  - «Estás en Loma» (el sector actual) también flota sobre el mapa.
  - En el emulador, la tricimoto aparecía en Madrid. El emulador no estaba en Crucita, pero la app tampoco avisa cuando el GPS está fuera de la zona de servicio.

## Historias
- Como **cualquier usuario**, quiero abrir el menú desde arriba a la izquierda o deslizando desde el borde izquierdo, y cerrarlo deslizando hacia la izquierda, como en las apps que ya uso.
- Como **usuario con cuenta**, quiero encontrar «Mi cuenta» dentro del menú, junto a lo demás.
- Como **pasajero**, quiero ver el mapa completo sin botones flotantes encima, y seguir teniendo el SOS a un toque.
- Como **pasajero o conductor fuera de Crucita**, quiero que la app me diga que estoy fuera de la zona de servicio en lugar de mostrarme lejos sin explicación.

## Criterios de aceptación

### Menú
1. **Dado** cualquier pantalla con menú, **cuando** la abro, **entonces** el botón está arriba a la izquierda y el menú se abre desde la izquierda.
2. **Dado** el mapa o la consola, **cuando** deslizo desde el borde izquierdo hacia la derecha, **entonces** el menú se abre. **Cuando** lo deslizo hacia la izquierda o toco fuera, se cierra. Deslizar no debe mover el mapa por error: solo cuenta desde el borde.
3. **Dado** un usuario con sesión, **cuando** abre el menú, **entonces** ve «Mi cuenta» dentro del menú y ya no hay botón «Mi cuenta» sobre el mapa. Sin sesión, el menú muestra «Iniciar sesión o crear cuenta».

### SOS y sector
4. **Dado** el mapa del pasajero, **cuando** lo miro, **entonces** el SOS ya no flota sobre el mapa: está en una zona fija de la hoja de abajo, visible sin desplazarse en 360 × 640, en todos los estados (pedir, buscando, aceptado, en curso). Mantenerlo pulsado dos segundos abre el marcador con el 911. Esta reubicación conserva ese comportamiento actual; el registro de alertas de D-05 sigue pendiente del paso 006 y no se presenta como implementado.
5. **Dado** el mapa del pasajero, **cuando** la app sabe en qué sector estoy, **entonces** el sector («Estás en Loma») aparece dentro de la hoja, junto al punto de salida, y no flota sobre el mapa.
6. **Dado** la consola del conductor, **cuando** la miro, **entonces** el SOS tampoco tapa la tarjeta del viaje ni sus botones.

### Fuera de Crucita
7. **Dado** un GPS fuera de la zona de servicio de Crucita, **cuando** el pasajero abre el mapa, **entonces** ve «Estás fuera de la zona de servicio de Crucita» y el mapa se centra en Crucita. No puede usar su GPS como punto de salida, pero sí elegir un lugar o un sector.
8. **Dado** un conductor con el GPS fuera de la zona, **cuando** abre la consola o intenta ponerse disponible, **entonces** ve el aviso «Estás fuera de la zona de servicio de Crucita». Durante el piloto puede cambiar su disponibilidad; las reglas actuales del servidor siguen decidiendo el resultado.

### Lugares del administrador
9. **Dado** el catálogo del administrador, **cuando** lo abre, **entonces** ve solo lugares visibles. Puede buscar por nombre y elegir un sector; ambos filtros se combinan antes de limitar los resultados.
10. **Dado** ese catálogo, **cuando** elige «Ocultos» o «Todos», **entonces** puede consultar los lugares desactivados conservando búsqueda y sector. Cambiar filtros indica la carga y no muestra resultados viejos como si pertenecieran al filtro nuevo.

## Decisiones y validación de campo
- **A, confirmada:** filtrar por sector y buscar por nombre; ocultos solo con filtro.
- **B, confirmada:** solo avisar al conductor durante el piloto; sin bloqueo geográfico nuevo en el servidor.
- **Aprobación confirmada:** menú, cuenta, SOS y aviso fuera de Crucita, incorporando A y B.
- Si se repite un cierre inesperado con el APK del PR #58, capturar `adb logcat` del momento. No se considera reproducido ni resuelto por estas mejoras de navegación.

## Fuera de alcance
- Las pantallas del pasajero del viaje en curso (cancelar con motivo, confirmar, calificar): son el PR 4 del 005, con spec ya aprobada.
- Cambiar la paleta del 011.
- Tema oscuro.

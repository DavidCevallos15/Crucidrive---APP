# 012 · Ajustes de campo (2): menú, SOS y ubicación fuera de Crucita

Estado: **Borrador, pendiente de aprobación de David.** Sale de la prueba en el emulador y en el teléfono del 20 al 21 oct 2026, con el APK del 011.

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
4. **Dado** el mapa del pasajero, **cuando** lo miro, **entonces** el SOS ya no flota sobre el mapa: está en la hoja de abajo, visible sin desplazarse en 360 × 640, en todos los estados (pedir, buscando, aceptado, en curso). Sigue siendo un toque sostenido que abre el 911 y registra la alerta (D-05).
5. **Dado** el mapa del pasajero, **cuando** la app sabe en qué sector estoy, **entonces** el sector («Estás en Loma») aparece dentro de la hoja, junto al punto de salida, y no flota sobre el mapa.
6. **Dado** la consola del conductor, **cuando** la miro, **entonces** el SOS tampoco tapa la tarjeta del viaje ni sus botones.

### Fuera de Crucita
7. **Dado** un GPS fuera de la zona de servicio de Crucita, **cuando** el pasajero abre el mapa, **entonces** ve «Estás fuera de la zona de servicio de Crucita» y el mapa se centra en Crucita. No puede usar su GPS como punto de salida, pero sí elegir un lugar o un sector.
8. **Dado** un conductor con el GPS fuera de la zona, **cuando** intenta ponerse disponible, **entonces** la app le dice que está fuera de la zona y no lo pone disponible.

## Preguntas abiertas para David
- **A.** En el administrador dijiste «en los lugares, los lugares se ven todos». ¿Qué esperabas: verlos por sector, buscar por nombre o que no salgan los ocultos? Mientras no lo aclares, queda fuera de esta spec.
- **B.** El criterio 8 cambia el despacho (regla del servidor). ¿Lo incluimos ahora o basta con el aviso en la app (criterio 7) para el piloto?
- **C.** «Al cerrar sesión se cierra completamente la app» (cierre inesperado, no el cuelgue) no se puede reproducir sin el registro de Android. Si vuelve a pasar con el APK nuevo, hace falta el `adb logcat` del momento.

## Fuera de alcance
- Las pantallas del pasajero del viaje en curso (cancelar con motivo, confirmar, calificar): son el PR 4 del 005, con spec ya aprobada.
- Cambiar la paleta del 011.
- Tema oscuro.

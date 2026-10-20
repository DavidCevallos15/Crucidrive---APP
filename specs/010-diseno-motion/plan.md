# 010 · Plan

Extender `constants/theme.ts`, mantener Outfit/Inter y componentes existentes. Sustituir superficies oscuras por papel cálido y texto tinta, conservar alias por compatibilidad y exponer nombres semánticos. Aplicar el mismo sistema a mapa, acceso, menú y ajustes. Mapa nativo claro y atribución web legible.

Bienvenida como estado de la raíz pública, con bandera AsyncStorage local no sensible, sin alterar guardias de sesión ni enlaces. Ola como geometría animada en Reanimated sobre ilustración costera; transformación y opacidad, sin video pesado ni sonido. Omitir interrumpe de inmediato y persiste; movimiento reducido conserva el resultado sin desplazamiento. Lectura de preferencia fallida da acceso al mapa.

Icono de tricimoto geométrico escalable para UI/mapa y arte propio para bienvenida. Reutilizar logo con color de marca y generar derivados de instalación coherentes. `react-native-svg`, instalado en la versión compatible con Expo, permite dibujar la curva de espuma y exportar vectores coherentes; se descarta sumar Lottie o Skia para una única transición. No agregar librerías de motion: Reanimated ya existe. Se descartan Framer Motion/CSS de escritorio en nativo, animar cada pestaña, tiempos ficticios de llegada y usar los videos de referencia como archivos de distribución.

Documentar `DESIGN.md`, sidecar y guía completa con componentes/estados y catálogo visual. Tests: persistencia primera visita/fallos, contraste de combinaciones normativas y guardias existentes; suites de regresión, TypeScript, export web y Android. Evidencia visual móvil/escritorio y revisión independiente; las limitaciones de nativo se declaran.

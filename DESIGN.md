---
name: CruciDrive
description: Movilidad en tricimoto con identidad costera, moderna y tecnológica de Crucita.
colors:
  primary: "#087E78"
  primaryLight: "#61E3CF"
  secondary: "#F3D6A1"
  secondaryLight: "#F9E8C9"
  danger: "#EF4444"
  dangerLight: "#F87171"
  success: "#10B981"
  successLight: "#34D399"
  darkBg: "#061C23"
  glassSurface: "rgba(6, 28, 35, 0.94)"
  glassBgDark: "rgba(255, 255, 255, 0.07)"
  glassBorderDark: "rgba(255, 255, 255, 0.12)"
  glassTextDark: "#F2F8F7"
  glassTextMutedDark: "#ACBFBE"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "40px"
    fontWeight: 700
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "32px"
    fontWeight: 600
  title:
    fontFamily: "Outfit, sans-serif"
    fontSize: "24px"
    fontWeight: 700
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  borderRadiusSm: "8px"
  borderRadiusMd: "16px"
  borderRadiusLg: "24px"
  borderRadiusFull: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.darkBg}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  button-ghost:
    backgroundColor: "{colors.glassBgDark}"
    textColor: "{colors.glassTextDark}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  input:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.glassTextDark}"
    rounded: "{rounded.borderRadiusSm}"
    height: "52px"
  card:
    backgroundColor: "{colors.glassSurface}"
    textColor: "{colors.glassTextDark}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "{spacing.md}"
  navigation:
    backgroundColor: "{colors.glassSurface}"
    textColor: "{colors.glassTextMutedDark}"
    height: "85px"
  auth-mode:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.borderRadiusSm}"
    padding: "0px 4px"
---

# Design System: CruciDrive

## Overview

**Creative North Star: "Crucita costera, moderna y tecnológica"**

Una identidad de movilidad local: marino profundo, turquesa luminoso y arena cálida sitúan CruciDrive en Crucita sin convertir cada pantalla en una postal. La marca acompaña las tareas de pedir, coordinar y realizar viajes en tricimoto.

Los controles conservan la familiaridad de una aplicación nativa. La imagen costera aporta atmósfera al acceso; las superficies marinas de alta opacidad sostienen la lectura sobre imágenes y mapas. Outfit e Inter se conservan intencionalmente para mantener continuidad con la aplicación existente.

**Key Characteristics:**

- Marino para estructura, turquesa para marca y foco, arena para acciones destacadas.
- Controles familiares, texto legible y jerarquía directa.
- Profundidad contenida con superficies de alta opacidad.
- Marca local mediante activos propios y mensajes en español.

La fuente única de tokens es `frontend/src/constants/theme.ts`; este documento registra sus valores reutilizados. El contexto de producto vive en `PRODUCT.md` y la composición del acceso en `.impeccable/surfaces/login.md`.

## Colors

La paleta combina el carácter del mar con un acento de arena cálida; los valores normativos están en el frontmatter.

### Primary

- **Marino turquesa** (`primary`): botones primarios y selección activa del acceso.
- **Agua luminosa** (`primaryLight`): foco, selección de texto, acentos de la marca y énfasis sobre marino.

### Secondary

- **Arena cálida** (`secondary`): acción principal del acceso mediante la variante secundaria y énfasis de viaje.
- **Arena clara** (`secondaryLight`): variación de apoyo, incluida la indicación de ubicación pendiente.

### Neutral

- **Marino profundo** (`darkBg`): lienzo general y texto oscuro sobre arena.
- **Superficie marina** (`glassSurface`): paneles sobre mapas o ilustración.
- **Velo y borde de cristal** (`glassBgDark`, `glassBorderDark`): controles secundarios y separación sutil.
- **Espuma y bruma** (`glassTextDark`, `glassTextMutedDark`): contenido principal y secundario.
- **Blanco** (`white`): marca y texto de botones sólidos.

Rojo y verde son semánticos: `danger` y `dangerLight` comunican emergencia, error o una acción de cierre; `success` y `successLight` disponibilidad y éxito. El rojo no es un acento decorativo del acceso.

**The Contrast Before Glass Rule.** La legibilidad gobierna la superficie; conservar el fondo marino de alta opacidad al colocar texto sobre imágenes o mapas y verificar el contraste de cada combinación.

## Typography

**Display Font:** Outfit, con fallback sans-serif.
**Body Font:** Inter, con fallback sans-serif.

Outfit da identidad a títulos y acciones; Inter mantiene claridad en campos, mensajes y etiquetas. Las familias y pesos cargados por Expo gobiernan la representación nativa; el lockup utiliza la variante `Outfit-SemiBold`.

### Hierarchy

- **Display:** total destacado del viaje; usar numerales tabulares para precios y contadores.
- **Headline:** jerarquía principal y marca de tamaño regular.
- **Title:** títulos de formulario, nombre del perfil y encabezados de contenido.
- **Body:** contenido, mensajes y campos. La escala de apoyo usa también tamaños de 18 y 20 de `FONTS.sizes`.
- **Label / Caption:** etiquetas visibles, estado, ayuda y contexto breve. Evitar texto fino sobre fondos variables.

El titular grande de escritorio del acceso es una decisión de esa superficie, no una nueva escala global. No reutilizar su tamaño en pantallas operativas por defecto.

## Layout

El ritmo reutilizado sigue pasos de 4 y 8, con padding habitual `md` y separación entre secciones `lg` o `xl`. Adaptar el espacio al área segura y permitir desplazamiento cuando el teclado reduce el viewport.

En el acceso, una columna limita el formulario a 440 px; a partir de 900 px la composición de bienvenida pasa a marca/contexto y formulario dentro de un máximo de 1200 px. Esos límites pertenecen al acceso. El perfil centra contenido hasta 560 px. Los fondos del acceso cubren el viewport mediante posicionamiento absoluto y recorte, sin imponer su tamaño intrínseco al documento.

El mapa conserva el lienzo completo, estado de ubicación arriba a la izquierda y ficha de origen/destino abajo. La ubicación no es un campo de búsqueda; el destino se elige en la ficha. Mantener total, selector de personas y estado de solicitud visibles según el flujo. Las barras y fichas deben dejar espacio a la navegación y al SOS.

## Elevation & Depth

La profundidad combina capas tonales, bordes finos y desenfoque de Expo. `GlassCard` usa una superficie marina al 94 %, borde fino y blur de intensidad 20; su contenido sigue siendo legible cuando el desenfoque no aporta separación. `BlurContainer` permite componer sin imponer sombra. No exigir transparencia intensa ni blur en todos los elementos.

La sombra oscura compartida desplaza 8 px, tiene radio 32 y elevación Android 12; la variante clara conserva desplazamiento y radio con elevación 8. Los valores completos y sus traducciones para el panel están en el sidecar. El modal de oferta al conductor es opaco y sin blur para priorizar lectura y respuesta.

Las entradas compartidas de panel duran 220 ms, las salidas 140 ms, y respetan reducción de movimiento. La pulsación compartida escala a 0.97 en 100 ms y regresa en 160 ms con la curva del tema, también respetando la preferencia del sistema. No añadir esperas encadenadas.

## Shapes

Tarjetas y botones compartidos usan `borderRadiusMd`; los campos usan `borderRadiusSm` y las fichas amplias pueden usar `borderRadiusLg`. El borde de cristal compartido es fino (1 px).

**The Control Shape Rule.** Los botones GlassButton conservan esquinas de tarjeta; reservar el radio completo para geometrías circulares, avatares o estados compactos, sin convertirlo en el estilo global de acciones.

## Components

### Buttons

`GlassButton` ofrece primary, secondary, danger y ghost. Primary usa turquesa marino con blanco; secondary arena con texto marino; danger rojo con blanco; ghost velo claro, borde sutil y texto claro. La acción principal del acceso usa secondary.

Los tamaños sm/md/lg tienen alturas mínimas de 44/48/56 px, padding horizontal de 16/24/32 px y padding vertical `sm`. Son mínimos: permitir que texto ampliado aumente la altura. La carga sustituye el contenido por un indicador del color de texto y bloquea reenvíos; disabled reduce opacidad. `PressableScale` aporta interacción de toque, clic y teclado y conserva los estados accesibles.

### Cards / Containers

`GlassCard` agrupa contenido con padding `md`, radio estándar, superficie marina, borde y sombra compartida. Puede omitir padding o ajustar radio explícitamente. Las variantes highlight y danger cambian el borde; no convierten la tarjeta en una acción por sí mismas.

### Inputs / Fields

`GlassInput` mantiene etiqueta visible, texto Inter, altura mínima de 52 px y fondo blanco muy sutil. El foco cambia borde y selección a agua luminosa; el error tiene prioridad con rojo claro y mensaje anunciado como alerta. El fondo enfocado aumenta ligeramente su presencia.

Correo y contraseña son los datos de acceso. La visibilidad de contraseña tiene control propio de 48 px con nombre accesible que cambia según el estado. Conservar autocomplete, teclado apropiado, texto de ayuda y edición bloqueada durante el envío.

### Navigation

`AppTabLayout` comparte barra inferior marina con blur, borde superior fino y etiquetas Inter de escala caption. El color activo lo recibe del rol; el inactivo usa bruma. Conservar etiquetas junto a iconos y espacio inferior suficiente para que el contenido no quede oculto.

El selector del acceso usa dos controles con estado seleccionado y altura mínima de 44 px; cambia entre entrar y crear cuenta conservando los campos. No permite cambiar de modo durante el envío.

### Brand and Assets

`BrandLockup` combina `frontend/assets/brand-mark.png` con Cruci en blanco y Drive en agua luminosa. El tamaño regular muestra el lema; el compacto acompaña el perfil. No sustituirlo por un emoji o icono genérico.

El acceso usa `frontend/assets/coast-login.jpg` con velo marino. Es ilustración de marca, no fotografía documental. Los originales generados y prompts están en `frontend/assets/brand/`. `frontend/app.json` conecta icono, splash, favicon y variantes adaptativas de Android.

### Operational Surfaces

- **Mapa y SOS:** preservar mapa nocturno nativo y vista web de OpenStreetMap con atribución visible. La web es una previsualización sin marcadores. SOS permanece arriba a la derecha, por encima de la ficha; requiere mantener 2 segundos, muestra progreso y revierte al soltar. Su anillo ambiental respeta reducción de movimiento.
- **Conductor:** disponibilidad mediante Switch nativo, estados explícitos y aviso de desconexión. La oferta usa modal opaco, cuenta según el servidor, tarifa real, y acciones grandes de al menos 64 px. No reintroducir la antigua regla de modal de cristal.
- **Chat:** distinguir mensajes propios a la derecha y recibidos a la izquierda; limitar el ancho de burbuja y conservar el compositor junto al teclado. Habilitar el chat según el viaje activo.
- **Perfil:** mostrar rol, estado y calificación desde datos reales; `Sin datos` representa ausencia de calificación. Una cuenta registrada no implica identidad verificada. El cierre de sesión muestra carga y comunica errores.

## Do's and Don'ts

### Do:

- **Do** usar los tokens de theme.ts para extender pantallas y controles.
- **Do** conservar etiquetas visibles, foco perceptible, semántica accesible y mensajes de error anunciados.
- **Do** respetar áreas seguras, teclado, desplazamiento y reducción de movimiento.
- **Do** mantener las acciones del mapa, SOS y conductor legibles sobre fondos variables.

### Don't:

- **Don't** inventar calificaciones, verificaciones o estados de cuenta para llenar espacios.
- **Don't** sustituir el acceso real por SMS ni mezclar consentimiento y perfil con el registro inicial.
- **Don't** heredar el titular grande del acceso o botones totalmente redondos como reglas globales.
- **Don't** copiar colores antiguos o animaciones heredadas como nuevas decisiones del sistema.

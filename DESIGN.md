---
name: CruciDrive
description: Sistema 010 claro de movilidad en tricimoto y encomiendas en Crucita.
colors:
  wine: "#7F1139"
  sand: "#FEE8C1"
  blue: "#88AEE0"
  paper: "#FFFCF7"
  surface: "#FFFFFF"
  ink: "#291B25"
  glassTextMutedDark: "#74636D"
  glassBgDark: "#F5EFEA"
  outline: "#E3D8D4"
  blueLight: "#E9F1FB"
  blueInk: "#294A75"
  wineSoft: "#F7EAF0"
  secondaryLight: "#704B20"
  danger: "#BB2635"
  dangerLight: "#A51D2D"
  success: "#27634D"
  overlay: "rgba(41, 27, 37, 0.38)"
  onBrand: "#FFFFFF"
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
    fontWeight: 600
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
    backgroundColor: "{colors.wine}"
    textColor: "{colors.onBrand}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  button-secondary:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.onBrand}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  button-ghost:
    backgroundColor: "{colors.glassBgDark}"
    textColor: "{colors.ink}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "8px 24px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.borderRadiusSm}"
    padding: "0px 16px"
  input-focus:
    backgroundColor: "{colors.wineSoft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.borderRadiusSm}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.borderRadiusMd}"
    padding: "{spacing.md}"
  navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.glassTextMutedDark}"
    height: "85px"
  auth-mode:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.onBrand}"
    rounded: "{rounded.borderRadiusSm}"
    padding: "0px 4px"
  checkbox:
    backgroundColor: "{colors.wine}"
    textColor: "{colors.onBrand}"
    size: "24px"
  tricimoto:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.wine}"
    size: "32px"
---

# Design System: CruciDrive

## Overview

**Creative North Star: "Crucita costera, moderna y tecnológica"**

El sistema 010 expresa la dirección clara y premium elegida por David: papel cálido, arena Silk Mango, vino Neon Candy y azul Wild Navy. La tricimoto propia y la costa reconocible sitúan la marca en Crucita. Outfit construye la identidad; Inter sostiene lectura y acciones de una aplicación móvil.

La bienvenida concentra la ilustración y la pasada de espuma. Los controles operativos priorizan contenido legible, superficies blancas, tinta oscura y estados explícitos. La profundidad es contenida y no depende de transparencia o animación.

**Key Characteristics:**

- Lienzo claro, vino para actuar, arena para calidez y azul para paisaje.
- Tricimoto geométrica propia e iconos de acción en contorno.
- Etiquetas persistentes y respuesta táctil breve.
- Composición móvil adaptable, áreas seguras y contenido desplazable.

La fuente de implementación es `frontend/src/constants/theme.ts`; el frontmatter registra tokens reutilizados y `.impeccable/design.json` añade estados, sombras y movimiento. La guía ampliada está en `docs/sistema-diseno-crucidrive.md`. Catálogo vivo: `/diseno`; bienvenida manual: `/bienvenida`. Esta documentación reemplaza la identidad turquesa/oscura anterior con autorización del propietario.

## Colors

Los tres colores solicitados conservan sus valores exactos en el frontmatter; los apoyos proceden del tema, sin rampas generadas.

### Primary

- **Neon Candy** (`wine`, alias de código `primary` y `primaryLight`): acción principal, selección, enlaces, marca y foco de campos. `wineSoft` sostiene selección suave y campo enfocado.

### Secondary

- **Silk Mango** (`sand`, alias `secondary`): arena costera, botón secundario y fondo del icono instalado; usar tinta encima.
- **Marrón cálido** (`secondaryLight`): indicaciones cálidas legibles; el nombre histórico no significa superficie clara.

### Tertiary

- **Wild Navy** (`blue`): agua y paisaje; usar tinta para contenido encima. `blueLight` acompaña espuma, apoyos y parabrisas; `blueInk` define foco web de controles compartidos.

### Neutral

- **Papel** (`paper`): lienzo general.
- **Superficie** (`surface`): tarjetas y fichas sobre mapas.
- **Tinta** (`ink`) y **texto secundario** (`glassTextMutedDark`): contenido, ayuda y placeholders.
- **Apoyo cálido** (`glassBgDark`) y **borde** (`outline`): controles discretos y separadores.
- **Velo tinta** (`overlay`): atenuación detrás del menú modal.
- **Sobre marca** (`onBrand`): texto y detalles blancos sobre vino o peligro.

`danger` comunica emergencia o acción irreversible; `dangerLight`, error de campo sobre claro; `success`, disponibilidad y resultado confirmado. Acompañar el color con texto o símbolo.

Los nombres heredados `darkBg`/`lightBg`, `glassSurface`, `glassBgDark`/`glassBgLight`, `glassBorderDark`/`glassBorderLight`, `glassTextDark`/`glassTextLight` y los dos `glassTextMuted*` resuelven a los roles claros. `successLight` coincide con `success`; `white`, con `onBrand`. Son compatibilidad de API, sin alternancia automática claro/oscuro. Preferir nombres semánticos al ampliar la interfaz.

**The Contrast Before Glass Rule.** La superficie sostiene la lectura por sí misma. No colocar blanco pequeño sobre arena o azul; comprobar cada estado y fondo variable. Las pruebas de combinaciones normativas no certifican accesibilidad de todas las pantallas o plataformas.

## Typography

**Display Font:** Outfit, fallback sans-serif en las muestras web.
**Body Font:** Inter, fallback sans-serif en las muestras web.

Expo carga las familias; lockup y varios títulos usan `Outfit-SemiBold`. No introducir una tercera familia. React Native mide en puntos lógicos; el frontmatter y las muestras HTML expresan el mismo número en px para representación web.

### Hierarchy

- **Display:** precio o total destacado; numerales tabulares para precios y contadores.
- **Headline:** título principal y marca regular.
- **Title:** encabezados de sección; la escala también ofrece 18 y 20 para títulos pequeños y acciones.
- **Body:** campos y contenido con altura de lectura.
- **Label / Caption:** etiquetas, estado, ayuda y contexto breve.

La bienvenida tiene titular propio de 36/41 en móvil y 56/60 desde 900 puntos, tracking −0,9/−1,4. El catálogo tiene titular 42/46. Son decisiones de superficie, no tamaños predeterminados para operación. Permitir crecimiento del texto y desplazamiento; no recortar etiquetas para cumplir un alto fijo.

## Layout

El ritmo compartido usa la escala 4/8 del frontmatter: padding habitual `md`, separación de secciones `lg`/`xl` y bloques mayores `xxl`. Incorporar safe area, teclado y desplazamiento.

La bienvenida centra una columna hasta 520 puntos; desde 900 coloca escena y acciones en dos columnas, separación 72 y máximo 1200. El contenedor exterior llega a 1248 con padding horizontal 24. El catálogo centra hasta 1040, con muestras en filas ajustables y formulario hasta 480. El acceso limita formulario a 440; ajustes, lectura a 680. Estos límites pertenecen a sus superficies.

El mapa conserva su lienzo y ficha inferior; ubicación, menú, cuenta y SOS siguen accesibles. Fichas y barras dejan visible la atribución. La bienvenida no solicita permisos de ubicación ni notificaciones.

## Elevation & Depth

Superficie blanca opaca, borde fino y sombra tinta suave. `GlassCard` conserva su nombre, usa blur compartido **0** y `tint="light"`. La sombra compartida `shadowDark` tiene offset (0,8), radio 24, opacidad 0,08 y elevación Android 4; `shadowLight` reduce opacidad a 0,06 y elevación a 3. Las traducciones CSS del sidecar aproximan la muestra web; no garantizan el mismo rasterizado nativo.

`AppTabLayout` conserva blur propio 25 sobre superficie blanca. No extenderlo a todas las tarjetas. El menú modal usa velo tinta y panel de papel. No añadir brillos de color ni sombras negras duras.

Paneles compartidos: entrada/salida 220/140 ms. `PressableScale`: escala 0,97 en 100 ms y regreso en 140 ms, curva del tema y `ReduceMotion.System`. Los tiempos genéricos 150/250/400 del tema no sustituyen estos valores concretos.

## Shapes

Campos: `borderRadiusSm`; tarjetas y botones: `borderRadiusMd`; fichas amplias: `borderRadiusLg`. Borde compartido: 1 punto. Reservar radio completo para avatares y geometrías circulares.

La escena tiene radio 32 y proporción 1,3 como excepción de marca. Selector de acceso: envoltorio 12 y segmentos 8; filas de menú: 12; casilla gráfica: 6. Son valores locales, no otra escala.

**The Control Shape Rule.** Conservar la forma compartida al ampliar acciones; el radio circular de un avatar no define los botones.

## Components

### Buttons

`GlassButton`: `primary` vino/blanco, `secondary` arena/tinta, `ghost` apoyo cálido/tinta con borde y `danger` rojo/blanco. Predeterminados: primary, md y radio estándar. Props: `label`, `onPress`, `variant`, `size`, `disabled`, `loading`, `leftIcon`, `style`.

Mínimos sm/md/lg: 44/48/56 en iOS y web; Android eleva sm a 48. Padding horizontal 16/24/32 y vertical 8. Permitir crecimiento. Disabled usa opacidad 0,45. Loading sustituye contenido por spinner, conserva nombre accesible, anuncia busy y bloquea reenvíos; no aplica por sí solo la opacidad disabled.

`PressableScale` aporta pulsación y foco web: contorno `blueInk` de 3, separado 3. Restablece escala al deshabilitarse y respeta reducción de movimiento. El tema no define un color hover compartido; el sidecar no inventa uno.

### Cards / Containers

`GlassCard`: superficie blanca, borde, padding estándar y sombra de Elevation. Variantes default/highlight/danger cambian borde a outline/vino/rojo. Props `noPadding`, `borderRadius`, `blurIntensity` permiten excepciones. Una tarjeta no implica interacción. No envolver cada fila de ajustes en otra tarjeta.

### Inputs / Fields

`GlassInput` conserva etiqueta, Inter y mínimo 52. Papel y borde outline en reposo; foco vino sobre `wineSoft`; error tiene prioridad de borde `dangerLight` y mensaje alert. La ayuda aparece cuando no hay error. Props `label`, `helperText`, `error`, `required`, `leadingIcon` y las de TextInput.

Contraseña: control propio 48×48 con nombre Mostrar/Ocultar contraseña y estado expanded. Conservar teclado y autocomplete del formulario. `CheckboxRow` hace pulsable toda la fila de mínimo 48, comunica checked y error; casilla gráfica 24. No presupone consentimiento.

### Navigation

`AppMenuButton`: modal lateral papel, ancho hasta 360 dejando 36 exteriores, cierre visible y opciones según sesión/rol. Filas mínimo 56, selección vino suave, iconos con etiqueta. Disparador 48; cierre mínimo 44. Estas medidas existentes no garantizan 48 para todos los iconos Android.

`AppTabLayout`: barra inferior 85, borde superior fino, etiquetas Inter caption; activo según rol (vino pasajero, éxito conductor). Selector de acceso: segmentos mínimo 44 y selección vino/blanco, estado explícito y sin cambio durante envío; no es navegación global.

### Brand and Icons

`BrandLockup` usa `frontend/assets/brand-mark.png` tintado vino, nombre tinta y Drive vino. Regular: marca 64, nombre 32 y lema «Tu camino por Crucita.»; compacto: marca 44, nombre 24, sin lema. No sustituir por emoji.

`TricimotoIcon` acepta size/color/background, por defecto 32/vino/arena. Techo, parabrisas azul suave, carrocería y tres ruedas; decorativo para accesibilidad, necesita el nombre del control que acompaña. Usos: 26–32 en servicios/mapa; 48 en catálogo. Vector: `frontend/assets/premium/tricimoto-front.svg`.

Ionicons en contorno para acciones: `cube-outline`, `map-outline`, `chatbubble-outline`, `person-outline`, `settings-outline`, `shield-checkmark-outline`, `location-outline`, `log-in-outline`. Habitual 20–24; catálogo 28. Navegación conserva texto; botones de solo icono, nombre accesible.

`CoastalScene` combina arena, agua azul, espuma y `frontend/assets/premium/tricimoto-hero.png`. Es arte de marca sin coordenadas ni datos de servicio. Originales y prompts: `frontend/assets/premium/`; derivados de instalación: `frontend/app.json`. El JSON exportable de tokens deriva del tema, sin editarlo como otra fuente.

### Welcome and Motion

`CoastalIntro`: una pasada de agua/espuma de 2400 ms, sin sonido; Omitir desde el inicio. La raíz pública recuerda presentación con `crucidrive:welcome:v1 = seen`; terminar, omitir o continuar registra preferencia. Al volver abre mapa. `/bienvenida` permite reproducción manual.

Con Reduce Motion, `WelcomeScreen` muestra contenido estático y llama `onPresented` desde un efecto para registrar esa presentación. Durante intro oculta contenido operativo a tecnologías de asistencia y deshabilita sus acciones. Fallos de almacenamiento no bloquean el mapa. Sin bucles ornamentales ni retardos encadenados para acciones frecuentes. SOS conserva pulsación funcional 2000 ms.

### Screen Models

| Modelo | Composición y comportamiento |
| --- | --- |
| Bienvenida | Marca, escena, saludo, servicios y acceso; una columna móvil, dos en escritorio. |
| Acceso / registro | Contexto, selector, campos, errores y acción. Correo/contraseña; perfil y consentimiento conservan su flujo. |
| Mapa / encomienda | Lienzo y ficha de servicio con origen/destino. Encomienda añade contenido, destinatario y autorización; precio a convenir por chat. |
| Buscando / aceptado | Estado real y cancelar mientras busca; datos reales del conductor y chat al aceptar. |
| Conductor | Conexión, disponibilidad y oferta real con aceptar/rechazar. |
| Ajustes / ayuda / cuenta | Volver, título y grupos de filas; acciones destructivas separadas. |
| Chat | Participante real, burbujas y compositor junto al teclado; habilitado según servicio activo. |
| Catálogo | Paleta, estados, campos, iconos y reglas; muestras sin solicitudes. |

La previsualización web de OpenStreetMap mantiene atribución y no dibuja marcadores; la tricimoto del mapa nativo depende de datos reales. No inferir rutas calculadas ni tiempos estimados de una escena o un bundle.

Evidencia visual en `.impeccable/review/premium/`: welcome y catalog móvil/escritorio; login, map, menu y settings móvil. Confirma apariencia web; no demuestra FPS, permisos, aspecto de marcadores ni accesibilidad completa en dispositivos nativos. Un bundle Android tampoco lo demuestra.

## Do's and Don'ts

### Do:

- **Do** extender tema y componentes con roles claros.
- **Do** conservar etiquetas, nombres accesibles, foco, errores anunciados y carga sin doble envío.
- **Do** permitir texto ampliado, desplazamiento, teclado y áreas seguras.
- **Do** respetar Reduce Motion y persistir también la bienvenida estática.
- **Do** revisar estados reales y fondos variables además de colores aislados.

### Don't:

- **Don't** reintroducir turquesa/oscuro por nombres legacy ni prometer modo oscuro automático.
- **Don't** usar blanco pequeño sobre azul/arena, blur para sostener contraste o brillos de color.
- **Don't** sustituir tricimoto por automóvil ni inventar personas, verificaciones, valoraciones, rutas o tiempos de llegada.
- **Don't** convertir escena, títulos grandes o animación de bienvenida en requisito global.
- **Don't** atribuir rendimiento o accesibilidad nativa a capturas web y bundles.

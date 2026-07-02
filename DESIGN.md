---
version: 1.0.0
name: CruciDrive Glass Design
author: Antigravity AI
colors:
  primary: "#0D9488"
  primaryLight: "#14B8A6"
  secondary: "#F59E0B"
  secondaryLight: "#FBBF24"
  danger: "#EF4444"
  dangerLight: "#F87171"
  success: "#10B981"
  successLight: "#34D399"
  darkBg: "#0B0F19"
  lightBg: "#F8FAFC"
  glassBgDark: "rgba(255, 255, 255, 0.07)"
  glassBgLight: "rgba(15, 23, 42, 0.04)"
  glassBorderDark: "rgba(255, 255, 255, 0.12)"
  glassBorderLight: "rgba(15, 23, 42, 0.08)"
  glassTextDark: "#F1F5F9"
  glassTextLight: "#0F172A"
  glassTextMutedDark: "#94A3B8"
  glassTextMutedLight: "#64748B"
typography:
  fontFamily: "Outfit, Inter, sans-serif"
  sizes:
    xs: "12px"
    sm: "14px"
    base: "16px"
    lg: "18px"
    xl: "20px"
    xxl: "24px"
    title: "32px"
  weights:
    regular: "400"
    medium: "500"
    semibold: "600"
    bold: "700"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
shapes:
  borderRadiusSm: "8px"
  borderRadiusMd: "16px"
  borderRadiusLg: "24px"
  borderRadiusFull: "9999px"
effects:
  blurIntensity: "20px"
  shadowLight: "0 8px 32px 0 rgba(31, 38, 135, 0.08)"
  shadowDark: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
---

# Especificación del Sistema de Diseño: CruciDrive App

Este documento es la fuente única de verdad para el diseño de la interfaz de usuario de **CruciDrive**, un sistema hiperlocal de transporte y geolocalización para Crucita, Ecuador. Define los tokens y las directrices visuales necesarias para construir una aplicación premium, interactiva y de alta fidelidad utilizando el concepto de **Glassmorphic Design** (Diseño de Cristal).

---

## 1. Concepto y Filosofía de Diseño

El sistema de diseño de CruciDrive se inspira en el agua, el océano y la luz costera de Crucita. Su núcleo visual es el **Glassmorphism**, el cual genera una sensación de profundidad, transparencia y ligereza. Esto es crucial para un entorno móvil, ya que el usuario debe sentir que la interfaz "flota" sobre un mapa dinámico e interactivo en tiempo real sin obstruir la visibilidad del trayecto.

### Pilares del Diseño:
1. **Translucidez:** Fondos semitransparentes que permiten ver sutilmente los elementos de fondo (mapas, gradientes).
2. **Desenfoque de Fondo (Backdrop Blur):** Efecto de lente esmerilado que desenfoca la información detrás de las tarjetas para garantizar la legibilidad del texto en primer plano.
3. **Bordes de Cristal:** Bordes finos y ligeramente más claros que el fondo para emular el reflejo de la luz en un cristal físico.
4. **Sombras Suaves y Elevación:** Sombras difusas y amplias que separan físicamente los contenedores del lienzo base.
5. **Animaciones Fluidas (60fps):** Transiciones suaves de escala, opacidad y posición al abrir modales, cambiar de pantalla o cargar datos.

---

## 2. Aplicación Técnica en React Native + Tailwind CSS (NativeWind)

Para implementar estos tokens de forma nativa en la aplicación móvil con React Native Expo y Tailwind CSS:

* **Desenfoque:** Usar `BlurView` del paquete `expo-blur` en lugar de filtros de CSS del navegador (los cuales no son compatibles nativamente en Android/iOS sin el SDK de Expo).
* **Contenedor Glassmorphic Estándar (Tailwind):**
  - **Fondo:** `bg-white/10` (o `bg-slate-900/40` en modo oscuro).
  - **Borde:** `border border-white/20` (o `border-slate-800/50`).
  - **Desenfoque:** Ajustar la intensidad de `BlurView` a un valor equivalente a `intensity={20}`.
  - **Sombra:** `shadow-lg shadow-black/20`.
* **Animaciones:** Utilizar la librería `react-native-reanimated` para las transiciones e interacciones de gestos.

---

## 3. Guías de Componentes Clave

### A. Pantalla de Autenticación (Login con SMS)
- **Fondo base:** Un gradiente radial suave que va del azul océano profundo (`#0B0F19`) al cian marino (`#0D9488`).
- **Tarjeta de Login:** Un contenedor con bordes de cristal redondeados (`borderRadiusMd`), centrado en pantalla, que flota sobre el gradiente.
- **Entradas de texto:** Fondos oscuros muy translúcidos con bordes activos en cian y placeholders claros.
- **Botón de Acción (SMS):** Sólido, color naranja atardecer (`#F59E0B`), con un ligero reflejo superior para darle tridimensionalidad.

### B. Panel del Mapa y Ficha de Destino (Pasajero)
- **Mapa Base:** Ocupa el 100% de la pantalla (OpenStreetMap / Mapbox).
- **Barra de Búsqueda de Destino:** Flota en la parte superior. Estructura de cápsula horizontal ultra-translúcida (`borderRadiusFull`), con desenfoque de fondo y borde de cristal fino.
- **Ficha de Información del Viaje (Bottom Sheet):** Se despliega desde la parte inferior. Fondo translúcido con desenfoque intenso. Muestra la tarifa precalculada de forma destacada utilizando tipografía en peso `bold` y tamaño `xxl`.
- **Botón de Pánico (SOS):** Flotante, circular, color rojo brillante (`#EF4444`). Posee un efecto de pulso animado en el fondo (`react-native-reanimated`) que simula ondas de sonar.

### C. Consola del Conductor (Modo Conductor)
- **Switch de Estado Operativo (Disponible / Ocupado):** Ubicado en el encabezado. Su diseño debe ser sumamente visible, con estados de color intuitivos: verde esmeralda (`#10B981`) para disponible y gris/naranja para ocupado.
- **Tarjeta de Solicitud de Viaje Recibido:** Modal emergente central que interrumpe la pantalla con animación elástica. Debe usar bordes de cristal gruesos (`border-white/30`) y una sombra amplia (`shadowDark`) para denotar urgencia y prioridad. Botones de aceptación masivos para facilitar el toque durante la conducción.

### D. Chat de Viaje (Mensajería Instantánea)
- **Burbujas de Mensaje:**
  - **Enviados (Propios):** Fondo verde azulado translúcido (`rgba(13, 148, 136, 0.4)`) con borde cian.
  - **Recibidos (Otros):** Fondo grisáceo translúcido (`rgba(255, 255, 255, 0.1)`) con borde blanco sutil.
- **Barra de Entrada de Texto:** Fija en la base, estilo de barra de cristal integrada, impidiendo que el mapa se oculte del todo gracias a su transparencia.

---

## 4. Reglas de Diseño: Qué Hacer y Qué No Hacer (Do's & Don'ts)

### ✅ Qué Hacer (Do's)
- **Hacer** que los elementos detrás de los contenedores de cristal tengan formas definidas o gradientes dinámicos para que el efecto de desenfoque sea perceptible y estético.
- **Hacer** que los bordes de los contenedores de cristal sean sutiles y finos (`border-[0.5px]` o `border-[1px]`) para conservar el efecto realista.
- **Hacer** que el contraste del texto sea excelente. Si el fondo es translúcido claro, usar tipografía en Slate oscuro (`#0F172A`). Si es translúcido oscuro, usar tipografía blanca (`#F1F5F9`).
- **Hacer** que los elementos interactivos reaccionen al tacto con una micro-animación de escala (ej. reducir tamaño a `0.97` en el evento `onPressIn`).

### ❌ Qué No Hacer (Don'ts)
- **No** usar colores de cristal planos sin desenfoque (backdrop blur), ya que se perdería el efecto de profundidad y se vería como una simple caja gris o blanca con opacidad.
- **No** acumular múltiples capas de cristal una encima de otra (ej. un modal de cristal encima de una tarjeta de cristal encima de una barra de cristal), ya que degrada la legibilidad y satura el procesador gráfico (GPU).
- **No** usar textos pequeños o delgados (`font-light`) sobre fondos translúcidos, puesto que dificulta la lectura a plena luz del día.
- **No** usar sombras duras o colores de sombra muy oscuros sobre interfaces claras. La sombra del cristal debe simular la refracción de la luz ambiente.

/**
 * Tokens del sistema costero de CruciDrive.
 * Implementación normativa documentada en DESIGN.md.
 *
 * Todos los valores están centralizados aquí para garantizar
 * consistencia visual en toda la aplicación.
 */

// ─── PALETA DE COLORES ──────────────────────────────────────────────────────

export const COLORS = {
  /** Neon Candy — acción principal y marca */
  primary: '#7F1139',
  /** Alias histórico: vino de alto contraste para selección y foco */
  primaryLight: '#7F1139',

  /** Arena costera — acentos y acciones principales del acceso */
  secondary: '#FEE8C1',
  /** Alias histórico: texto cálido de alto contraste sobre papel */
  secondaryLight: '#704B20',

  /** Rojo alerta — botón de pánico, errores */
  danger: '#BB2635',
  /** Variante clara del rojo */
  dangerLight: '#A51D2D',

  /** Verde semántico — estado disponible y éxito */
  success: '#27634D',
  /** Alias histórico para texto de éxito legible */
  successLight: '#27634D',

  /** Alias histórico darkBg: papel cálido del sistema claro 011 */
  darkBg: '#FFFCF7',
  /** Papel cálido del sistema claro */
  lightBg: '#FFFCF7',

  // ─── ALIAS DE SUPERFICIE — COMPATIBILIDAD CON COMPONENTES EXISTENTES ─────────────────────────────────
  /** Superficie de controles discretos */
  glassBgDark: '#F5EFEA',
  /**
   * Superficie blanca opaca para conservar lectura sobre el mapa.
   */
  glassSurface: '#FFFFFF',

  /** Superficie de controles discretos */
  glassBgLight: '#F5EFEA',

  /** Contorno compartido */
  glassBorderDark: '#E3D8D4',
  /** Contorno compartido */
  glassBorderLight: '#E3D8D4',

  /** Texto principal sobre superficie clara */
  glassTextDark: '#291B25',
  /** Texto principal sobre superficie clara */
  glassTextLight: '#291B25',

  /** Texto secundario sobre papel/blanco */
  glassTextMutedDark: '#74636D',
  /** Texto secundario sobre papel/blanco */
  glassTextMutedLight: '#74636D',

  // Roles normativos del sistema 011. Los nombres glass/dark se conservan como alias de compatibilidad.
  ink: '#291B25',
  paper: '#FFFCF7',
  surface: '#FFFFFF',
  sand: '#FEE8C1',
  wine: '#7F1139',
  blue: '#88AEE0',
  blueLight: '#E9F1FB',
  blueInk: '#294A75',
  wineSoft: '#F7EAF0',
  outline: '#E3D8D4',
  overlay: 'rgba(41, 27, 37, 0.38)',
  onBrand: '#FFFFFF',

  // ─── UTILIDADES ───────────────────────────────────────────
  /** Blanco puro */
  white: '#FFFFFF',
  /** Negro puro */
  black: '#000000',
  /** Transparente */
  transparent: 'transparent',
} as const;

// ─── TIPOGRAFÍA ─────────────────────────────────────────────────────────────

export const FONTS = {
  /** Familia principal para títulos y headings */
  heading: 'Outfit',
  /** Familia para texto de cuerpo y UI general */
  body: 'Inter',

  /** Tamaños de fuente en la escala tipográfica */
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    title: 32,
    /** Tamaño extra para precios destacados */
    display: 40,
  },

  /** Pesos tipográficos */
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  /** Alturas de línea recomendadas */
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// ─── ESPACIADO (Sistema 4/8dp) ──────────────────────────────────────────────

export const SPACING = {
  /** 4px — micro separaciones */
  xs: 4,
  /** 8px — separación interna mínima */
  sm: 8,
  /** 16px — padding estándar */
  md: 16,
  /** 24px — separación entre secciones */
  lg: 24,
  /** 32px — margen de sección */
  xl: 32,
  /** 48px — separación de bloques mayores */
  xxl: 48,
} as const;

// ─── FORMAS Y BORDES ────────────────────────────────────────────────────────

export const SHAPES = {
  /** 8px — bordes ligeramente redondeados (inputs, chips) */
  borderRadiusSm: 8,
  /** 16px — bordes redondeados estándar (tarjetas, modales) */
  borderRadiusMd: 16,
  /** 24px — bordes muy redondeados (bottom sheets) */
  borderRadiusLg: 24,
  /** 9999px — bordes completamente circulares (pills, avatares) */
  borderRadiusFull: 9999,

  /** Grosor del borde de cristal */
  glassBorderWidth: 1,
} as const;

// ─── EFECTOS VISUALES ───────────────────────────────────────────────────────

export const EFFECTS = {
  /** Intensidad del blur para el componente BlurView de expo-blur */
  blurIntensity: 0,

  /** Sombra suave para modo claro */
  shadowLight: {
    shadowColor: '#291B25',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },

  /** Sombra de ficha y tarjeta; alias histórico shadowDark */
  shadowDark: {
    shadowColor: '#291B25',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
} as const;

// ─── ANIMACIONES ────────────────────────────────────────────────────────────

export const ANIMATION = {
  /** Escala al pulsar un botón/tarjeta interactiva */
  pressScale: 0.97,

  /** Duración de micro-interacciones (ms) */
  durationFast: 150,
  /** Duración estándar de transiciones (ms) */
  durationNormal: 250,
  /** Duración de transiciones complejas (ms) */
  durationSlow: 400,

  /** Entrada de paneles: corta, para que la interfaz se sienta inmediata (< 300 ms) */
  enterDuration: 220,
  welcomeDuration: 2400,
  pressInDuration: 100,
  pressOutDuration: 140,
  /** Salida: más rápida que la entrada, el sistema responde enseguida */
  exitDuration: 140,
  /** ease-out exponencial (cubic-bezier) para entradas y respuestas táctiles */
  easeOut: [0.23, 1, 0.32, 1] as const,

  /** Curva de aceleración para entradas */
  easingEnter: 'easeOut' as const,
  /** Curva de aceleración para salidas */
  easingExit: 'easeIn' as const,

  /** Configuración de spring para animaciones naturales */
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },

  /** Duración de la pulsación sostenida para activar el botón de pánico (ms) */
  panicHoldDuration: 2000,
  /** Timeout para aceptar/rechazar un viaje (ms) */
  rideAcceptTimeout: 15000,
} as const;

// ─── Z-INDEX SCALE ──────────────────────────────────────────────────────────

export const Z_INDEX = {
  /** Contenido base */
  base: 0,
  /** Tarjetas y elementos elevados */
  card: 10,
  /** Barra de búsqueda flotante */
  searchBar: 20,
  /** Bottom sheet */
  bottomSheet: 40,
  /** Botón de pánico flotante */
  panicButton: 50,
  /** Modales y overlays */
  modal: 100,
  /** Toast/Snackbar notifications */
  toast: 1000,
} as const;

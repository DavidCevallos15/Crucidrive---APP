/**
 * Tokens del sistema de diseño Glassmorphic de CruciDrive.
 * Fuente de verdad: DESIGN.md v1.0.0
 *
 * Todos los valores están centralizados aquí para garantizar
 * consistencia visual en toda la aplicación.
 */

// ─── PALETA DE COLORES ──────────────────────────────────────────────────────

export const COLORS = {
  /** Verde azulado marino — color principal de marca */
  primary: '#0D9488',
  /** Variante clara del primario para estados activos/hover */
  primaryLight: '#14B8A6',

  /** Naranja atardecer — acentos y CTAs secundarios */
  secondary: '#F59E0B',
  /** Variante clara del secundario */
  secondaryLight: '#FBBF24',

  /** Rojo alerta — botón de pánico, errores */
  danger: '#EF4444',
  /** Variante clara del rojo */
  dangerLight: '#F87171',

  /** Verde esmeralda — estado disponible, éxito */
  success: '#10B981',
  /** Variante clara del verde */
  successLight: '#34D399',

  /** Fondo oscuro principal (modo noche / base de la app) */
  darkBg: '#0B0F19',
  /** Fondo claro (modo día, si aplica) */
  lightBg: '#F8FAFC',

  // ─── COLORES GLASSMORPHIC ─────────────────────────────────
  /** Fondo translúcido de las tarjetas de cristal (modo oscuro) */
  glassBgDark: 'rgba(255, 255, 255, 0.07)',
  /** Fondo translúcido de las tarjetas de cristal (modo claro) */
  glassBgLight: 'rgba(15, 23, 42, 0.04)',

  /** Borde de cristal (modo oscuro) */
  glassBorderDark: 'rgba(255, 255, 255, 0.12)',
  /** Borde de cristal (modo claro) */
  glassBorderLight: 'rgba(15, 23, 42, 0.08)',

  /** Texto principal sobre cristal oscuro */
  glassTextDark: '#F1F5F9',
  /** Texto principal sobre cristal claro */
  glassTextLight: '#0F172A',

  /** Texto secundario/muted sobre cristal oscuro */
  glassTextMutedDark: '#94A3B8',
  /** Texto secundario/muted sobre cristal claro */
  glassTextMutedLight: '#64748B',

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
  blurIntensity: 20,

  /** Sombra suave para modo claro */
  shadowLight: {
    shadowColor: 'rgba(31, 38, 135, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 8,
  },

  /** Sombra pronunciada para modo oscuro */
  shadowDark: {
    shadowColor: 'rgba(0, 0, 0, 0.37)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 12,
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

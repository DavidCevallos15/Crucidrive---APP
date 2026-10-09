/**
 * Configuración centralizada de la aplicación CruciDrive.
 *
 * Las URLs y claves se leen desde variables de entorno.
 * Nunca se queman credenciales directamente en el código.
 */

/**
 * Lee una variable de entorno y avisa si falta.
 *
 * El valor llega ya leído con el acceso literal (`process.env.EXPO_PUBLIC_NOMBRE`): Expo solo
 * incrusta en el bundle los accesos literales. Con el acceso dinámico `process.env[nombre]` el
 * APK se compilaba sin ninguna variable y la app se cerraba al abrirse.
 * @param key - Nombre de la variable (para el aviso)
 * @param value - Valor leído con el acceso literal
 * @param fallback - Valor por defecto para desarrollo local
 */
const getEnvVar = (key: string, value: string | undefined, fallback?: string): string => {
  const resultado = value || fallback;
  if (!resultado) {
    console.warn(`[Config] Variable de entorno "${key}" no definida.`);
  }
  return resultado ?? '';
};

// ─── API / BACKEND ──────────────────────────────────────────────────────────

export const API_CONFIG = {
  /** URL base del servidor Express (REST API) */
  baseUrl: getEnvVar(
    'EXPO_PUBLIC_API_BASE_URL',
    process.env.EXPO_PUBLIC_API_BASE_URL,
    'http://localhost:3000'
  ),

  /** Timeout para solicitudes HTTP en milisegundos */
  requestTimeout: 10000,

  /** Rutas de la API REST */
  endpoints: {
    auth: {
      register: '/api/auth/registro',
      // Nueva versión del aviso de privacidad (paso 004, P18).
      consent: '/api/auth/consentimiento',
    },
    driver: {
      verification: '/api/conductores/verificacion',
      availability: '/api/conductores/disponibilidad',
      // Respaldo de la ubicación sin socket (paso 004, P11).
      location: '/api/conductores/ubicacion',
    },
    admin: {
      drivers: '/api/admin/conductores',
      driver: (id: string) => `/api/admin/conductores/${id}`,
      approve: (id: string) => `/api/admin/conductores/${id}/aprobar`,
      reject: (id: string) => `/api/admin/conductores/${id}/rechazar`,
      places: '/api/admin/lugares',
      place: (id: string) => `/api/admin/lugares/${id}`,
    },
    rides: {
      request: '/api/viajes/solicitar',
      accept: '/api/viajes/aceptar',
      updateStatus: (id: string) => `/api/viajes/${id}/estado`,
    },
    chat: {
      messages: (threadId: string) => `/api/chats/${threadId}/mensajes`,
    },
    dispositivos: {
      registrar: '/api/dispositivos',
      // El token lleva corchetes: va codificado en la ruta.
      olvidar: (token: string) => `/api/dispositivos/${encodeURIComponent(token)}`,
    },
  },
} as const;

// ─── SUPABASE ───────────────────────────────────────────────────────────────

export const SUPABASE_CONFIG = {
  /** URL del proyecto de Supabase */
  url: getEnvVar(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    ''
  ),

  /** Clave pública anónima de Supabase */
  anonKey: getEnvVar(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ''
  ),
} as const;

// ─── SOCKET.IO ──────────────────────────────────────────────────────────────

export const SOCKET_CONFIG = {
  /** URL del servidor de WebSockets (mismo que el backend) */
  url: getEnvVar(
    'EXPO_PUBLIC_SOCKET_URL',
    process.env.EXPO_PUBLIC_SOCKET_URL,
    'http://localhost:3000'
  ),

  /** Opciones de reconexión */
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,

  /** Timeout de conexión inicial (ms) */
  connectionTimeout: 10000,
} as const;

// ─── GEOLOCALIZACIÓN ────────────────────────────────────────────────────────

export const LOCATION_CONFIG = {
  /** Intervalo de actualización GPS para el conductor (ms) */
  driverUpdateIntervalMs: 5000,

  /** Precisión deseada del GPS */
  desiredAccuracy: 'balanced' as const,

  /** Distancia mínima de cambio para emitir actualización (metros) */
  distanceFilterMeters: 10,

  /** Región inicial del mapa (Crucita, Manabí) */
  defaultRegion: {
    // Encuadra los 5 sectores, de La Boca (norte) a La Loma (sur)
    latitude: -0.8425,
    longitude: -80.531,
    latitudeDelta: 0.11,
    longitudeDelta: 0.06,
  },
} as const;

// ─── APP METADATA ───────────────────────────────────────────────────────────

export const APP_CONFIG = {
  /** Nombre visible de la aplicación */
  name: 'CruciDrive',

  /** Versión actual */
  version: '1.0.0',

  /** Límite de consumo de datos móviles por jornada del conductor (bytes) */
  driverDataLimitBytes: 15 * 1024 * 1024, // 15 MB
} as const;

// ─── CONFIGURACIÓN INCOMPLETA ───────────────────────────────────────────────

/**
 * Variables sin las que la app no funciona. Sin ellas, el layout raíz muestra una pantalla
 * que las nombra en vez de cerrarse (un APK compilado sin variables se cerraba al abrirse).
 */
export const variablesFaltantes = (
  valores: Record<string, string | undefined> = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL,
  }
): string[] => Object.entries(valores).filter(([, valor]) => !valor).map(([nombre]) => nombre);

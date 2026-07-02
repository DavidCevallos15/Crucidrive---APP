/**
 * Configuración centralizada de la aplicación CruciDrive.
 *
 * Las URLs y claves se leen desde variables de entorno.
 * Nunca se queman credenciales directamente en el código.
 */

/**
 * Valida que una variable de entorno requerida esté definida.
 * @param key - Nombre de la variable
 * @param fallback - Valor por defecto para desarrollo local
 * @returns El valor de la variable
 */
const getEnvVar = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    console.warn(
      `[Config] Variable de entorno "${key}" no definida. Usando fallback.`
    );
  }
  return value ?? '';
};

// ─── API / BACKEND ──────────────────────────────────────────────────────────

export const API_CONFIG = {
  /** URL base del servidor Express (REST API) */
  baseUrl: getEnvVar(
    'EXPO_PUBLIC_API_BASE_URL',
    'http://localhost:3000'
  ),

  /** Timeout para solicitudes HTTP en milisegundos */
  requestTimeout: 10000,

  /** Rutas de la API REST */
  endpoints: {
    auth: {
      register: '/api/auth/registro',
    },
    rides: {
      request: '/api/viajes/solicitar',
      accept: '/api/viajes/aceptar',
      updateStatus: (id: string) => `/api/viajes/${id}/estado`,
    },
    chat: {
      messages: (threadId: string) => `/api/chats/${threadId}/mensajes`,
    },
  },
} as const;

// ─── SUPABASE ───────────────────────────────────────────────────────────────

export const SUPABASE_CONFIG = {
  /** URL del proyecto de Supabase */
  url: getEnvVar(
    'EXPO_PUBLIC_SUPABASE_URL',
    ''
  ),

  /** Clave pública anónima de Supabase */
  anonKey: getEnvVar(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    ''
  ),
} as const;

// ─── SOCKET.IO ──────────────────────────────────────────────────────────────

export const SOCKET_CONFIG = {
  /** URL del servidor de WebSockets (mismo que el backend) */
  url: getEnvVar(
    'EXPO_PUBLIC_SOCKET_URL',
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
    latitude: -1.0448,
    longitude: -80.5432,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
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

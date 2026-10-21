import { API_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Opciones extendidas para authFetch.
 */
interface AuthFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Límite de espera; por defecto `LIMITE_PETICION_MS`. */
  timeoutMs?: number;
}

/**
 * En Android, fetch no tiene límite de tiempo: con un backend que no responde, una petición
 * podía quedarse esperando para siempre y la pantalla también (campo, 20 oct 2026). Al
 * vencer, la petición se cancela y falla como «sin conexión» (005, criterio 20).
 */
export const LIMITE_PETICION_MS = 15000;

/**
 * Wrapper autenticado sobre fetch() que inyecta automáticamente
 * el token Bearer del store de autenticación y la cabecera Content-Type.
 *
 * Elimina la necesidad de repetir la extracción de token y
 * construcción de headers en cada pantalla/hook que llama a la API.
 *
 * @param endpoint - Ruta relativa de la API (p.ej. `/api/viajes/solicitar`).
 * @param options - Opciones de fetch (method, body, etc.).
 * @returns La respuesta de fetch().
 * @throws Error si no existe sesión activa.
 */
export const authFetch = async (
  endpoint: string,
  options: AuthFetchOptions = {}
): Promise<Response> => {
  const session = useAuthStore.getState().session;

  if (!session?.access_token) {
    throw new Error('No hay sesión activa. Autenticación requerida.');
  }

  const { headers: customHeaders, timeoutMs = LIMITE_PETICION_MS, ...restOptions } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    ...customHeaders,
  };

  if (restOptions.body && typeof restOptions.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  // Si quien llama trae su propia señal, decide él cuándo cancelar.
  if (restOptions.signal) return fetch(`${API_CONFIG.baseUrl}${endpoint}`, { ...restOptions, headers });
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);
  try {
    return await fetch(`${API_CONFIG.baseUrl}${endpoint}`, { ...restOptions, headers, signal: control.signal });
  } finally {
    clearTimeout(timer);
  }
};

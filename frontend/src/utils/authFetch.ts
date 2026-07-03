import { API_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Opciones extendidas para authFetch.
 */
interface AuthFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

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

  const { headers: customHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    ...customHeaders,
  };

  if (restOptions.body && typeof restOptions.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  return fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
    ...restOptions,
    headers,
  });
};

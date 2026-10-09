import type { Punto } from '../utils/geo';
import type { UltimoEnvio } from '../utils/seguimiento';

/**
 * Envío de la ubicación del conductor (paso 004, plan P11). Por socket si está conectado
 * (91 B por envío) y, si no, por `POST /api/conductores/ubicacion` con el JWT de la sesión
 * guardada (unos 1,5 KB). Lógica pura: las dependencias llegan desde `ubicacion.ts`.
 */

/** Lo único que el canal necesita del socket de la app. */
export interface SocketUbicacion {
  connected: boolean;
  emit: (evento: 'update_location', datos: { sectorId: string; coords: Punto }) => unknown;
}

export interface DependenciasCanal {
  obtenerSocket: () => SocketUbicacion | null;
  /** JWT de la sesión guardada; null si no hay sesión. */
  obtenerJwt: () => Promise<string | null>;
  fetchImpl: typeof fetch;
  url: string;
  sectorDe: (punto: Punto) => string;
  ahora?: () => number;
  /** Tras cada envío correcto; la app lo guarda para el criterio 20. */
  alEnviar?: (envio: UltimoEnvio) => void;
}

/**
 * - `ok`: enviado.
 * - `detener`: el servidor no acepta la ubicación de esta cuenta (403 o 409) o no hay sesión;
 *   el seguimiento debe apagarse (P13).
 * - `error`: falló la red o el servidor; se reintenta en el siguiente envío.
 */
export type ResultadoEnvio = 'ok' | 'detener' | 'error';

export interface CanalUbicacion {
  enviar: (punto: Punto) => Promise<ResultadoEnvio>;
  ultimoEnvio: () => UltimoEnvio | null;
  /** Al dejar de seguir: el próximo seguimiento empieza enviando de inmediato. */
  reiniciar: () => void;
}

export const crearCanalUbicacion = ({
  obtenerSocket,
  obtenerJwt,
  fetchImpl,
  url,
  sectorDe,
  ahora = Date.now,
  alEnviar,
}: DependenciasCanal): CanalUbicacion => {
  let ultimo: UltimoEnvio | null = null;
  const anotar = (punto: Punto): ResultadoEnvio => {
    ultimo = { lat: punto.lat, lng: punto.lng, en: ahora() };
    alEnviar?.(ultimo);
    return 'ok';
  };

  const enviar = async (punto: Punto): Promise<ResultadoEnvio> => {
    const datos = { sectorId: sectorDe(punto), coords: { lat: punto.lat, lng: punto.lng } };
    const socket = obtenerSocket();
    if (socket?.connected) {
      socket.emit('update_location', datos);
      return anotar(punto);
    }
    try {
      const jwt = await obtenerJwt();
      if (!jwt) return 'detener';
      const respuesta = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
      if (respuesta.ok) return anotar(punto);
      if (respuesta.status === 403 || respuesta.status === 409) return 'detener';
      return 'error';
    } catch {
      return 'error';
    }
  };

  return { enviar, ultimoEnvio: () => ultimo, reiniciar: () => { ultimo = null; } };
};

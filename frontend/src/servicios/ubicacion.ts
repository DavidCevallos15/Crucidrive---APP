import { API_CONFIG } from '../constants/config';
import { findNearestSector } from '../constants/sectors';
import { supabase } from '../utils/supabaseClient';
import { crearCanalUbicacion, type SocketUbicacion } from './canalUbicacion';

/**
 * Canal único de la ubicación del conductor (paso 004, P11). Lo usan la consola (app
 * abierta) y la tarea de segundo plano. `useSocket` le presta el socket mientras existe;
 * si la app se relanza sin interfaz para la tarea, no hay socket y se usa REST.
 */
// Cada pantalla con useSocket tiene el suyo (consola, chat): sirve cualquiera conectado.
const sockets = new Set<SocketUbicacion>();

/** Lo llama `useSocket` al crear un socket. */
export const prestarSocket = (socket: SocketUbicacion) => {
  sockets.add(socket);
};

/** Lo llama `useSocket` al cerrarlo. */
export const devolverSocket = (socket: SocketUbicacion) => {
  sockets.delete(socket);
};

const socketConectado = (): SocketUbicacion | null => {
  for (const socket of sockets) if (socket.connected) return socket;
  return null;
};

export const canalUbicacion = crearCanalUbicacion({
  obtenerSocket: socketConectado,
  obtenerJwt: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  },
  fetchImpl: (...args) => fetch(...args),
  url: `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.driver.location}`,
  sectorDe: ({ lat, lng }) => findNearestSector(lat, lng).id,
});

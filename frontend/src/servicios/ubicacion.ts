import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Hora del último envío correcto, guardada para "Estuviste fuera del despacho" (criterio 20):
// si el sistema mata la app, al volver a abrirla la memoria está vacía.
const CLAVE_ULTIMO_ENVIO = 'crucidrive.ubicacion.ultimoEnvio';

const leerGuardado = async (): Promise<number | null> => {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_ULTIMO_ENVIO);
    const valor = crudo ? Number(crudo) : NaN;
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
};

// Se lee al cargar el módulo, antes de que la consola o la tarea envíen nada.
const envioAlAbrir = leerGuardado();

/** Último envío correcto de la sesión anterior de la app (antes de abrirla esta vez). */
export const ultimoEnvioAlAbrir = (): Promise<number | null> => envioAlAbrir;

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
  alEnviar: ({ en }) => {
    AsyncStorage.setItem(CLAVE_ULTIMO_ENVIO, String(en)).catch(() => undefined);
  },
});

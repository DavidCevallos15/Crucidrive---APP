import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { crearRegistroAvisos } from './registroAvisos';

/**
 * Avisos del teléfono (paso 004, plan P3 y Frontend): canales de Android y registro del
 * token de Expo con el backend. La lógica está en `registroAvisos.ts`.
 */

/** Mismos nombres que `channelId` en `backend/src/avisos/mensajes.js`. */
export const CANAL_OFERTAS = 'ofertas';
export const CANAL_VIAJE = 'viaje';

/**
 * Crea los canales de Android. Debe ir antes de pedir el token: desde Android 13 el
 * diálogo de permiso no aparece hasta que existe un canal.
 */
export const configurarCanales = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_OFERTAS, {
    name: 'Ofertas de viaje',
    description: 'Un pasajero te pide un viaje. Tienes pocos segundos para aceptarlo.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
  });
  await Notifications.setNotificationChannelAsync(CANAL_VIAJE, {
    name: 'Estado de tu viaje',
    description: 'Cuando un conductor acepta tu viaje o no hay conductores.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
};

/**
 * Token de Expo de este teléfono, o null si no puede recibir avisos: en la web, en Expo Go
 * (no admite avisos remotos en Android) o si el usuario negó el permiso.
 */
export const obtenerTokenExpo = async (): Promise<string | null> => {
  if (Platform.OS === 'web') return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;

  await configurarCanales();
  const actual = await Notifications.getPermissionsAsync();
  let estado = actual.status;
  if (estado !== 'granted' && actual.canAskAgain) {
    estado = (await Notifications.requestPermissionsAsync()).status;
  }
  if (estado !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
};

const { dispositivos } = API_CONFIG.endpoints;

/** Registro único de la app: se usa al iniciar y al cerrar sesión (criterio 11). */
export const registroAvisos = crearRegistroAvisos({
  obtenerToken: obtenerTokenExpo,
  api: {
    registrar: async (token) => {
      const respuesta = await authFetch(dispositivos.registrar, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return respuesta.ok;
    },
    olvidar: async (token) => {
      const respuesta = await authFetch(dispositivos.olvidar(token), { method: 'DELETE' });
      return respuesta.ok;
    },
  },
});

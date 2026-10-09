import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { crearRegistroAvisos } from './registroAvisos';
import { leerDatosAviso, mostrarEnPrimerPlano, type EstadoConsola } from '../utils/avisoOferta';

/**
 * Avisos del teléfono (paso 004, plan P3, P6 a P8 y Frontend): canales de Android, registro
 * del token de Expo con el backend, qué se muestra con la app abierta y descarte de los
 * avisos de ofertas que ya no valen. La lógica está en `registroAvisos.ts` y `avisoOferta.ts`.
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

// ─── Con la app abierta (P6, criterio 9) ────────────────────────────────────
const consola: EstadoConsola = { abierta: false, conectada: false };

/** La consola del conductor avisa si está en pantalla y si su socket está conectado. */
export const marcarConsola = (cambios: Partial<EstadoConsola>) => {
  Object.assign(consola, cambios);
};

/** Decide si un aviso que llega con la app en primer plano se muestra. Una vez, al iniciar. */
export const configurarManejadorAvisos = () => {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async (aviso) => {
      const mostrar = mostrarEnPrimerPlano(leerDatosAviso(aviso.request.content.data), consola);
      return { shouldShowBanner: mostrar, shouldShowList: mostrar, shouldPlaySound: mostrar, shouldSetBadge: false };
    },
  });
};

// ─── Retirada de la oferta (P8, criterio 8) ─────────────────────────────────
/**
 * Quita de la barra los avisos de la oferta de ese viaje: venció, la tomó otro, el pasajero
 * canceló o el conductor ya respondió. Si falla, tocar el aviso igual comprueba la BD (7).
 */
export const descartarAvisosDeOferta = async (viajeId: string): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    const presentes = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(presentes
      .filter((aviso) => {
        const datos = leerDatosAviso(aviso.request.content.data);
        return datos?.tipo === 'oferta' && datos.viajeId === viajeId;
      })
      .map((aviso) => Notifications.dismissNotificationAsync(aviso.request.identifier)));
  } catch (error) {
    console.warn('[Avisos] No se pudo quitar el aviso de la oferta:', error);
  }
};

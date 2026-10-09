import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canalUbicacion } from '../servicios/ubicacion';
import {
  debeEnviar,
  leerParametros,
  PARAMETROS_POR_DEFECTO,
  type ParametrosUbicacion,
} from '../utils/seguimiento';

/**
 * Ubicación del conductor en segundo plano (paso 004, plan P10 a P13). Se importa en
 * `index.ts`, antes de Expo Router: si Android relanza la app sin interfaz para la tarea,
 * la tarea tiene que estar definida en el ámbito global.
 */

export const TAREA_UBICACION = 'crucidrive-ubicacion-fondo';
const CLAVE_PARAMETROS = 'crucidrive.ubicacion.parametros';
const COLOR_AVISO = '#0D9488';

const soportado = Platform.OS !== 'web';
let parametros: ParametrosUbicacion | null = null;

/** Si la app se relanzó sin interfaz, las frecuencias salen de lo guardado al iniciar. */
const parametrosVigentes = async (): Promise<ParametrosUbicacion> => {
  if (parametros) return parametros;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_PARAMETROS);
    parametros = leerParametros(crudo ? JSON.parse(crudo) : null);
  } catch {
    parametros = PARAMETROS_POR_DEFECTO;
  }
  return parametros;
};

/** Apaga el GPS y el aviso permanente (criterio 2, P13). No falla si ya estaba apagado. */
export const detenerSeguimientoFondo = async (): Promise<void> => {
  canalUbicacion.reiniciar();
  if (!soportado) return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) {
      await Location.stopLocationUpdatesAsync(TAREA_UBICACION);
    }
  } catch (error) {
    console.warn('[Ubicación] No se pudo detener el seguimiento:', error);
  }
};

if (soportado) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TAREA_UBICACION, async ({ data, error }) => {
    if (error) {
      console.warn('[Ubicación] Error de la tarea:', error.message);
      return;
    }
    const posiciones = data?.locations ?? [];
    if (posiciones.length === 0) return;
    // Con la app abierta envía la consola, cada abiertaSeg (P12).
    if (AppState.currentState === 'active') return;

    const ultima = posiciones[posiciones.length - 1];
    const punto = { lat: ultima.coords.latitude, lng: ultima.coords.longitude };
    if (!debeEnviar(canalUbicacion.ultimoEnvio(), punto, Date.now(), await parametrosVigentes())) return;
    // 403 o sin sesión: el servidor ya no acepta la ubicación de esta cuenta (P13).
    if ((await canalUbicacion.enviar(punto)) === 'detener') await detenerSeguimientoFondo();
  });
}

/**
 * Arranca (o actualiza) el seguimiento con el servicio en primer plano y su aviso
 * permanente (criterios 1 y 3). Devuelve false si el teléfono no lo permite: en la web, en
 * Expo Go o sin permiso en segundo plano.
 */
export const iniciarSeguimientoFondo = async (nuevos: ParametrosUbicacion): Promise<boolean> => {
  if (!soportado) return false;
  parametros = nuevos;
  try {
    await AsyncStorage.setItem(CLAVE_PARAMETROS, JSON.stringify(nuevos));
  } catch {
    // Sin guardar, un relanzamiento sin interfaz usa los valores por defecto.
  }
  try {
    await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: nuevos.fondoMovSeg * 1000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'CruciDrive está usando tu ubicación',
        notificationBody: 'Porque estás disponible o en un viaje. Abre la app para dejar de estar disponible.',
        notificationColor: COLOR_AVISO,
      },
    });
    return true;
  } catch (error) {
    console.warn('[Ubicación] No se pudo iniciar el seguimiento en segundo plano:', error);
    return false;
  }
};

/** Permisos actuales, sin preguntar nada. */
export const leerPermisosUbicacion = async () => {
  if (!soportado) return { primerPlano: false, segundoPlano: false, puedePreguntar: false };
  try {
    const [primerPlano, segundoPlano] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    return {
      primerPlano: primerPlano.granted,
      segundoPlano: segundoPlano.granted,
      puedePreguntar: segundoPlano.canAskAgain,
    };
  } catch {
    return { primerPlano: false, segundoPlano: false, puedePreguntar: false };
  }
};

/** El diálogo del sistema. Solo después de la explicación propia (criterio 5, P19). */
export const pedirPermisoFondo = async (): Promise<boolean> => {
  if (!soportado) return false;
  try {
    return (await Location.requestBackgroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
};

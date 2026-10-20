import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { avisosDisponibles, crearCargador } from '../utils/cargadorAvisos';

type Notificaciones = typeof import('expo-notifications');

/** Fijo mientras la app corre: depende de la plataforma y de si es Expo Go. */
export const AVISOS_DISPONIBLES = avisosDisponibles({
  web: Platform.OS === 'web',
  expoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
});

/**
 * `expo-notifications`, o `null` en la web y en Expo Go (donde ni siquiera se importa: lanza
 * "Android Push notifications ... was removed from Expo Go"). Todo el código de avisos pasa por
 * aquí; ningún otro archivo debe importarlo de forma estática (salvo `import type`).
 */
export const notificaciones = crearCargador<Notificaciones>(
  AVISOS_DISPONIBLES,
  // require dentro de la función: Metro no ejecuta el módulo hasta que se llama.
  () => require('expo-notifications')
);

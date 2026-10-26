import { Platform } from 'react-native';
import type { EstadoActualizacion } from '../utils/actualizacion';

/**
 * Estado de `expo-updates` leído sin romper la web ni las pruebas: el módulo se importa dentro de
 * la función y, si falla, se devuelve «sin actualizaciones».
 */
export const leerEstadoActualizacion = (): EstadoActualizacion => {
  const ninguna: EstadoActualizacion = { habilitadas: false, deFabrica: true, updateId: null, creadaEn: null, canal: null };
  if (Platform.OS === 'web') return ninguna;
  try {
    const Updates = require('expo-updates') as typeof import('expo-updates');
    return {
      habilitadas: Updates.isEnabled,
      deFabrica: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId ?? null,
      creadaEn: Updates.createdAt ?? null,
      canal: Updates.channel ?? null,
    };
  } catch {
    return ninguna;
  }
};

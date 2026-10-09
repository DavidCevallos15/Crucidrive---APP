import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { configurarManejadorAvisos, descartarAvisosDeOferta } from '../servicios/avisos';
import { leerDatosAviso } from '../utils/avisoOferta';

/**
 * Avisos de datos con la app en segundo plano o cerrada (paso 004, P8a). Hoy solo hay uno:
 * `oferta_retirada`, que borra de la barra el aviso de esa oferta. Android no garantiza
 * entregarlo con el teléfono en reposo; por eso tocar el aviso igual comprueba la BD (P8b).
 * Se importa en `index.ts`: la tarea tiene que definirse y registrarse en el ámbito global.
 */
export const TAREA_AVISOS = 'crucidrive-avisos-fondo';

// Qué se muestra con la app abierta (P6): antes de que llegue el primer aviso.
configurarManejadorAvisos();

if (Platform.OS !== 'web') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(TAREA_AVISOS, async ({ data }) => {
    const carga = data && 'data' in data ? data.data : null;
    const datos = leerDatosAviso(carga);
    if (datos?.tipo === 'oferta_retirada') await descartarAvisosDeOferta(datos.viajeId);
  });
  Notifications.registerTaskAsync(TAREA_AVISOS).catch((error) => {
    // En Expo Go no hay avisos remotos: la app sigue igual.
    console.warn('[Avisos] No se pudo registrar la tarea de segundo plano:', error);
  });
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { leerRegistro, type RegistroCalificacion } from '../utils/viajePasajero';

/**
 * Lo que el teléfono recuerda para ofrecer calificar «una sola vez más» (paso 005, criterio 15).
 * Solo guarda el id del viaje y un contador: sin nombres ni ubicaciones (LOPDP). La clave lleva
 * el id del usuario para no mezclar cuentas en el mismo teléfono. Si falla, la app sigue igual.
 */
const clave = (userId: string) => `crucidrive:calificacion:v1:${userId}`;

export const leerRegistroCalificacion = async (userId: string): Promise<RegistroCalificacion | null> => {
  try {
    return leerRegistro(await AsyncStorage.getItem(clave(userId)));
  } catch {
    return null;
  }
};

export const guardarRegistroCalificacion = async (userId: string, registro: RegistroCalificacion): Promise<void> => {
  try {
    await AsyncStorage.setItem(clave(userId), JSON.stringify(registro));
  } catch {
    // Sin poder guardar, a lo sumo se vuelve a ofrecer una vez más.
  }
};

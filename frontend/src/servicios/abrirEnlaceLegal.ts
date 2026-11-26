import { Linking } from 'react-native';

/**
 * Abre un documento legal público en el navegador del dispositivo de forma segura.
 * Devuelve true si pudo abrirse y false si el sistema no lo permitió.
 */
export const openLegalUrl = async (url: string): Promise<boolean> => {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

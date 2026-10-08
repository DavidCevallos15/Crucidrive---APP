import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Lado largo máximo de las fotos de verificación, en píxeles. */
export const LADO_MAXIMO_PX = 1280;
/** Calidad JPEG: con 1280 px y 0,6 cada foto pesa ~150 a 300 KB (presupuesto de datos, regla 5). */
export const CALIDAD_JPEG = 0.6;
/** El bucket de Storage rechaza archivos de más de 1 MB. */
export const TAMANO_MAXIMO_BYTES = 1024 * 1024;

/**
 * Calcula el tamaño reducido manteniendo la proporción. Nunca agranda.
 * @returns Nuevo ancho y alto, o null si la imagen ya cabe y no hace falta reducirla.
 */
export const dimensionesReducidas = (
  ancho: number,
  alto: number,
  maximo: number = LADO_MAXIMO_PX
): { width: number; height: number } | null => {
  if (!(ancho > 0) || !(alto > 0)) return null;
  const mayor = Math.max(ancho, alto);
  if (mayor <= maximo) return null;
  const factor = maximo / mayor;
  return { width: Math.round(ancho * factor), height: Math.round(alto * factor) };
};

/**
 * Reduce una foto del teléfono (3 a 8 MB) a un JPEG liviano antes de subirla.
 * @returns URI local del JPEG resultante.
 */
export const reducirFoto = async (uri: string, ancho: number, alto: number): Promise<string> => {
  const nuevo = dimensionesReducidas(ancho, alto);
  const resultado = await manipulateAsync(uri, nuevo ? [{ resize: nuevo }] : [], {
    compress: CALIDAD_JPEG,
    format: SaveFormat.JPEG,
  });
  return resultado.uri;
};

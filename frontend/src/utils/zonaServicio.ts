import { SECTORS } from '../constants/sectors';
import type { Punto } from './geo';

/** Aproximación del piloto: envolvente de los centros + radio del importador (1500 m).
 * No es una frontera administrativa ni restringe el despacho del servidor. */
const MARGEN_LAT = 1500 / 111_320;
const MARGEN_LNG = 1500 / (111_320 * Math.cos(-0.85 * Math.PI / 180));
export const ZONA_PILOTO = {
  sur: Math.min(...SECTORS.map((s) => s.center.lat)) - MARGEN_LAT,
  norte: Math.max(...SECTORS.map((s) => s.center.lat)) + MARGEN_LAT,
  oeste: Math.min(...SECTORS.map((s) => s.center.lng)) - MARGEN_LNG,
  este: Math.max(...SECTORS.map((s) => s.center.lng)) + MARGEN_LNG,
};

export const AVISO_FUERA_ZONA = 'Estás fuera de la zona de servicio de Crucita';

export interface Caja { sur: number; oeste: number; norte: number; este: number }

/** Lado máximo de la zona de prueba: una ciudad, no una provincia (un error no abre el mundo). */
const LADO_MAX_PRUEBA = 2;

/**
 * Zona de prueba del APK `preview` (012, criterio 8a): «sur,oeste,norte,este» en grados.
 * Un valor vacío, mal escrito, invertido o demasiado grande se ignora y solo vale Crucita.
 */
export function leerZonaPrueba(texto: string | null | undefined): Caja | null {
  if (!texto) return null;
  const n = texto.split(',').map((v) => Number(v.trim()));
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v))) return null;
  const [sur, oeste, norte, este] = n;
  if (Math.abs(sur) > 90 || Math.abs(norte) > 90 || Math.abs(oeste) > 180 || Math.abs(este) > 180) return null;
  if (sur >= norte || oeste >= este) return null;
  if (norte - sur > LADO_MAX_PRUEBA || este - oeste > LADO_MAX_PRUEBA) return null;
  return { sur, oeste, norte, este };
}

// Acceso literal: Expo solo incrusta en el bundle las variables leídas así. Solo el entorno
// `preview` de EAS la define; producción no.
const ZONA_PRUEBA = leerZonaPrueba(process.env.EXPO_PUBLIC_ZONA_PRUEBA);

const dentroDe = (c: Punto, caja: Caja) =>
  c.lat >= caja.sur && c.lat <= caja.norte && c.lng >= caja.oeste && c.lng <= caja.este;

export function estadoZona(coords: Punto | null, zonaPrueba: Caja | null = ZONA_PRUEBA): 'dentro' | 'fuera' | 'desconocida' {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)
    || Math.abs(coords.lat) > 90 || Math.abs(coords.lng) > 180) return 'desconocida';
  return dentroDe(coords, ZONA_PILOTO) || (zonaPrueba !== null && dentroDe(coords, zonaPrueba)) ? 'dentro' : 'fuera';
}

/** Un origen manual válido sigue disponible aunque el GPS esté fuera o ausente. */
export function gpsDeServicio(coords: Punto | null, sectorId: string | null) {
  return coords && sectorId && estadoZona(coords) === 'dentro' ? { coords, sectorId } : null;
}

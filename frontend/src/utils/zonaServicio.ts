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

export function estadoZona(coords: Punto | null): 'dentro' | 'fuera' | 'desconocida' {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)
    || Math.abs(coords.lat) > 90 || Math.abs(coords.lng) > 180) return 'desconocida';
  return coords.lat >= ZONA_PILOTO.sur && coords.lat <= ZONA_PILOTO.norte
    && coords.lng >= ZONA_PILOTO.oeste && coords.lng <= ZONA_PILOTO.este ? 'dentro' : 'fuera';
}

/** Un origen manual válido sigue disponible aunque el GPS esté fuera o ausente. */
export function gpsDeServicio(coords: Punto | null, sectorId: string | null) {
  return coords && sectorId && estadoZona(coords) === 'dentro' ? { coords, sectorId } : null;
}

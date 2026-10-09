import { SECTORS } from '../constants/sectors';
import type { RideStatus } from '../store/useRideStore';
import type { Punto } from './geo';
import type { Gps, Origen } from './solicitud';

/**
 * El pasajero ve a su conductor durante el viaje (paso 004, criterios 13, 15 y 17; plan P17).
 * Funciones puras: el hook `useConductorDelViaje` y las pruebas las usan igual.
 */

/** Última posición conocida del conductor del viaje. `en` es la hora del servidor (ms). */
export interface PosicionConductor extends Punto {
  viajeId: string;
  en: number;
}

/** Pasado este tiempo sin datos, el mapa dice "Última posición hace X s" (criterio 17). */
export const UMBRAL_FRESCURA_SEG = 15;

/** Solo con el viaje aceptado o en curso; al terminar deja de verse (criterio 15). */
export const debeVerConductor = (status: RideStatus | null | undefined): boolean =>
  status === 'aceptado' || status === 'en_curso';

const esCoordenada = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === 'number' && typeof lng === 'number'
  && Number.isFinite(lat) && Number.isFinite(lng)
  && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * `conductor_ubicacion { viajeId, lat, lng, en }` por socket, o una fila de la RPC
 * `ubicacion_conductor_viaje` `{ lat, lng, actualizado_en }`. Solo vale si es del viaje actual.
 */
export const leerPosicion = (datos: unknown, viajeId: string): PosicionConductor | null => {
  if (!datos || typeof datos !== 'object') return null;
  const d = datos as Record<string, unknown>;
  if (d.viajeId !== undefined && d.viajeId !== viajeId) return null;
  if (!esCoordenada(d.lat, d.lng)) return null;
  const en = Date.parse(String(d.en ?? d.actualizado_en ?? ''));
  if (!Number.isFinite(en)) return null;
  return { viajeId, lat: d.lat as number, lng: d.lng as number, en };
};

/** Gana la más reciente: un evento atrasado no hace retroceder al conductor. */
export const alRecibirPosicion = (
  actual: PosicionConductor | null,
  nueva: PosicionConductor | null
): PosicionConductor | null => {
  if (!nueva) return actual;
  if (!actual || actual.viajeId !== nueva.viajeId || nueva.en >= actual.en) return nueva;
  return actual;
};

/** "" si la posición es fresca; si no, "Última posición hace 40 s" o "hace 3 min". */
export const textoUltimaPosicion = (en: number, ahora: number): string => {
  const seg = Math.max(0, Math.floor((ahora - en) / 1000));
  if (seg <= UMBRAL_FRESCURA_SEG) return '';
  if (seg < 60) return `Última posición hace ${seg} s`;
  return `Última posición hace ${Math.floor(seg / 60)} min`;
};

/** Punto de partida del viaje para medir la distancia: el elegido o, si no, el GPS. */
export const puntoDeOrigen = (origen: Origen | null | undefined, gps: Gps): Punto | null => {
  if (origen?.tipo === 'gps') return { lat: origen.coords.lat, lng: origen.coords.lng };
  if (origen?.tipo === 'lugar') return { lat: origen.lugar.lat, lng: origen.lugar.lng };
  if (origen?.tipo === 'sector') {
    const sector = SECTORS.find((s) => s.id === origen.sectorId);
    if (sector) return { lat: sector.center.lat, lng: sector.center.lng };
  }
  return gps ? { lat: gps.coords.lat, lng: gps.coords.lng } : null;
};

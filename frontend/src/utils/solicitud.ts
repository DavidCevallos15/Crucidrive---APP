import { SECTORS } from '../constants/sectors';
import type { Lugar } from './lugares';

/**
 * Solicitud de viaje del pasajero (paso 003, T13). Sin React, para poder probarla.
 *
 * El origen sale del GPS si está activo y, si no, de un lugar o un sector que elige el
 * pasajero (criterio 21). El servidor fija la tarifa y, con un lugar, sus coordenadas y su
 * sector (criterio 19): aquí solo se arma lo que se envía.
 */

export interface Coordenadas {
  lat: number;
  lng: number;
}

export type Origen =
  | { tipo: 'gps'; coords: Coordenadas; sectorId: string }
  | { tipo: 'lugar'; lugar: Lugar }
  | { tipo: 'sector'; sectorId: string };

export type Destino =
  | { tipo: 'lugar'; lugar: Lugar }
  | { tipo: 'sector'; sectorId: string };

/** Lo que el pasajero rellenó. Se guarda para "Volver a pedir" sin rellenar de nuevo (criterio 11). */
export interface Solicitud {
  origen: Origen;
  destino: Destino;
  pasajeros: number;
  /** Referencia escrita del punto de partida (opcional). */
  origenNota: string;
  /** Referencia escrita del destino (opcional). */
  destinoNota: string;
}

/** Ubicación del GPS con su sector, o null si no hay permiso o aún no hay posición. */
export type Gps = { coords: Coordenadas; sectorId: string } | null;

export const nombreSector = (id: string | null | undefined): string =>
  SECTORS.find((s) => s.id === id)?.name ?? '';

/**
 * Origen efectivo (criterio 21): el que eligió el pasajero o, si no eligió, su GPS.
 * null si no hay GPS ni elección: hay que pedirle desde dónde sale.
 */
export const resolverOrigen = (elegido: Origen | null, gps: Gps): Origen | null => {
  if (elegido) return elegido;
  return gps ? { tipo: 'gps', coords: gps.coords, sectorId: gps.sectorId } : null;
};

/** Sector del origen, si se conoce sin preguntar al servidor (un lugar puede no tenerlo). */
export const sectorDeOrigen = (origen: Origen | null): string | null => {
  if (!origen) return null;
  if (origen.tipo === 'lugar') return origen.lugar.sector_id;
  return origen.sectorId;
};

export const nombreOrigen = (origen: Origen | null): string => {
  if (!origen) return '';
  if (origen.tipo === 'lugar') return origen.lugar.nombre;
  if (origen.tipo === 'gps') return `Tu ubicación · ${nombreSector(origen.sectorId)}`;
  return nombreSector(origen.sectorId);
};

export const nombreDestino = (destino: Destino | null): string => {
  if (!destino) return '';
  return destino.tipo === 'lugar' ? destino.lugar.nombre : nombreSector(destino.sectorId);
};

/** Centro del sector: punto de partida o llegada cuando el pasajero elige solo el sector. */
const centroSector = (id: string): Coordenadas | null => SECTORS.find((s) => s.id === id)?.center ?? null;

/**
 * Cuerpo de POST /api/viajes/solicitar. No lleva precio: lo calcula la BD (D-08).
 * Con un lugar solo va su id; la BD toma coordenadas, nombre y sector (criterio 19).
 * Lanza un error si un sector no existe (no debería pasar con la UI).
 */
export const armarCuerpoSolicitud = (s: Solicitud): Record<string, unknown> => {
  const cuerpo: Record<string, unknown> = { pasajeros: s.pasajeros };

  if (s.origen.tipo === 'lugar') {
    cuerpo.lugarOrigenId = s.origen.lugar.id;
  } else {
    const coords = s.origen.tipo === 'gps' ? s.origen.coords : centroSector(s.origen.sectorId);
    if (!coords) throw new Error('Sector de origen desconocido.');
    cuerpo.origen = coords;
    cuerpo.sectorOrigenId = s.origen.sectorId;
  }

  if (s.destino.tipo === 'lugar') {
    cuerpo.lugarDestinoId = s.destino.lugar.id;
  } else {
    const coords = centroSector(s.destino.sectorId);
    if (!coords) throw new Error('Sector de destino desconocido.');
    cuerpo.destino = coords;
    cuerpo.sectorDestinoId = s.destino.sectorId;
  }

  const origenNota = s.origenNota.trim();
  const destinoNota = s.destinoNota.trim();
  if (origenNota) cuerpo.origenDescripcion = origenNota;
  if (destinoNota) cuerpo.destinoDescripcion = destinoNota;
  return cuerpo;
};

/**
 * Para "Volver a pedir": si el origen era el GPS, se usa la posición actual
 * (el pasajero pudo moverse mientras se buscaba). Lo demás queda igual.
 */
export const refrescarOrigen = (s: Solicitud, gps: Gps): Solicitud =>
  s.origen.tipo === 'gps' && gps
    ? { ...s, origen: { tipo: 'gps', coords: gps.coords, sectorId: gps.sectorId } }
    : s;

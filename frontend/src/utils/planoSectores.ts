import type { SectorCoordinate } from '../constants/sectors';

/**
 * Plano simple de los sectores sin internet (017, P3). Sin React, para poder probarlo.
 */

/** Caja del plano en píxeles. Los márgenes laterales dejan sitio a los nombres de los sectores. */
export interface CajaPlano {
  ancho: number;
  alto: number;
  /** Espacio a cada lado de los puntos para los nombres. */
  margenX: number;
  margenY: number;
}

export interface PuntoPlano {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;

/**
 * Proyección equirectangular: norte arriba y oeste (el mar) a la izquierda. La longitud se
 * corrige por cos(lat) para que los dos ejes tengan la misma escala y la costa no se deforme.
 * Los puntos de referencia quedan centrados en el área libre de la caja.
 */
export const crearProyeccion = (referencias: SectorCoordinate[], caja: CajaPlano) => {
  if (referencias.length === 0) throw new Error('El plano necesita al menos un punto de referencia.');
  const latMedia = referencias.reduce((suma, c) => suma + c.lat, 0) / referencias.length;
  const kx = Math.cos(latMedia * RAD);
  const xs = referencias.map((c) => c.lng * kx);
  const ys = referencias.map((c) => c.lat);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const spanX = Math.max(Math.max(...xs) - minX, 1e-9);
  const spanY = Math.max(maxY - Math.min(...ys), 1e-9);
  const anchoUtil = Math.max(1, caja.ancho - 2 * caja.margenX);
  const altoUtil = Math.max(1, caja.alto - 2 * caja.margenY);
  const escala = Math.min(anchoUtil / spanX, altoUtil / spanY);
  const offX = caja.margenX + (anchoUtil - spanX * escala) / 2;
  const offY = caja.margenY + (altoUtil - spanY * escala) / 2;
  return (c: SectorCoordinate): PuntoPlano => ({
    x: offX + (c.lng * kx - minX) * escala,
    y: offY + (maxY - c.lat) * escala,
  });
};

export const dentroDeCaja = (p: PuntoPlano, caja: Pick<CajaPlano, 'ancho' | 'alto'>): boolean =>
  p.x >= 0 && p.x <= caja.ancho && p.y >= 0 && p.y <= caja.alto;

const par = (p: PuntoPlano): string => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;

/** La línea de los sectores, de norte a sur, para un `Polyline` de SVG. */
export const lineaSectores = (norteASur: PuntoPlano[]): string => norteASur.map(par).join(' ');

/**
 * El mar: todo lo que queda a la izquierda de la línea de los sectores, corrida `corrimiento`
 * px hacia el oeste para que los puntos queden en tierra. Atributo `points` de un `Polygon`.
 */
export const contornoMar = (norteASur: PuntoPlano[], caja: Pick<CajaPlano, 'alto'>, corrimiento = 14): string => {
  if (norteASur.length === 0) return '';
  const costa = norteASur.map((p) => ({ x: Math.max(0, p.x - corrimiento), y: p.y }));
  const primero = costa[0];
  const ultimo = costa[costa.length - 1];
  return [{ x: 0, y: 0 }, { x: primero.x, y: 0 }, ...costa, { x: ultimo.x, y: caja.alto }, { x: 0, y: caja.alto }]
    .map(par)
    .join(' ');
};

/** Lado del nombre: alternado de norte a sur para que dos sectores cercanos no se tapen. */
export const ladoEtiqueta = (indiceNorteASur: number): 'derecha' | 'izquierda' =>
  indiceNorteASur % 2 === 0 ? 'derecha' : 'izquierda';

import { nombreSector } from './solicitud';

/**
 * Oferta de viaje que recibe el conductor (paso 003, T14). Sin React, para poder probarla.
 * El payload lo arma el backend (src/despacho/oferta.js, plan R13): sin teléfono, nombre
 * ni coordenadas del pasajero (criterio 15).
 */

export interface PuntoOferta {
  sectorId: string | null;
  descripcion: string | null;
}

export interface OfertaViaje {
  viajeId: string;
  pasajeros: number;
  tarifa: number;
  origen: PuntoOferta;
  destino: PuntoOferta;
  /** Distancia en línea recta del conductor al origen; null si la BD no la tiene. */
  distanciaM: number | null;
  fase: 'secuencial' | 'abierta';
  /** Fin de la oferta en milisegundos según el reloj del servidor. */
  venceEn: number;
}

/**
 * Desfase del reloj del teléfono respecto al servidor (plan R14), medido con `hora_servidor`
 * al conectar. Positivo si el servidor va adelantado.
 */
export const calcularDesfase = (ahoraServidor: number, ahoraLocal: number): number =>
  Number.isFinite(ahoraServidor) ? ahoraServidor - ahoraLocal : 0;

/**
 * Segundos que le quedan a la oferta según el reloj del servidor, no un contador local fijo:
 * si la oferta llegó con retraso, la pantalla muestra lo mismo que la BD (R14).
 */
export const segundosRestantes = (venceEn: number, desfaseMs: number, ahoraLocal: number): number =>
  Math.max(0, Math.ceil((venceEn - (ahoraLocal + desfaseMs)) / 1000));

/** "Muelle de Crucita · Los Arenales", o solo el sector si no hay referencia. */
export const textoPunto = (punto: PuntoOferta): string => {
  const sector = nombreSector(punto.sectorId);
  const descripcion = punto.descripcion?.trim();
  if (descripcion && sector) return `${descripcion} · ${sector}`;
  return descripcion || sector || 'Sin referencia';
};

/** "a 350 m" o "a 1,2 km" (criterio 15); vacío si no se conoce. */
export const textoDistancia = (metros: number | null): string => {
  if (metros == null || !Number.isFinite(metros)) return '';
  if (metros < 1000) return `a ${Math.max(10, Math.round(metros / 10) * 10)} m`;
  return `a ${(metros / 1000).toFixed(1).replace('.', ',')} km`;
};

/** Una oferta a la vez (criterio 7): la nueva reemplaza a la anterior. */
export const alRecibirOferta = (_actual: OfertaViaje | null, nueva: OfertaViaje): OfertaViaje => nueva;

/** `oferta_retirada`: venció, la tomó otro o el pasajero canceló (criterio 12). */
export const alRetirarOferta = (actual: OfertaViaje | null, viajeId: string): OfertaViaje | null =>
  actual && actual.viajeId === viajeId ? null : actual;

/** Estado de la tricimoto según la BD (`tricimotos.estado`). */
export type EstadoTricimoto = 'disponible' | 'ocupado' | 'inactivo';

/** Mensajes del servidor al cambiar la disponibilidad (PATCH /api/conductores/disponibilidad). */
export const estadoTrasError = (status: number, actual: EstadoTricimoto | null): EstadoTricimoto | null =>
  status === 409 ? 'ocupado' : actual;

/**
 * Colores del modal de oferta (regla 6, criterio 28): fondo opaco, sin blur, para que se lea
 * igual en un teléfono modesto y a pleno sol. Cada par texto/fondo cumple AA (≥ 4,5:1).
 */
export const COLORES_OFERTA = {
  fondo: '#111827',
  texto: '#F1F5F9',
  textoSuave: '#CBD5E1',
  cuenta: '#FBBF24',
  aceptarFondo: '#F59E0B',
  aceptarTexto: '#0B0F19',
  rechazarFondo: '#B91C1C',
  rechazarTexto: '#FFFFFF',
  avisoFondo: '#7F1D1D',
  avisoTexto: '#FFFFFF',
} as const;

const luminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Razón de contraste WCAG entre dos colores #RRGGBB. */
export const contraste = (a: string, b: string): number => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

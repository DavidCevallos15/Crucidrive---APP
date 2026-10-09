import { SECTORS } from '../constants/sectors';
import type { CategoriaLugar } from './lugares';

/**
 * Lugares del catálogo para el administrador (paso 003, T15, criterio 24). Sin React.
 * Las reglas son las mismas de la BD (CHECK de 0011) y del backend (utils/validation.js):
 * aquí solo se avisa antes de enviar; el servidor vuelve a validar.
 */

/** Orden y nombres que ve el administrador. */
export const CATEGORIAS: { value: CategoriaLugar; label: string }[] = [
  { value: 'comida', label: 'Comida' },
  { value: 'hospedaje', label: 'Hospedaje' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'salud', label: 'Salud' },
  { value: 'educacion', label: 'Educación' },
  { value: 'religion', label: 'Religión' },
  { value: 'gobierno', label: 'Gobierno' },
  { value: 'turismo', label: 'Turismo' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'poblado', label: 'Poblado' },
  { value: 'otro', label: 'Otro' },
];

export const NOMBRE_LUGAR_MIN = 2;
export const NOMBRE_LUGAR_MAX = 120;

/** Lo que devuelve GET /api/admin/lugares (backend: lugaresController.aRespuesta). */
export interface LugarAdmin {
  id: string;
  nombre: string;
  categoria: CategoriaLugar;
  sector_id: string | null;
  fuente: 'osm' | 'admin' | 'david';
  visible: boolean;
  editado_por_admin: boolean;
  actualizado_en: string;
  lat: number | null;
  lng: number | null;
}

/** Campos del formulario tal como los escribe el administrador. */
export interface FormularioLugar {
  nombre: string;
  categoria: CategoriaLugar | '';
  /** Texto: acepta coma o punto decimal ("-0,8714"). */
  lat: string;
  lng: string;
  visible: boolean;
}

export type ErroresLugar = Partial<Record<'nombre' | 'categoria' | 'ubicacion', string>>;

export interface CuerpoLugar {
  nombre: string;
  categoria: CategoriaLugar;
  lat: number;
  lng: number;
  visible: boolean;
}

/** Igual que el backend: sin espacios a los lados ni repetidos. */
export const limpiarNombre = (nombre: string): string => nombre.trim().replace(/\s+/g, ' ');

const aNumero = (texto: string): number | null => {
  const limpio = texto.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  return Number(limpio);
};

// Zona de trabajo: los sectores de la parroquia con un margen de ~11 km. Fuera de ella es casi
// seguro un error de tipeo (latitud y longitud cruzadas, un signo olvidado).
const MARGEN = 0.1;
const ZONA = {
  latMin: Math.min(...SECTORS.map((s) => s.center.lat)) - MARGEN,
  latMax: Math.max(...SECTORS.map((s) => s.center.lat)) + MARGEN,
  lngMin: Math.min(...SECTORS.map((s) => s.center.lng)) - MARGEN,
  lngMax: Math.max(...SECTORS.map((s) => s.center.lng)) + MARGEN,
};

export const enZonaDeCrucita = (lat: number, lng: number): boolean =>
  lat >= ZONA.latMin && lat <= ZONA.latMax && lng >= ZONA.lngMin && lng <= ZONA.lngMax;

export const validarLugar = (
  f: FormularioLugar
): { ok: true; cuerpo: CuerpoLugar } | { ok: false; errores: ErroresLugar } => {
  const errores: ErroresLugar = {};
  const nombre = limpiarNombre(f.nombre);
  if (nombre.length < NOMBRE_LUGAR_MIN || nombre.length > NOMBRE_LUGAR_MAX) {
    errores.nombre = `El nombre debe tener entre ${NOMBRE_LUGAR_MIN} y ${NOMBRE_LUGAR_MAX} caracteres.`;
  }
  if (!CATEGORIAS.some((c) => c.value === f.categoria)) {
    errores.categoria = 'Elige una categoría.';
  }
  const lat = aNumero(f.lat);
  const lng = aNumero(f.lng);
  if (lat === null || lng === null) {
    errores.ubicacion = 'Marca el lugar en el mapa, usa tu ubicación o escribe latitud y longitud.';
  } else if (!enZonaDeCrucita(lat, lng)) {
    errores.ubicacion = 'Ese punto queda lejos de Crucita. Revisa latitud y longitud.';
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    cuerpo: { nombre, categoria: f.categoria as CategoriaLugar, lat: lat as number, lng: lng as number, visible: f.visible },
  };
};

/** Formulario a partir de un lugar existente, o vacío para uno nuevo. */
export const formularioDesde = (lugar: LugarAdmin | null): FormularioLugar => ({
  nombre: lugar?.nombre ?? '',
  categoria: lugar?.categoria ?? '',
  lat: lugar?.lat != null ? lugar.lat.toFixed(6) : '',
  lng: lugar?.lng != null ? lugar.lng.toFixed(6) : '',
  visible: lugar?.visible ?? true,
});

/**
 * Solo lo que cambió, para PATCH. La ubicación va completa (lat y lng juntos, como pide
 * el backend). Un objeto vacío significa que no hay nada que guardar.
 */
export const cambiosLugar = (original: LugarAdmin, cuerpo: CuerpoLugar): Partial<CuerpoLugar> => {
  const cambios: Partial<CuerpoLugar> = {};
  if (cuerpo.nombre !== original.nombre) cambios.nombre = cuerpo.nombre;
  if (cuerpo.categoria !== original.categoria) cambios.categoria = cuerpo.categoria;
  if (cuerpo.visible !== original.visible) cambios.visible = cuerpo.visible;
  const movido =
    original.lat == null || original.lng == null ||
    Math.abs(cuerpo.lat - original.lat) > 1e-6 || Math.abs(cuerpo.lng - original.lng) > 1e-6;
  if (movido) {
    cambios.lat = cuerpo.lat;
    cambios.lng = cuerpo.lng;
  }
  return cambios;
};

/** Ruta del formulario: "nuevo" crea; un id edita. */
export const ID_NUEVO = 'nuevo';

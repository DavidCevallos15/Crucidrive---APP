import { distanciaMetros, type Punto } from './geo';
import type { EstadoTricimoto } from './oferta';

/**
 * Seguimiento del conductor en segundo plano (paso 004, plan P10 a P13 y P19). Funciones
 * puras: la tarea, la consola y las pruebas las usan igual.
 */

/** Frecuencias que fija el servidor (D-13), en segundos. */
export interface ParametrosUbicacion {
  /** Con la app abierta: un envío cada tanto, como en el 003. */
  abiertaSeg: number;
  /** En segundo plano: cada cuánto se pide una posición al GPS. */
  fondoMovSeg: number;
  /** En segundo plano y detenido: cada cuánto se envía igual, para seguir siendo candidato. */
  fondoQuietoSeg: number;
}

/** Los mismos que usa el backend si no se configuran (`backend/src/ubicacion/config.js`). */
export const PARAMETROS_POR_DEFECTO: ParametrosUbicacion = {
  abiertaSeg: 5,
  fondoMovSeg: 10,
  fondoQuietoSeg: 30,
};

/** Un movimiento menor a esto es ruido del GPS o el conductor esperando en la parada. */
export const DISTANCIA_MINIMA_M = 15;

/** Último envío correcto, para decidir el siguiente. */
export interface UltimoEnvio extends Punto {
  /** Hora local del envío (ms). */
  en: number;
}

const enteroEntre = (valor: unknown, min: number, max: number): number | null =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max ? valor : null;

/**
 * Lee las frecuencias de la respuesta de disponibilidad. Si faltan o no tienen sentido,
 * usa las de por defecto: es mejor enviar a la frecuencia conocida que dejar de enviar.
 */
export const leerParametros = (crudo: unknown): ParametrosUbicacion => {
  const datos = (crudo ?? {}) as Partial<Record<keyof ParametrosUbicacion, unknown>>;
  const abiertaSeg = enteroEntre(datos.abiertaSeg, 2, 60);
  const fondoMovSeg = enteroEntre(datos.fondoMovSeg, 5, 120);
  const fondoQuietoSeg = enteroEntre(datos.fondoQuietoSeg, 10, 300);
  if (abiertaSeg === null || fondoMovSeg === null || fondoQuietoSeg === null || fondoQuietoSeg < fondoMovSeg) {
    return PARAMETROS_POR_DEFECTO;
  }
  return { abiertaSeg, fondoMovSeg, fondoQuietoSeg };
};

/**
 * Frecuencia adaptativa (criterio 19): envía si es la primera posición, si se movió más de
 * 15 m o si ya pasó el tiempo de "quieto" desde el último envío.
 */
export const debeEnviar = (
  ultimo: UltimoEnvio | null,
  actual: Punto,
  ahora: number,
  parametros: ParametrosUbicacion
): boolean => {
  if (!ultimo) return true;
  if (ahora - ultimo.en >= parametros.fondoQuietoSeg * 1000) return true;
  return distanciaMetros(ultimo, actual) > DISTANCIA_MINIMA_M;
};

/**
 * Disponible u ocupado se sigue (en un viaje, el pasajero ve al conductor, criterio 13).
 * No disponible, o sin saberlo todavía, se detiene (criterio 2).
 */
export const debeSeguir = (estado: EstadoTricimoto | null): boolean =>
  estado === 'disponible' || estado === 'ocupado';

/** Estado de los permisos de ubicación del teléfono. */
export interface EstadoPermisos {
  primerPlano: boolean;
  segundoPlano: boolean;
  /** El sistema todavía muestra el diálogo (no se negó "para siempre"). */
  puedePreguntar: boolean;
  /** Ya se mostró la explicación propia en esta sesión de la app. */
  yaExplicado: boolean;
}

/**
 * - `iniciar`: hay permiso en segundo plano.
 * - `explicar`: antes del diálogo del sistema, la explicación propia (criterio 5, P19).
 * - `solo_abierta`: sin permiso en segundo plano; puede seguir con la app abierta (criterio 4).
 * - `sin_ubicacion`: ni siquiera en primer plano; no puede recibir ofertas.
 */
export type DecisionPermiso = 'iniciar' | 'explicar' | 'solo_abierta' | 'sin_ubicacion';

export const decidirPermiso = (p: EstadoPermisos): DecisionPermiso => {
  if (!p.primerPlano) return 'sin_ubicacion';
  if (p.segundoPlano) return 'iniciar';
  if (p.puedePreguntar && !p.yaExplicado) return 'explicar';
  return 'solo_abierta';
};

/** Igual que DESPACHO_UBICACION_MAX_SEG del backend: sin ubicación más reciente no hay ofertas. */
export const UMBRAL_FUERA_SEG = 60;

/**
 * "Estuviste fuera del despacho" (criterio 20, P20): sigue disponible, pero el último envío
 * correcto es más viejo que la ventana del despacho. Pasa cuando el sistema detuvo la app en
 * segundo plano (ahorro de batería). Sin envíos previos no hay nada que avisar.
 */
export const fueraDelDespacho = (
  estado: EstadoTricimoto | null,
  ultimoEnvio: number | null,
  ahora: number
): boolean => estado === 'disponible' && ultimoEnvio !== null && ahora - ultimoEnvio > UMBRAL_FUERA_SEG * 1000;

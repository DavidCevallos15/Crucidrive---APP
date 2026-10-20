import { COLORS } from '../constants/theme';
import { COLORES_OFERTA } from './oferta';

/**
 * Interfaz compacta (spec 010, parte A). En pantallas bajas (un teléfono modesto mide
 * 360 × 640) se quita lo decorativo y se aprietan los espacios para que lo importante
 * quepa sin desplazar. Cubre también los Android comunes de 360 × 800 y 393 × 852, donde
 * el login no cabía. Los botones principales del conductor no se achican (regla 6).
 */
export const ALTO_COMPACTO = 880;

/** Fracción mínima del alto que el mapa del pasajero deja visible (criterio 2). */
export const MAPA_VISIBLE_MIN = 0.35;

/** Hojas del mapa: no bajan de este alto aunque la pantalla sea muy baja. */
export const HOJA_ALTO_MIN = 220;

/** Borde y relleno de la tarjeta alrededor de la hoja, que también tapan mapa. */
export const BORDE_HOJA = 6;

export const esCompacta = (alto: number): boolean => alto < ALTO_COMPACTO;

/**
 * Alto máximo de una hoja del mapa: lo que queda entre la barra de abajo (o el borde) y la
 * zona superior, dejando a la vista al menos `MAPA_VISIBLE_MIN` del alto para el mapa.
 */
export const altoMaximoHoja = (alto: number, separacionInferior: number): number =>
  Math.max(HOJA_ALTO_MIN, Math.floor(alto * (1 - MAPA_VISIBLE_MIN) - separacionInferior - BORDE_HOJA));

/**
 * Si una hoja desplazable esconde contenido abajo (criterio 2): lo que mide el contenido
 * supera lo visible más lo ya desplazado. Un margen de 8 px evita parpadeos al llegar al fondo.
 */
export const hayMasAbajo = (visible: number, contenido: number, desplazamiento: number): boolean =>
  visible > 0 && contenido - visible - desplazamiento > 8;

/**
 * Colores de «Desliza para ver más» (010, criterio 3). `claro` para las hojas del mapa y
 * `oscuro` para las tarjetas opacas del conductor (regla 6): el degradado termina en el color
 * del fondo, para no pintar una franja blanca sobre una tarjeta oscura (011).
 */
export const COLORES_DESLIZA = {
  claro: { fondo: COLORS.glassSurface, pastilla: COLORS.darkBg, texto: COLORS.primary },
  oscuro: { fondo: COLORES_OFERTA.fondo, pastilla: COLORES_OFERTA.fondo, texto: COLORES_OFERTA.texto },
} as const;

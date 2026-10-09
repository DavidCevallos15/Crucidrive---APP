/**
 * Frecuencia de envío de la ubicación del conductor (paso 004, D-13; plan P12). Se lee del
 * entorno para ajustarla en el piloto sin publicar la app; la app la recibe en la respuesta de
 * PATCH /api/conductores/disponibilidad. Un valor inválido detiene el arranque, como en el 003.
 */

// nombre → [mínimo, máximo, por defecto]
const LIMITES = {
  UBICACION_ABIERTA_SEG: [2, 60, 5],
  UBICACION_FONDO_MOV_SEG: [5, 120, 10],
  UBICACION_FONDO_QUIETO_SEG: [10, 300, 30],
};

const leerEntero = (env, nombre) => {
  const [min, max, defecto] = LIMITES[nombre];
  const crudo = env[nombre];
  if (crudo === undefined || String(crudo).trim() === '') return defecto;
  const valor = Number(crudo);
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max} (recibido: "${crudo}").`);
  }
  return valor;
};

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ abiertaSeg: number, fondoMovSeg: number, fondoQuietoSeg: number }}
 */
const leerConfigUbicacion = (env = process.env) => {
  const config = {
    abiertaSeg: leerEntero(env, 'UBICACION_ABIERTA_SEG'),
    fondoMovSeg: leerEntero(env, 'UBICACION_FONDO_MOV_SEG'),
    fondoQuietoSeg: leerEntero(env, 'UBICACION_FONDO_QUIETO_SEG'),
  };
  if (config.fondoQuietoSeg < config.fondoMovSeg) {
    throw new Error('UBICACION_FONDO_QUIETO_SEG no puede ser menor que UBICACION_FONDO_MOV_SEG.');
  }
  return config;
};

/**
 * Un conductor detenido envía cada fondoQuietoSeg; si eso supera la ventana de frescura del
 * despacho, dejaría de ser candidato aunque esté disponible (criterio 2 del 003, criterio 19).
 */
const validarConDespacho = (ubicacion, despacho) => {
  if (ubicacion.fondoQuietoSeg >= despacho.ubicacionMaxSeg) {
    throw new Error(
      `UBICACION_FONDO_QUIETO_SEG (${ubicacion.fondoQuietoSeg}) debe ser menor que DESPACHO_UBICACION_MAX_SEG (${despacho.ubicacionMaxSeg}).`
    );
  }
};

module.exports = { leerConfigUbicacion, validarConDespacho };

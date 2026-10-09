/**
 * Parámetros del despacho (paso 003, D-11; plan R21). Se leen del entorno para ajustarlos
 * en el piloto sin publicar la app. Un valor inválido detiene el arranque del servidor:
 * es mejor no arrancar que despachar con tiempos absurdos.
 */

// nombre de la variable → [mínimo, máximo, por defecto]
const LIMITES = {
  DESPACHO_SECUENCIALES: [1, 10, 3],
  DESPACHO_OFERTA_SEG: [5, 60, 15],
  DESPACHO_MAX_SEG: [30, 600, 120],
  DESPACHO_UBICACION_MAX_SEG: [10, 600, 60],
  DESPACHO_BARRIDO_SEG: [5, 120, 15],
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
 * @returns {{ secuenciales: number, ofertaSeg: number, maxSeg: number, ubicacionMaxSeg: number, barridoSeg: number }}
 */
const leerConfigDespacho = (env = process.env) => {
  const config = {
    secuenciales: leerEntero(env, 'DESPACHO_SECUENCIALES'),
    ofertaSeg: leerEntero(env, 'DESPACHO_OFERTA_SEG'),
    maxSeg: leerEntero(env, 'DESPACHO_MAX_SEG'),
    ubicacionMaxSeg: leerEntero(env, 'DESPACHO_UBICACION_MAX_SEG'),
    barridoSeg: leerEntero(env, 'DESPACHO_BARRIDO_SEG'),
  };
  // La fase secuencial tiene que dejar tiempo para el aviso abierto (D-11).
  if (config.secuenciales * config.ofertaSeg >= config.maxSeg) {
    throw new Error(
      `DESPACHO_SECUENCIALES × DESPACHO_OFERTA_SEG (${config.secuenciales * config.ofertaSeg} s) ` +
      `debe ser menor que DESPACHO_MAX_SEG (${config.maxSeg} s).`
    );
  }
  return config;
};

module.exports = { leerConfigDespacho, LIMITES };

// @ts-check
/**
 * Parámetros de los sockets (007, criterio 1; plan P1). Se leen del entorno y un valor inválido
 * detiene el arranque, como en ubicacion/config.js.
 */

/** @type {Record<string, [number, number, number]>} nombre: [mínimo, máximo, por defecto] */
const LIMITES = {
  SOCKET_CAMBIOS_SECTOR_MIN: [1, 60, 6],
};

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} nombre
 */
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
 * @returns {{ cambiosSectorPorMin: number }}
 */
const leerConfigSockets = (env = process.env) => ({
  cambiosSectorPorMin: leerEntero(env, 'SOCKET_CAMBIOS_SECTOR_MIN'),
});

module.exports = { leerConfigSockets, LIMITES };

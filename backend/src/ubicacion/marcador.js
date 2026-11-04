// @ts-check
/**
 * Marcador efímero del conductor en el mapa del sector (007, criterio 3; plan P2; D-18).
 *
 * El mapa en vivo no lleva el UUID ni el nombre del conductor: lleva un marcador que cambia
 * cada día (fecha de Ecuador) y que no permite saber quién es ni relacionar un día con otro.
 * No se guarda nada: marcador = HMAC(HMAC(secreto, fecha), conductorId), primeros 16 hex.
 */
const crypto = require('crypto');

const MIN_SECRETO = 32;
const ZONA_HORARIA = 'America/Guayaquil';

/**
 * Lee el secreto del entorno. Sin él (o si es corto) el servidor no arranca.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
const leerSecretoMarcador = (env = process.env) => {
  const secreto = typeof env.MARCADOR_SECRETO === 'string' ? env.MARCADOR_SECRETO.trim() : '';
  if (secreto.length < MIN_SECRETO) {
    throw new Error(`MARCADOR_SECRETO debe tener al menos ${MIN_SECRETO} caracteres.`);
  }
  return secreto;
};

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * Fecha local de Ecuador en formato AAAA-MM-DD.
 * @param {Date} ahora
 */
const fechaLocal = (ahora) => formatoFecha.format(ahora);

/**
 * @param {string} conductorId
 * @param {{ secreto?: string, ahora?: Date }} [opciones]
 * @returns {string} 16 caracteres hexadecimales
 */
const crearMarcador = (conductorId, { secreto = leerSecretoMarcador(), ahora = new Date() } = {}) => {
  const claveDelDia = crypto.createHmac('sha256', secreto).update(fechaLocal(ahora)).digest();
  return crypto.createHmac('sha256', claveDelDia).update(String(conductorId)).digest('hex').slice(0, 16);
};

/**
 * Redondea a 3 decimales (~110 m) para el mapa del sector (criterio 3).
 * @param {number} valor
 */
const redondear3 = (valor) => Math.round(valor * 1000) / 1000;

module.exports = { crearMarcador, leerSecretoMarcador, redondear3, fechaLocal, MIN_SECRETO };

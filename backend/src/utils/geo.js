/**
 * Utilidades geográficas para PostGIS.
 */

/**
 * Valida que lat/lng sean números finitos dentro de rangos geográficos.
 * @param {*} lat
 * @param {*} lng
 * @returns {boolean}
 */
const isValidCoordinate = (lat, lng) =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 &&
  lng >= -180 && lng <= 180;

/**
 * Convierte coordenadas a Well-Known Text de PostGIS: POINT(lng lat).
 * Valida antes de interpolar para que nunca llegue texto arbitrario a la BD.
 *
 * @param {number} lng - Longitud.
 * @param {number} lat - Latitud.
 * @returns {string}
 * @throws {Error} Si las coordenadas no son válidas.
 */
const toWKT = (lng, lat) => {
  if (!isValidCoordinate(lat, lng)) {
    throw new Error('Coordenadas geográficas inválidas.');
  }
  return `POINT(${lng} ${lat})`;
};

module.exports = { toWKT, isValidCoordinate };

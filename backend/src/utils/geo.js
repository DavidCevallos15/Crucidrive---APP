/**
 * Utilidades de conversión geográfica para PostGIS.
 */

/**
 * Valida que los valores sean coordenadas numéricas finitas dentro de rangos geográficos.
 * @param {*} lat - Latitud a validar.
 * @param {*} lng - Longitud a validar.
 * @returns {boolean}
 */
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

/**
 * Convierte coordenadas al formato Well-Known Text (WKT) de PostGIS: POINT(longitude latitude).
 * Valida numéricamente los valores antes de interpolar para prevenir inyección.
 *
 * @param {number} lng - Longitud.
 * @param {number} lat - Latitud.
 * @returns {string} Cadena WKT del punto geográfico.
 * @throws {Error} Si las coordenadas no son numéricas finitas dentro de rangos válidos.
 */
const toWKT = (lng, lat) => {
  const numLng = Number(lng);
  const numLat = Number(lat);
  if (!isValidCoordinate(numLat, numLng)) {
    throw new Error('Coordenadas geográficas inválidas.');
  }
  return `POINT(${numLng} ${numLat})`;
};

module.exports = { toWKT, isValidCoordinate };

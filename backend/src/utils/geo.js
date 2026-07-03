/**
 * Utilidades de conversión geográfica para PostGIS.
 */

/**
 * Convierte coordenadas { lat, lng } al formato Well-Known Text (WKT)
 * de PostGIS: POINT(longitude latitude).
 *
 * @param {number} lng - Longitud.
 * @param {number} lat - Latitud.
 * @returns {string} Cadena WKT del punto geográfico.
 */
const toWKT = (lng, lat) => `POINT(${lng} ${lat})`;

module.exports = { toWKT };

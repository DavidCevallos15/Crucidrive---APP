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

/**
 * Lee un punto en EWKB hexadecimal, que es como PostgREST devuelve una columna geography(point).
 * Admite el punto con SRID (0101000020E6100000…) y sin SRID. Devuelve null si no es un punto.
 * @param {string} hex
 * @returns {{ lat: number, lng: number } | null}
 */
const puntoDesdeEwkb = (hex) => {
  if (typeof hex !== 'string' || !/^[0-9a-f]+$/i.test(hex)) return null;
  const buf = Buffer.from(hex, 'hex');
  if (buf.length < 21) return null;
  const le = buf[0] === 1;
  const tipo = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const conSrid = (tipo & 0x20000000) !== 0;
  if ((tipo & 0xff) !== 1) return null;
  const inicio = conSrid ? 9 : 5;
  if (buf.length < inicio + 16) return null;
  const lng = le ? buf.readDoubleLE(inicio) : buf.readDoubleBE(inicio);
  const lat = le ? buf.readDoubleLE(inicio + 8) : buf.readDoubleBE(inicio + 8);
  return { lat, lng };
};

module.exports = { toWKT, isValidCoordinate, puntoDesdeEwkb };

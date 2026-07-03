/**
 * Helpers para estandarizar las respuestas JSON de la API REST.
 *
 * Evita duplicar manualmente la estructura { status, message, details }
 * en cada controlador y middleware.
 */

/**
 * Envía una respuesta de error estandarizada.
 * Los detalles internos se registran en el servidor pero nunca se exponen al cliente.
 * @param {import('express').Response} res
 * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 500, etc.)
 * @param {string} message - Mensaje descriptivo del error.
 * @param {string|null} [internalDetails] - Detalles internos (solo se registran en log, no se envían al cliente).
 */
const errorResponse = (res, statusCode, message, internalDetails = null) => {
  if (internalDetails) {
    console.error(`[API Error ${statusCode}] ${message}: ${internalDetails}`);
  }
  return res.status(statusCode).json({ status: 'error', message });
};

/**
 * Envía una respuesta exitosa estandarizada.
 * @param {import('express').Response} res
 * @param {Object} data - Datos del payload de respuesta.
 * @param {string} [message] - Mensaje descriptivo opcional.
 * @param {number} [statusCode=200] - Código HTTP (200, 201, etc.)
 */
const successResponse = (res, data, message = undefined, statusCode = 200) => {
  const body = { status: 'success' };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
};

module.exports = { errorResponse, successResponse };

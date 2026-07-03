/**
 * Helpers para estandarizar las respuestas JSON de la API REST.
 *
 * Evita duplicar manualmente la estructura { status, message, details }
 * en cada controlador y middleware.
 */

/**
 * Envía una respuesta de error estandarizada.
 * @param {import('express').Response} res
 * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 500, etc.)
 * @param {string} message - Mensaje descriptivo del error.
 * @param {string|null} [details] - Detalles adicionales (p.ej. mensaje de Supabase).
 */
const errorResponse = (res, statusCode, message, details = null) => {
  const body = { status: 'error', message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
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

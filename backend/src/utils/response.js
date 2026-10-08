/**
 * Helpers para estandarizar las respuestas JSON de la API REST.
 */

/**
 * Envía una respuesta de error estandarizada.
 * Los detalles internos (mensajes de Supabase, stack, etc.) se registran en el
 * servidor pero NUNCA se envían al cliente: revelan esquema y lógica interna.
 *
 * @param {import('express').Response} res
 * @param {number} statusCode - Código HTTP (400, 401, 403, 404, 500, etc.)
 * @param {string} message - Mensaje seguro para el cliente.
 * @param {string|null} [internalDetails] - Detalle interno, solo para el log.
 */
const errorResponse = (res, statusCode, message, internalDetails = null) => {
  if (internalDetails) {
    console.error(`[API ${statusCode}] ${message}: ${internalDetails}`);
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

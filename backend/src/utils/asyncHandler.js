const { errorResponse } = require('./response');

/**
 * Envuelve un controlador async de Express para capturar excepciones
 * automáticamente y devolver un error 500 estandarizado.
 *
 * Elimina la necesidad de repetir el bloque try/catch + res.status(500)
 * en cada función de controlador.
 *
 * @param {Function} fn - Controlador async (req, res, next) => Promise<void>
 * @returns {Function} Middleware de Express con manejo de errores.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(`[AsyncHandler] Error no capturado: ${err.message}`);
    errorResponse(res, 500, 'Error interno del servidor.', err.message);
  });
};

module.exports = asyncHandler;

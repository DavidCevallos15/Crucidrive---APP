const { supabase } = require('../config/supabase');
const { errorResponse } = require('../utils/response');

/**
 * Middleware para autenticar las peticiones entrantes usando el JWT de Supabase.
 * Valida el token contra la API de Supabase Auth.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'No autorizado. Se requiere un token de tipo Bearer en la cabecera.');
    }

    const token = authHeader.split(' ')[1];

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return errorResponse(res, 401, 'Token inválido o expirado.', error ? error.message : null);
    }

    req.user = user;
    next();
  } catch (err) {
    errorResponse(res, 500, 'Error interno en el middleware de autenticación.', err.message);
  }
};

module.exports = authMiddleware;

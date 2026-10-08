const { supabase, createUserClient } = require('../config/supabase');
const { errorResponse } = require('../utils/response');

/**
 * Autentica la petición con el JWT de Supabase y adjunta:
 * - req.user: usuario de Supabase Auth.
 * - req.supabase: cliente que actúa en nombre del usuario (RLS aplica).
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
    req.supabase = createUserClient(token);
    next();
  } catch (err) {
    errorResponse(res, 500, 'Error interno en el middleware de autenticación.', err.message);
  }
};

module.exports = authMiddleware;

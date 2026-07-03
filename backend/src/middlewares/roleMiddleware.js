const { supabase } = require('../config/supabase');
const { errorResponse } = require('../utils/response');

/**
 * Middleware para validar el rol del usuario contra los roles permitidos en la ruta.
 * Consulta la tabla public.perfiles de Supabase.
 *
 * @param {string[]} allowedRoles - Lista de roles autorizados para acceder a la ruta.
 * @returns {import('express').RequestHandler} Middleware de Express.
 */
const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return errorResponse(res, 401, 'Usuario no autenticado en el contexto de la petición.');
      }

      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', req.user.id)
        .single();

      if (error || !perfil) {
        return errorResponse(res, 404, 'No se encontró el perfil de usuario para validar el rol.', error ? error.message : null);
      }

      if (!allowedRoles.includes(perfil.rol)) {
        return errorResponse(res, 403, `Acceso denegado. Se requiere uno de los siguientes roles: [${allowedRoles.join(', ')}]. Tu rol actual es: ${perfil.rol}`);
      }

      req.user.rol = perfil.rol;
      next();
    } catch (err) {
      errorResponse(res, 500, 'Error interno en el middleware de roles.', err.message);
    }
  };
};

module.exports = roleMiddleware;

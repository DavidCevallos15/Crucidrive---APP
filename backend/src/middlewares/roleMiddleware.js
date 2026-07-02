const { supabase } = require('../config/supabase');

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
        return res.status(401).json({
          status: 'error',
          message: 'Usuario no autenticado en el contexto de la petición.'
        });
      }

      // Consultar el perfil del usuario en Supabase para obtener su rol
      const { data: perfil, error } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', req.user.id)
        .single();

      if (error || !perfil) {
        return res.status(404).json({
          status: 'error',
          message: 'No se encontró el perfil de usuario para validar el rol.',
          details: error ? error.message : null
        });
      }

      // Verificar si el rol del perfil está dentro de los permitidos
      if (!allowedRoles.includes(perfil.rol)) {
        return res.status(403).json({
          status: 'error',
          message: `Acceso denegado. Se requiere uno de los siguientes roles: [${allowedRoles.join(', ')}]. Tu rol actual es: ${perfil.rol}`
        });
      }

      // Adjuntar el rol al objeto req.user por conveniencia
      req.user.rol = perfil.rol;
      next();
    } catch (err) {
      res.status(500).json({
        status: 'error',
        message: 'Error interno en el middleware de roles.',
        details: err.message
      });
    }
  };
};

module.exports = roleMiddleware;

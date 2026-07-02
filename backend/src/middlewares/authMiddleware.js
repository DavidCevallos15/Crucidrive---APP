const { supabase } = require('../config/supabase');

/**
 * Middleware para autenticar las peticiones entrantes usando el JWT de Supabase.
 * Valida el token contra la API de Supabase Auth.
 * 
 * @param {import('express').Request} req - Objeto de petición Express.
 * @param {import('express').Response} res - Objeto de respuesta Express.
 * @param {import('express').NextFunction} next - Siguiente función middleware.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'No autorizado. Se requiere un token de tipo Bearer en la cabecera.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Validar el token usando el cliente oficial de Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        status: 'error',
        message: 'Token inválido o expirado.',
        details: error ? error.message : null
      });
    }

    // Adjuntar los datos de la sesión del usuario verificado a la petición
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error interno en el middleware de autenticación.',
      details: err.message
    });
  }
};

module.exports = authMiddleware;

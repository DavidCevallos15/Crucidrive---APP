const { supabase } = require('../config/supabase');

/**
 * Registra o completa el perfil de un usuario en public.perfiles.
 * Si el rol es 'conductor', también registra su unidad en public.tricimotos.
 * 
 * @param {import('express').Request} req - Objeto de petición Express.
 * @param {import('express').Response} res - Objeto de respuesta Express.
 */
const registerProfile = async (req, res) => {
  try {
    const { rol, nombre, telefono, placa } = req.body;
    const userId = req.user.id; // Extraído por authMiddleware

    // Validar campos obligatorios comunes
    if (!rol || !nombre || !telefono) {
      return res.status(400).json({
        status: 'error',
        message: 'Faltan campos requeridos: rol, nombre y telefono.'
      });
    }

    if (!['pasajero', 'conductor'].includes(rol)) {
      return res.status(400).json({
        status: 'error',
        message: 'El rol debe ser "pasajero" o "conductor".'
      });
    }

    // Validar placa si el rol es conductor
    if (rol === 'conductor' && !placa) {
      return res.status(400).json({
        status: 'error',
        message: 'La placa es obligatoria para el registro de conductores.'
      });
    }

    // 1. Insertar en la tabla public.perfiles
    const { data: perfilData, error: perfilError } = await supabase
      .from('perfiles')
      .insert([
        { id: userId, rol, nombre, telefono, activo: true }
      ])
      .select()
      .single();

    if (perfilError) {
      return res.status(400).json({
        status: 'error',
        message: 'Error al registrar el perfil del usuario.',
        details: perfilError.message
      });
    }

    let tricimotoData = null;

    // 2. Si es conductor, registrar su unidad de tricimoto
    if (rol === 'conductor') {
      const { data: motoData, error: motoError } = await supabase
        .from('tricimotos')
        .insert([
          { conductor_id: userId, placa, estado: 'inactivo' }
        ])
        .select()
        .single();

      if (motoError) {
        // Rollback manual eliminando el perfil si falla el registro de la tricimoto
        await supabase.from('perfiles').delete().eq('id', userId);

        return res.status(400).json({
          status: 'error',
          message: 'Error al registrar la tricimoto asociada. Registro cancelado.',
          details: motoError.message
        });
      }
      tricimotoData = motoData;
    }

    res.status(201).json({
      status: 'success',
      message: 'Perfil registrado correctamente.',
      data: {
        perfil: perfilData,
        tricimoto: tricimotoData
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error interno al registrar el perfil.',
      details: err.message
    });
  }
};

module.exports = {
  registerProfile
};

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

    // Sanitizar y validar nombre (solo letras, espacios y caracteres latinos)
    const nombreSanitizado = String(nombre).trim();
    if (nombreSanitizado.length < 2 || nombreSanitizado.length > 100 || !/^[\p{L}\s.'-]+$/u.test(nombreSanitizado)) {
      return res.status(400).json({
        status: 'error',
        message: 'El nombre debe tener entre 2 y 100 caracteres válidos.'
      });
    }

    // Validar formato de teléfono (E.164 o local ecuatoriano)
    const telefonoSanitizado = String(telefono).trim();
    if (!/^\+?[0-9]{7,15}$/.test(telefonoSanitizado)) {
      return res.status(400).json({
        status: 'error',
        message: 'El número de teléfono no tiene un formato válido.'
      });
    }

    // Validar placa si el rol es conductor
    if (rol === 'conductor' && !placa) {
      return res.status(400).json({
        status: 'error',
        message: 'La placa es obligatoria para el registro de conductores.'
      });
    }

    // Validar formato de placa ecuatoriana si se proporciona
    if (placa) {
      const placaSanitizada = String(placa).trim().toUpperCase();
      if (!/^[A-Z]{3}-?[0-9]{3,4}$/.test(placaSanitizada)) {
        return res.status(400).json({
          status: 'error',
          message: 'La placa debe tener formato ecuatoriano válido (ej: ABC-1234).'
        });
      }
    }

    // 1. Insertar en la tabla public.perfiles
    const { data: perfilData, error: perfilError } = await supabase
      .from('perfiles')
      .insert([
        { id: userId, rol, nombre: nombreSanitizado, telefono: telefonoSanitizado, activo: true }
      ])
      .select()
      .single();

    if (perfilError) {
      console.error('[Auth] Error al registrar perfil:', perfilError.message);
      return res.status(400).json({
        status: 'error',
        message: 'Error al registrar el perfil del usuario.'
      });
    }

    let tricimotoData = null;

    // 2. Si es conductor, registrar su unidad de tricimoto
    if (rol === 'conductor') {
      const placaSanitizada = String(placa).trim().toUpperCase();
      const { data: motoData, error: motoError } = await supabase
        .from('tricimotos')
        .insert([
          { conductor_id: userId, placa: placaSanitizada, estado: 'inactivo' }
        ])
        .select()
        .single();

      if (motoError) {
        // Rollback manual eliminando el perfil si falla el registro de la tricimoto
        await supabase.from('perfiles').delete().eq('id', userId);
        console.error('[Auth] Error al registrar tricimoto:', motoError.message);

        return res.status(400).json({
          status: 'error',
          message: 'Error al registrar la tricimoto asociada. Registro cancelado.'
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
    console.error('[Auth] Error interno al registrar perfil:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Error interno al registrar el perfil.'
    });
  }
};

module.exports = {
  registerProfile
};

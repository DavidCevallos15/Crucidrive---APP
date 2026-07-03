const { supabase } = require('../config/supabase');
const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');

/**
 * Registra o completa el perfil de un usuario en public.perfiles.
 * Si el rol es 'conductor', también registra su unidad en public.tricimotos.
 */
const registerProfile = asyncHandler(async (req, res) => {
  const { rol, nombre, telefono, placa } = req.body;
  const userId = req.user.id;

  if (!rol || !nombre || !telefono) {
    return errorResponse(res, 400, 'Faltan campos requeridos: rol, nombre y telefono.');
  }

  if (!['pasajero', 'conductor'].includes(rol)) {
    return errorResponse(res, 400, 'El rol debe ser "pasajero" o "conductor".');
  }

  // Sanitizar y validar nombre (solo letras, espacios y caracteres latinos)
  const nombreSanitizado = String(nombre).trim();
  if (nombreSanitizado.length < 2 || nombreSanitizado.length > 100 || !/^[\p{L}\s.'-]+$/u.test(nombreSanitizado)) {
    return errorResponse(res, 400, 'El nombre debe tener entre 2 y 100 caracteres válidos.');
  }

  // Validar formato de teléfono (E.164 o local ecuatoriano)
  const telefonoSanitizado = String(telefono).trim();
  if (!/^\+?[0-9]{7,15}$/.test(telefonoSanitizado)) {
    return errorResponse(res, 400, 'El número de teléfono no tiene un formato válido.');
  }

  if (rol === 'conductor' && !placa) {
    return errorResponse(res, 400, 'La placa es obligatoria para el registro de conductores.');
  }

  // Validar formato de placa ecuatoriana si se proporciona
  if (placa) {
    const placaTest = String(placa).trim().toUpperCase();
    if (!/^[A-Z]{3}-?[0-9]{3,4}$/.test(placaTest)) {
      return errorResponse(res, 400, 'La placa debe tener formato ecuatoriano válido (ej: ABC-1234).');
    }
  }

  const { data: perfilData, error: perfilError } = await supabase
    .from('perfiles')
    .insert([{ id: userId, rol, nombre: nombreSanitizado, telefono: telefonoSanitizado, activo: true }])
    .select()
    .single();

  if (perfilError) {
    return errorResponse(res, 400, 'Error al registrar el perfil del usuario.', perfilError.message);
  }

  let tricimotoData = null;

  if (rol === 'conductor') {
    const placaSanitizada = String(placa).trim().toUpperCase();
    const { data: motoData, error: motoError } = await supabase
      .from('tricimotos')
      .insert([{ conductor_id: userId, placa: placaSanitizada, estado: 'inactivo' }])
      .select()
      .single();

    if (motoError) {
      await supabase.from('perfiles').delete().eq('id', userId);
      return errorResponse(res, 400, 'Error al registrar la tricimoto asociada. Registro cancelado.', motoError.message);
    }
    tricimotoData = motoData;
  }

  successResponse(res, { perfil: perfilData, tricimoto: tricimotoData }, 'Perfil registrado correctamente.', 201);
});

module.exports = { registerProfile };

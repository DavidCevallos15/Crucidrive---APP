const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');

/**
 * Registra o completa el perfil de un usuario en public.perfiles.
 * Si el rol es 'conductor', también registra su unidad en public.tricimotos.
 */
const registerProfile = asyncHandler(async (req, res) => {
  const { rol, nombre, telefono } = req.body;
  const placa = typeof req.body.placa === 'string' ? req.body.placa.trim().toUpperCase() : req.body.placa;
  const userId = req.user.id;
  const db = req.supabase;

  if (!rol || !nombre || !telefono) {
    return errorResponse(res, 400, 'Faltan campos requeridos: rol, nombre y telefono.');
  }

  if (!['pasajero', 'conductor'].includes(rol)) {
    return errorResponse(res, 400, 'El rol debe ser "pasajero" o "conductor".');
  }

  if (rol === 'conductor' && !placa) {
    return errorResponse(res, 400, 'La placa es obligatoria para el registro de conductores.');
  }

  const { data: perfilData, error: perfilError } = await db
    .from('perfiles')
    .insert([{ id: userId, rol, nombre, telefono, activo: true }])
    .select()
    .single();

  if (perfilError) {
    return errorResponse(res, 400, 'Error al registrar el perfil del usuario.', perfilError.message);
  }

  let tricimotoData = null;

  if (rol === 'conductor') {
    const { data: motoData, error: motoError } = await db
      .from('tricimotos')
      .insert([{ conductor_id: userId, placa, estado: 'inactivo' }])
      .select()
      .single();

    if (motoError) {
      await db.from('perfiles').delete().eq('id', userId);
      return errorResponse(res, 400, 'Error al registrar la tricimoto asociada. Registro cancelado.', motoError.message);
    }
    tricimotoData = motoData;
  }

  successResponse(res, { perfil: perfilData, tricimoto: tricimotoData }, 'Perfil registrado correctamente.', 201);
});

module.exports = { registerProfile };

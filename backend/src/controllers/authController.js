const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const {
  isNombreValido, isTelefonoValido, isPlacaValida,
  normalizarNombre, normalizarTelefono, normalizarPlaca,
} = require('../utils/validation');

/**
 * Registra o completa el perfil de un usuario en public.perfiles.
 * Si el rol es 'conductor', también registra su unidad en public.tricimotos.
 */
const registerProfile = asyncHandler(async (req, res) => {
  const { rol } = req.body;
  const nombre = normalizarNombre(req.body.nombre);
  const telefono = normalizarTelefono(req.body.telefono);
  const placa = normalizarPlaca(req.body.placa);
  const userId = req.user.id;
  const db = req.supabase;

  if (!rol || !nombre || !telefono) {
    return errorResponse(res, 400, 'Faltan campos requeridos: rol, nombre y telefono.');
  }

  if (!['pasajero', 'conductor'].includes(rol)) {
    return errorResponse(res, 400, 'El rol debe ser "pasajero" o "conductor".');
  }

  if (!isNombreValido(nombre)) {
    return errorResponse(res, 400, 'El nombre debe tener entre 2 y 100 letras.');
  }

  if (!isTelefonoValido(telefono)) {
    return errorResponse(res, 400, 'El número de teléfono no tiene un formato válido.');
  }

  if (rol === 'conductor' && !placa) {
    return errorResponse(res, 400, 'La placa es obligatoria para el registro de conductores.');
  }

  if (rol === 'conductor' && !isPlacaValida(placa)) {
    return errorResponse(res, 400, 'La placa solo puede tener letras, números y guiones (3 a 10 caracteres).');
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
      const { error: rollbackError } = await db.from('perfiles').delete().eq('id', userId);
      if (rollbackError) {
        console.error(`[registerProfile] Falló el rollback del perfil ${userId}: ${rollbackError.message}`);
      }
      return errorResponse(res, 400, 'Error al registrar la tricimoto asociada. Registro cancelado.', motoError.message);
    }
    tricimotoData = motoData;
  }

  successResponse(res, { perfil: perfilData, tricimoto: tricimotoData }, 'Perfil registrado correctamente.', 201);
});

module.exports = { registerProfile };

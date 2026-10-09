const asyncHandler = require('../utils/asyncHandler');
const { errorResponse } = require('../utils/response');

/** Igual que el CHECK de dispositivos_push (0014). */
const TOKEN_EXPO = /^ExponentPushToken\[[A-Za-z0-9_-]{10,200}\]$/;

/**
 * La app registra el token de avisos de este teléfono al iniciar sesión (paso 004, plan P3).
 * Si el teléfono estaba con otra cuenta, la BD lo pasa a esta (criterio 11). Con el JWT del usuario.
 */
const registrarDispositivo = asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || !TOKEN_EXPO.test(token)) {
    return errorResponse(res, 400, 'El identificador de avisos no es válido.');
  }
  const { error } = await req.supabase.rpc('registrar_dispositivo', { p_token: token });
  if (error) {
    return errorResponse(res, 400, 'No se pudo registrar el teléfono para avisos.', error.message);
  }
  res.status(204).end();
});

/** Al cerrar sesión: este teléfono deja de recibir avisos de la cuenta (criterio 11). */
const olvidarDispositivo = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (typeof token !== 'string' || !TOKEN_EXPO.test(token)) {
    return errorResponse(res, 400, 'El identificador de avisos no es válido.');
  }
  const { error } = await req.supabase.rpc('olvidar_dispositivo', { p_token: token });
  if (error) {
    return errorResponse(res, 400, 'No se pudo quitar el teléfono de los avisos.', error.message);
  }
  res.status(204).end();
});

module.exports = { registrarDispositivo, olvidarDispositivo, TOKEN_EXPO };

const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { createAuthClient, getAdminClient } = require('../config/supabase');

const eliminarCuenta = asyncHandler(async (req, res) => {
  const { password, confirmacion } = req.body ?? {};
  if (confirmacion !== 'ELIMINAR' || typeof password !== 'string' || !password || password.length > 1024) {
    return errorResponse(res, 400, 'Confirma tu contraseña y escribe ELIMINAR.');
  }
  if (!req.user.email) return errorResponse(res, 400, 'Esta cuenta no tiene correo para confirmar su identidad.');
  const checker = createAuthClient();
  const { data, error: authError } = await checker.auth.signInWithPassword({ email: req.user.email, password });
  if (authError || data?.user?.id !== req.user.id) return errorResponse(res, 401, 'No se pudo confirmar tu contraseña.');
  // Revocar la sesión temporal creada solo para comprobar la contraseña.
  await checker.auth.signOut({ scope: 'local' });
  const { data: active, error: activeError } = await req.supabase.from('viajes').select('id')
    .or(`pasajero_id.eq.${req.user.id},conductor_id.eq.${req.user.id}`)
    .in('estado', ['solicitado', 'aceptado', 'en_curso']).limit(1);
  if (activeError) return errorResponse(res, 503, 'No se pudo comprobar si tienes un servicio activo. Inténtalo de nuevo.');
  if (active?.length) return errorResponse(res, 409, 'Termina o cancela tu servicio activo antes de eliminar la cuenta.');
  let admin;
  try { admin = getAdminClient(); } catch { return errorResponse(res, 503, 'La eliminación de cuentas no está configurada en este servidor.'); }
  const bucket = admin.storage.from('verificacion');
  const { data: files, error: filesError } = await bucket.list(req.user.id, { limit: 1000 });
  if (filesError || files?.length >= 1000) return errorResponse(res, 503, 'No se pudieron revisar tus archivos. Inténtalo de nuevo.');
  const paths = (files ?? []).map((file) => `${req.user.id}/${file.name}`);
  if (paths.length) {
    const { error } = await bucket.remove(paths);
    if (error) return errorResponse(res, 503, 'No se pudieron eliminar tus archivos. Inténtalo de nuevo.');
  }
  // Bloquea la cuenta y vuelve a comprobar servicios en la misma transacción que
  // elimina datos y acceso; no depende de un listado de viajes paginado del cliente.
  const { error } = await admin.rpc('eliminar_cuenta_crucidrive', { p_usuario: req.user.id });
  if (error) return errorResponse(res, String(error.message).includes('servicio_activo') ? 409 : 503,
    String(error.message).includes('servicio_activo') ? 'Termina o cancela tu servicio activo antes de eliminar la cuenta.' : 'No se pudo terminar la eliminación. Inténtalo de nuevo.', error.message);
  successResponse(res, null, 'Tu cuenta ha sido eliminada.');
});
module.exports = { eliminarCuenta };

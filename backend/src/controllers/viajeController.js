const { supabase } = require('../config/supabase');
const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { toWKT } = require('../utils/geo');
const { findViajeById } = require('../utils/supabaseHelpers');

/**
 * Crea una nueva solicitud de viaje para el pasajero autenticado.
 */
const solicitarViaje = asyncHandler(async (req, res) => {
  const { origen, destino } = req.body;
  const pasajeroId = req.user.id;

  if (!origen || !destino || !origen.lat || !origen.lng || !destino.lat || !origen.lng) {
    return errorResponse(res, 400, 'Las coordenadas de origen (lat, lng) y destino (lat, lng) son obligatorias.');
  }

  const tarifa = 1.50;

  const { data: viaje, error } = await supabase
    .from('viajes')
    .insert([
      {
        pasajero_id: pasajeroId,
        origen: toWKT(origen.lng, origen.lat),
        destino: toWKT(destino.lng, destino.lat),
        estado: 'solicitado',
        tarifa
      }
    ])
    .select()
    .single();

  if (error) {
    return errorResponse(res, 400, 'Error al registrar la solicitud del viaje.', error.message);
  }

  successResponse(res, viaje, 'Viaje solicitado correctamente.', 201);
});

/**
 * Permite a un conductor aceptar un viaje en estado 'solicitado'.
 * Crea transaccionalmente el canal de chat (thread) e ingresa a ambos miembros.
 */
const aceptarViaje = asyncHandler(async (req, res) => {
  const { viajeId } = req.body;
  const conductorId = req.user.id;

  if (!viajeId) {
    return errorResponse(res, 400, 'El identificador del viaje (viajeId) es requerido.');
  }

  const { viaje, error: getError } = await findViajeById(viajeId);

  if (getError || !viaje) {
    return errorResponse(res, 404, 'No se encontró el viaje solicitado.', getError ? getError.message : null);
  }

  if (viaje.estado !== 'solicitado') {
    return errorResponse(res, 400, `El viaje no puede ser aceptado porque está en estado: ${viaje.estado}`);
  }

  const { data: viajeActualizado, error: updateError } = await supabase
    .from('viajes')
    .update({
      conductor_id: conductorId,
      estado: 'aceptado',
      updated_at: new Date().toISOString()
    })
    .eq('id', viajeId)
    .select()
    .single();

  if (updateError) {
    return errorResponse(res, 400, 'Error al aceptar el viaje.', updateError.message);
  }

  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert([{ viaje_id: viajeId }])
    .select()
    .single();

  if (threadError) {
    await supabase.from('viajes').update({ conductor_id: null, estado: 'solicitado' }).eq('id', viajeId);
    return errorResponse(res, 500, 'Error al inicializar el hilo de comunicación del viaje.', threadError.message);
  }

  const miembros = [
    { thread_id: thread.id, user_id: viaje.pasajero_id },
    { thread_id: thread.id, user_id: conductorId }
  ];

  const { error: membersError } = await supabase
    .from('thread_members')
    .insert(miembros);

  if (membersError) {
    await supabase.from('threads').delete().eq('id', thread.id);
    await supabase.from('viajes').update({ conductor_id: null, estado: 'solicitado' }).eq('id', viajeId);
    return errorResponse(res, 500, 'Error al registrar los participantes en el chat del viaje.', membersError.message);
  }

  successResponse(res, {
    viaje: viajeActualizado,
    chat: { threadId: thread.id }
  }, 'Viaje aceptado correctamente e hilo de chat inicializado.');
});

/**
 * Cambia el estado del viaje (en_curso, finalizado, cancelado).
 * Valida que el solicitante sea participante del viaje.
 */
const cambiarEstadoViaje = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const userId = req.user.id;

  if (!estado || !['en_curso', 'finalizado', 'cancelado'].includes(estado)) {
    return errorResponse(res, 400, 'Estado inválido. Debe ser: "en_curso", "finalizado" o "cancelado".');
  }

  const { viaje, error: getError } = await findViajeById(id);

  if (getError || !viaje) {
    return errorResponse(res, 404, 'No se encontró el viaje solicitado.', getError ? getError.message : null);
  }

  if (viaje.pasajero_id !== userId && viaje.conductor_id !== userId) {
    return errorResponse(res, 403, 'Acceso denegado. No eres participante de este viaje.');
  }

  if (estado === 'en_curso' && viaje.estado !== 'aceptado') {
    return errorResponse(res, 400, 'El viaje debe estar "aceptado" antes de iniciar ("en_curso").');
  }

  if (estado === 'finalizado' && viaje.estado !== 'en_curso') {
    return errorResponse(res, 400, 'El viaje debe estar "en_curso" antes de finalizar.');
  }

  if (estado === 'cancelado' && ['finalizado', 'cancelado'].includes(viaje.estado)) {
    return errorResponse(res, 400, `No se puede cancelar un viaje que ya está ${viaje.estado}.`);
  }

  const { data: viajeActualizado, error: updateError } = await supabase
    .from('viajes')
    .update({
      estado,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return errorResponse(res, 400, 'Error al actualizar el estado del viaje.', updateError.message);
  }

  successResponse(res, viajeActualizado, `Estado del viaje actualizado a "${estado}" correctamente.`);
});

module.exports = {
  solicitarViaje,
  aceptarViaje,
  cambiarEstadoViaje
};

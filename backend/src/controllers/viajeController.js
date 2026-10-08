const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { toWKT, isValidCoordinate } = require('../utils/geo');
const {
  isUuid, isSectorId, isPasajerosValido, normalizarDescripcion, MAX_DESCRIPCION, MAX_PASAJEROS,
} = require('../utils/validation');
const { findViajeById } = require('../utils/supabaseHelpers');

/**
 * Crea una nueva solicitud de viaje para el pasajero autenticado.
 * El cobro es por persona (D-08): la tarifa NO se envía ni se calcula aquí;
 * la fija un trigger de la BD como precio_por_persona × pasajeros.
 * Cuerpo: { origen, destino, pasajeros?, sectorOrigenId?, sectorDestinoId?,
 *           origenDescripcion?, destinoDescripcion? }
 */
const solicitarViaje = asyncHandler(async (req, res) => {
  const { origen, destino, sectorOrigenId, sectorDestinoId } = req.body;
  const pasajeros = req.body.pasajeros === undefined ? 1 : req.body.pasajeros;
  const origenDescripcion = normalizarDescripcion(req.body.origenDescripcion);
  const destinoDescripcion = normalizarDescripcion(req.body.destinoDescripcion);
  const pasajeroId = req.user.id;
  const db = req.supabase;

  if (!origen || !destino || origen.lat == null || origen.lng == null || destino.lat == null || destino.lng == null) {
    return errorResponse(res, 400, 'Las coordenadas de origen (lat, lng) y destino (lat, lng) son obligatorias.');
  }

  if (!isValidCoordinate(origen.lat, origen.lng) || !isValidCoordinate(destino.lat, destino.lng)) {
    return errorResponse(res, 400, 'Las coordenadas proporcionadas no son válidas.');
  }

  if (!isPasajerosValido(pasajeros)) {
    return errorResponse(res, 400, `El número de pasajeros debe ser un entero entre 1 y ${MAX_PASAJEROS}.`);
  }

  for (const sector of [sectorOrigenId, sectorDestinoId]) {
    if (sector != null && !isSectorId(sector)) {
      return errorResponse(res, 400, 'El identificador de sector no es válido.');
    }
  }

  if (origenDescripcion.length > MAX_DESCRIPCION || destinoDescripcion.length > MAX_DESCRIPCION) {
    return errorResponse(res, 400, `La descripción no puede superar ${MAX_DESCRIPCION} caracteres.`);
  }

  const { data: viaje, error } = await db
    .from('viajes')
    .insert([
      {
        pasajero_id: pasajeroId,
        origen: toWKT(origen.lng, origen.lat),
        destino: toWKT(destino.lng, destino.lat),
        sector_origen_id: sectorOrigenId ?? null,
        sector_destino_id: sectorDestinoId ?? null,
        pasajeros,
        origen_descripcion: origenDescripcion || null,
        destino_descripcion: destinoDescripcion || null,
        estado: 'solicitado'
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
 * Devuelve un viaje a "solicitado" si falla un paso posterior a la aceptación.
 * Registra el fallo del rollback: un viaje atascado en "aceptado" sin chat
 * debe poder diagnosticarse. La aceptación atómica llega en el paso 003.
 */
const revertirAceptacion = async (db, viajeId) => {
  const { error } = await db
    .from('viajes')
    .update({ conductor_id: null, estado: 'solicitado', aceptado_en: null })
    .eq('id', viajeId);
  if (error) {
    console.error(`[aceptarViaje] Falló el rollback del viaje ${viajeId}: ${error.message}`);
  }
};

/**
 * Permite a un conductor aceptar un viaje en estado 'solicitado'.
 * Crea transaccionalmente el canal de chat (thread) e ingresa a ambos miembros.
 */
const aceptarViaje = asyncHandler(async (req, res) => {
  const { viajeId } = req.body;
  const conductorId = req.user.id;
  const db = req.supabase;

  if (!viajeId) {
    return errorResponse(res, 400, 'El identificador del viaje (viajeId) es requerido.');
  }

  if (!isUuid(viajeId)) {
    return errorResponse(res, 400, 'El identificador del viaje no es válido.');
  }

  const { viaje, error: getError } = await findViajeById(db, viajeId);

  if (getError || !viaje) {
    return errorResponse(res, 404, 'No se encontró el viaje solicitado.', getError ? getError.message : null);
  }

  if (viaje.estado !== 'solicitado') {
    return errorResponse(res, 400, `El viaje no puede ser aceptado porque está en estado: ${viaje.estado}`);
  }

  const { data: viajeActualizado, error: updateError } = await db
    .from('viajes')
    .update({
      conductor_id: conductorId,
      estado: 'aceptado',
      aceptado_en: new Date().toISOString()
    })
    .eq('id', viajeId)
    .select()
    .single();

  if (updateError) {
    return errorResponse(res, 400, 'Error al aceptar el viaje.', updateError.message);
  }

  const { data: thread, error: threadError } = await db
    .from('threads')
    .insert([{ viaje_id: viajeId, created_by: conductorId }])
    .select()
    .single();

  if (threadError) {
    await revertirAceptacion(db, viajeId);
    return errorResponse(res, 500, 'Error al inicializar el hilo de comunicación del viaje.', threadError.message);
  }

  const miembros = [
    { thread_id: thread.id, user_id: viaje.pasajero_id },
    { thread_id: thread.id, user_id: conductorId }
  ];

  const { error: membersError } = await db
    .from('thread_members')
    .insert(miembros);

  if (membersError) {
    const { error: deleteThreadError } = await db.from('threads').delete().eq('id', thread.id);
    if (deleteThreadError) {
      console.error(`[aceptarViaje] Falló el borrado del hilo ${thread.id} en rollback: ${deleteThreadError.message}`);
    }
    await revertirAceptacion(db, viajeId);
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
  const db = req.supabase;

  if (!isUuid(id)) {
    return errorResponse(res, 400, 'El identificador del viaje no es válido.');
  }

  if (!estado || !['en_curso', 'finalizado', 'cancelado'].includes(estado)) {
    return errorResponse(res, 400, 'Estado inválido. Debe ser: "en_curso", "finalizado" o "cancelado".');
  }

  const { viaje, error: getError } = await findViajeById(db, id);

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

  const { data: viajeActualizado, error: updateError } = await db
    .from('viajes')
    .update({
      estado,
      ...(estado === 'finalizado' || estado === 'cancelado' ? { finalizado_en: new Date().toISOString() } : {})
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

const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { toWKT, isValidCoordinate } = require('../utils/geo');
const {
  isUuid, isSectorId, isPasajerosValido, normalizarDescripcion, MAX_DESCRIPCION, MAX_PASAJEROS,
} = require('../utils/validation');
const { findViajeById } = require('../utils/supabaseHelpers');
const { obtenerDespachador } = require('../despacho');

const tieneCoordenadas = (p) => p != null && p.lat != null && p.lng != null;

/**
 * Crea una nueva solicitud de viaje para el pasajero autenticado y arranca el despacho (paso 003).
 * El cobro es por persona (D-08): la tarifa NO se envía ni se calcula aquí;
 * la fija un trigger de la BD como precio_por_persona × pasajeros.
 * Con un lugar del catálogo, la BD toma sus coordenadas, su nombre y su sector (criterio 19);
 * sin sector, la BD usa el del centro más cercano.
 * Cuerpo: { origen?, destino?, lugarOrigenId?, lugarDestinoId?, pasajeros?, sectorOrigenId?,
 *           sectorDestinoId?, origenDescripcion?, destinoDescripcion? }
 */
const solicitarViaje = asyncHandler(async (req, res) => {
  const { origen, destino, sectorOrigenId, sectorDestinoId, lugarOrigenId, lugarDestinoId } = req.body;
  const pasajeros = req.body.pasajeros === undefined ? 1 : req.body.pasajeros;
  const origenDescripcion = normalizarDescripcion(req.body.origenDescripcion);
  const destinoDescripcion = normalizarDescripcion(req.body.destinoDescripcion);
  const pasajeroId = req.user.id;
  const db = req.supabase;

  for (const lugar of [lugarOrigenId, lugarDestinoId]) {
    if (lugar != null && !isUuid(lugar)) {
      return errorResponse(res, 400, 'El identificador del lugar no es válido.');
    }
  }

  if ((!lugarOrigenId && !tieneCoordenadas(origen)) || (!lugarDestinoId && !tieneCoordenadas(destino))) {
    return errorResponse(res, 400, 'Las coordenadas de origen (lat, lng) y destino (lat, lng) son obligatorias si no eliges un lugar.');
  }

  for (const punto of [origen, destino]) {
    if (tieneCoordenadas(punto) && !isValidCoordinate(punto.lat, punto.lng)) {
      return errorResponse(res, 400, 'Las coordenadas proporcionadas no son válidas.');
    }
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
        // Con lugar, la BD reemplaza el punto por el del lugar (el cliente no puede moverlo).
        origen: tieneCoordenadas(origen) ? toWKT(origen.lng, origen.lat) : null,
        destino: tieneCoordenadas(destino) ? toWKT(destino.lng, destino.lat) : null,
        lugar_origen_id: lugarOrigenId ?? null,
        lugar_destino_id: lugarDestinoId ?? null,
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
    // Índice único de 0012: un viaje activo por pasajero (criterio 13).
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Ya tienes un viaje activo. Termínalo o cancélalo antes de pedir otro.', error.message);
    }
    if (String(error.message).includes('lugar_no_disponible')) {
      return errorResponse(res, 400, 'El lugar elegido ya no está disponible. Elige otro o escribe una referencia.', error.message);
    }
    return errorResponse(res, 400, 'Error al registrar la solicitud del viaje.', error.message);
  }

  // El despacho corre aparte: la respuesta no espera la primera oferta (errores al log).
  obtenerDespachador()?.iniciar(viaje);

  successResponse(res, viaje, 'Viaje solicitado correctamente.', 201);
});

// Errores de aceptar_viaje (0012) → respuesta para el conductor.
const ERRORES_ACEPTAR = {
  viaje_no_disponible: [409, 'Este viaje ya fue tomado o ya no está disponible.'],
  oferta_no_vigente: [409, 'La oferta venció o no era para ti.'],
  conductor_no_aprobado: [403, 'Tu cuenta de conductor aún no está aprobada.'],
};

/** Lo que el pasajero ve del conductor que aceptó (criterio 10; criterio 9 del 002). */
const datosDelConductor = async (db, conductorId) => {
  const [{ data: perfil }, { data: tricimoto }] = await Promise.all([
    db.from('perfiles').select('nombre, telefono').eq('id', conductorId).single(),
    db.from('tricimotos').select('placa').eq('conductor_id', conductorId).single(),
  ]);
  return { id: conductorId, nombre: perfil?.nombre ?? null, telefono: perfil?.telefono ?? null, placa: tricimoto?.placa ?? null };
};

/**
 * El conductor acepta la oferta que recibió. Todo pasa en una sola operación de la BD
 * (aceptar_viaje, 0012): solo gana uno, se exige una oferta vigente, la tricimoto queda
 * ocupada y se crea el chat con los dos participantes (criterios 8, 9 y 10).
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

  const { data: filas, error: rpcError } = await db.rpc('aceptar_viaje', { p_viaje: viajeId });

  if (rpcError) {
    const clave = Object.keys(ERRORES_ACEPTAR).find((k) => String(rpcError.message).includes(k));
    const [status, mensaje] = clave ? ERRORES_ACEPTAR[clave] : [500, 'No se pudo aceptar el viaje.'];
    return errorResponse(res, status, mensaje, rpcError.message);
  }

  const threadId = filas?.[0]?.thread_id ?? null;
  const { viaje, error: getError } = await findViajeById(db, viajeId);
  if (getError || !viaje) {
    // La aceptación ya quedó hecha en la BD; solo falló la lectura de la respuesta.
    console.error(`[aceptarViaje] Viaje ${viajeId} aceptado pero no se pudo leer: ${getError?.message}`);
  }

  if (viaje) {
    const conductor = await datosDelConductor(db, conductorId);
    await obtenerDespachador()?.aceptado(viaje, { conductor, chat: { threadId } });
  }

  successResponse(res, {
    viaje: viaje ?? { id: viajeId, estado: 'aceptado', conductor_id: conductorId },
    chat: { threadId }
  }, 'Viaje aceptado correctamente e hilo de chat inicializado.');
});

const ESTADOS_FINALES = ['finalizado', 'cancelado', 'sin_conductor'];

/**
 * Cambia el estado del viaje (en_curso, finalizado, cancelado).
 * Valida que el solicitante sea participante del viaje. La BD valida además cada
 * transición (trigger de 0012), así que esta es la primera barrera, no la única.
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

  if (estado === 'cancelado' && ESTADOS_FINALES.includes(viaje.estado)) {
    return errorResponse(res, 400, `No se puede cancelar un viaje que ya está ${viaje.estado}.`);
  }

  // La BD vuelve a fijar finalizado_en con su propia hora al cerrar el viaje (trigger de 0012).
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

  // Cancelado mientras buscaba conductor: la BD ya cerró las ofertas; se retiran de las pantallas (criterio 12).
  if (estado === 'cancelado' && viaje.estado === 'solicitado') {
    await obtenerDespachador()?.cancelar(id);
  }

  successResponse(res, viajeActualizado, `Estado del viaje actualizado a "${estado}" correctamente.`);
});

module.exports = {
  solicitarViaje,
  aceptarViaje,
  cambiarEstadoViaje
};

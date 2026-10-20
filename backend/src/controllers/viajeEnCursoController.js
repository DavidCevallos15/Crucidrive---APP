const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { isUuid, isMotivoCancelacion, isEstrellas, errorComentario, MOTIVOS_CANCELACION } = require('../utils/validation');
const { findViajeById } = require('../utils/supabaseHelpers');
const { obtenerDespachador } = require('../despacho');
const { leerConfigSancion, revisarSancion } = require('../viaje/sancion');

/**
 * Viaje en curso (paso 005, plan P6 a P8). Cada paso lo valida la BD con su función (0017):
 * aquí se valida la entrada, se llama con el cliente del usuario (RLS y auth.uid()) y se avisa
 * a la otra parte. Nada de lo que decide el servidor viene del cliente (regla 2).
 */

// Se lee al cargar el módulo: un valor inválido impide arrancar (como los parámetros de D-11).
const CONFIG_SANCION = leerConfigSancion();

// Errores de las funciones de 0017 → respuesta. El detalle interno va al log, no al cliente.
const ERRORES = {
  no_es_tu_viaje: [403, 'Este viaje no es tuyo.'],
  estado_no_permite: [409, 'El viaje ya no está en ese paso. Actualiza la pantalla.'],
  motivo_requerido: [400, 'Elige el motivo de la cancelación.'],
  ya_calificado: [409, 'Ya calificaste este viaje.'],
  no_calificable: [409, 'Este viaje no se puede calificar.'],
};

const responderError = (res, error) => {
  const clave = Object.keys(ERRORES).find((k) => String(error.message).includes(k));
  if (clave) return errorResponse(res, ERRORES[clave][0], ERRORES[clave][1], error.message);
  // 23514: un CHECK (motivo, estrellas o comentario fuera de la regla).
  if (error.code === '23514') return errorResponse(res, 400, 'Los datos no son válidos.', error.message);
  return errorResponse(res, 500, 'No se pudo completar el paso del viaje.', error.message);
};

const despachador = () => obtenerDespachador();
const esEncomienda = (viaje) => viaje?.tipo_servicio === 'encomienda';

/**
 * Llama a la función del paso y devuelve el viaje actualizado. Si algo falla, ya respondió.
 * @returns {Promise<object|null>}
 */
const ejecutarPaso = async (req, res, funcion, args = {}) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    errorResponse(res, 400, 'El identificador del viaje no es válido.');
    return null;
  }
  const { error } = await req.supabase.rpc(funcion, { p_viaje: id, ...args });
  if (error) {
    responderError(res, error);
    return null;
  }
  const { viaje, error: getError } = await findViajeById(req.supabase, id);
  if (getError || !viaje) {
    // El paso ya quedó hecho en la BD; solo falló la lectura de la respuesta.
    console.error(`[viaje] ${funcion} hecho en ${id}, pero no se pudo leer: ${getError?.message}`);
    successResponse(res, { id }, 'Listo.');
    return null;
  }
  return viaje;
};

/** «Llegué» (criterio 3): aviso al pasajero. */
const marcarLlegada = asyncHandler(async (req, res) => {
  const viaje = await ejecutarPaso(req, res, 'marcar_llegada');
  if (!viaje) return;
  despachador()?.avisarViaje(viaje.pasajero_id, { viajeId: viaje.id, cambio: 'llegada', encomienda: esEncomienda(viaje) });
  successResponse(res, viaje, 'Le avisamos al pasajero que llegaste.');
});

/** «Empezar viaje» o «Paquete recogido» (criterio 4). */
const iniciarViaje = asyncHandler(async (req, res) => {
  const viaje = await ejecutarPaso(req, res, 'iniciar_viaje');
  if (!viaje) return;
  despachador()?.avisarViaje(viaje.pasajero_id, { viajeId: viaje.id, cambio: 'en_curso', encomienda: esEncomienda(viaje) });
  successResponse(res, viaje, 'Viaje en curso.');
});

/**
 * «Llegamos» o «Paquete entregado» del conductor (criterio 5), o el pasajero que finaliza él
 * mismo con sanción (criterio 5b): la respuesta le dice cuántas lleva y cuál es el tope (5c).
 */
const terminarViaje = asyncHandler(async (req, res) => {
  const viaje = await ejecutarPaso(req, res, 'terminar_viaje');
  if (!viaje) return;
  const encomienda = esEncomienda(viaje);
  if (viaje.finalizado_por === 'pasajero') {
    despachador()?.avisarViaje(viaje.conductor_id, { viajeId: viaje.id, cambio: 'finalizado_por_pasajero', encomienda });
    const { llevas } = await revisarSancion(req.supabase, req.user.id, CONFIG_SANCION);
    return successResponse(res, {
      ...viaje,
      sancion: { llevas, max: CONFIG_SANCION.max, ventanaDias: CONFIG_SANCION.ventanaDias, bloqueoHoras: CONFIG_SANCION.bloqueoHoras },
    }, 'Terminaste el viaje. Queda registrado.');
  }
  despachador()?.avisarViaje(viaje.pasajero_id, { viajeId: viaje.id, cambio: 'finalizado', encomienda });
  successResponse(res, viaje, 'Viaje terminado.');
});

/**
 * Cancelar (criterio 8). Mientras busca conductor el motivo es opcional (cancelación del 003)
 * y se retiran las ofertas; aceptado, lo exige la BD y se avisa a la otra parte.
 */
const cancelarViaje = asyncHandler(async (req, res) => {
  const motivo = req.body?.motivo ?? null;
  if (motivo !== null && !isMotivoCancelacion(motivo)) {
    return errorResponse(res, 400, `Motivo no válido. Usa uno de: ${MOTIVOS_CANCELACION.join(', ')}.`);
  }
  const viaje = await ejecutarPaso(req, res, 'cancelar_viaje', { p_motivo: motivo });
  if (!viaje) return;
  if (!viaje.conductor_id) {
    // Cancelado mientras buscaba: la BD ya cerró las ofertas; se retiran de las pantallas (003, 12).
    await despachador()?.cancelar(viaje.id);
  } else if (viaje.cancelado_por === 'pasajero') {
    despachador()?.avisarViaje(viaje.conductor_id, { viajeId: viaje.id, cambio: 'cancelado_por_pasajero', encomienda: esEncomienda(viaje) });
  } else {
    despachador()?.avisarViaje(viaje.pasajero_id, { viajeId: viaje.id, cambio: 'cancelado_por_conductor', encomienda: esEncomienda(viaje) });
  }
  successResponse(res, viaje, 'Viaje cancelado.');
});

/** «Llegué» o «No llegué» del pasajero (criterio 5a). */
const confirmarLlegada = asyncHandler(async (req, res) => {
  const { llego } = req.body ?? {};
  if (typeof llego !== 'boolean') return errorResponse(res, 400, 'Indica si llegaste (llego: true o false).');
  const viaje = await ejecutarPaso(req, res, 'confirmar_llegada', { p_llego: llego });
  if (!viaje) return;
  successResponse(res, viaje, llego ? 'Gracias por confirmar.' : 'Lo registramos para revisarlo.');
});

/** Calificar al conductor (criterios 15, 16 y 19). */
const calificarViaje = asyncHandler(async (req, res) => {
  const { estrellas, comentario = null } = req.body ?? {};
  if (!isEstrellas(estrellas)) return errorResponse(res, 400, 'Elige de 1 a 5 estrellas.');
  const problema = errorComentario(comentario);
  if (problema) return errorResponse(res, 400, problema);
  const texto = typeof comentario === 'string' && comentario.trim() !== '' ? comentario.trim() : null;
  const viaje = await ejecutarPaso(req, res, 'calificar_viaje', { p_estrellas: estrellas, p_comentario: texto });
  if (!viaje) return;
  successResponse(res, { id: viaje.id }, 'Gracias por calificar.');
});

/** Reseñas del propio conductor, sin autor (criterio 17). */
const misResenas = asyncHandler(async (req, res) => {
  const [resenas, resumen] = await Promise.all([
    req.supabase.rpc('mis_resenas'),
    req.supabase.rpc('resumen_conductor', { p_conductor: req.user.id }),
  ]);
  if (resenas.error || resumen.error) {
    return errorResponse(res, 500, 'No se pudieron leer tus reseñas.', (resenas.error || resumen.error).message);
  }
  const fila = resumen.data?.[0];
  successResponse(res, {
    promedio: fila?.promedio != null ? Number(fila.promedio) : null,
    total: fila?.total ?? 0,
    resenas: resenas.data ?? [],
  }, 'Reseñas.');
});

/** Resumen para mostrar junto al conductor (criterio 18). Si falla, el viaje sigue igual. */
const resumenDelConductor = async (db, conductorId) => {
  const { data, error } = await db.rpc('resumen_conductor', { p_conductor: conductorId });
  if (error) {
    console.error(`[viaje] Resumen del conductor ${conductorId}: ${error.message}`);
    return { promedio: null, total: 0 };
  }
  const fila = data?.[0];
  return { promedio: fila?.promedio != null ? Number(fila.promedio) : null, total: fila?.total ?? 0 };
};

module.exports = {
  CONFIG_SANCION,
  marcarLlegada,
  iniciarViaje,
  terminarViaje,
  cancelarViaje,
  confirmarLlegada,
  calificarViaje,
  misResenas,
  resumenDelConductor,
};

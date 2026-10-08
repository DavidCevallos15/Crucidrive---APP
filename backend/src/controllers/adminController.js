const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { isUuid, isMotivoValido, MOTIVO_MIN, MOTIVO_MAX } = require('../utils/validation');
const { BUCKET, TIPOS_FOTO, rutaFoto } = require('./conductorController');

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];
/** Las fotos de la cédula son sensibles: el enlace caduca a los 5 minutos. */
const SEGUNDOS_URL_FIRMADA = 300;

/**
 * Lista las solicitudes de conductores por estado (por defecto, pendientes), las más antiguas primero.
 * Solo administradores (la ruta usa roleMiddleware y la BD aplica RLS).
 */
const listarConductores = asyncHandler(async (req, res) => {
  const estado = req.query.estado === undefined ? 'pendiente' : req.query.estado;
  const db = req.supabase;

  if (!ESTADOS.includes(estado)) {
    return errorResponse(res, 400, `El estado debe ser uno de: ${ESTADOS.join(', ')}.`);
  }

  const { data: solicitudes, error } = await db
    .from('conductores_verificacion')
    .select('conductor_id, cedula, estado, motivo_rechazo, creado_en, revisado_en, perfiles!conductor_id(nombre, telefono)')
    .eq('estado', estado)
    .order('creado_en', { ascending: true });

  if (error) {
    return errorResponse(res, 500, 'No se pudo listar las solicitudes.', error.message);
  }

  const ids = (solicitudes || []).map((s) => s.conductor_id);
  let placas = {};
  if (ids.length > 0) {
    const { data: motos, error: motosError } = await db
      .from('tricimotos')
      .select('conductor_id, placa')
      .in('conductor_id', ids);
    if (motosError) {
      return errorResponse(res, 500, 'No se pudo consultar las placas.', motosError.message);
    }
    placas = Object.fromEntries((motos || []).map((m) => [m.conductor_id, m.placa]));
  }

  successResponse(res, (solicitudes || []).map((s) => ({ ...s, placa: placas[s.conductor_id] || null })));
});

/**
 * Detalle de una solicitud, con enlaces firmados (5 min) a las 3 fotos.
 */
const verConductor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = req.supabase;

  if (!isUuid(id)) {
    return errorResponse(res, 400, 'El identificador del conductor no es válido.');
  }

  const { data: solicitud, error } = await db
    .from('conductores_verificacion')
    .select('conductor_id, cedula, estado, motivo_rechazo, creado_en, revisado_en, perfiles!conductor_id(nombre, telefono)')
    .eq('conductor_id', id)
    .maybeSingle();

  if (error) {
    return errorResponse(res, 500, 'No se pudo consultar la solicitud.', error.message);
  }
  if (!solicitud) {
    return errorResponse(res, 404, 'No se encontró la solicitud del conductor.');
  }

  const rutas = TIPOS_FOTO.map((tipo) => rutaFoto(id, tipo));
  const { data: firmadas, error: firmaError } = await db.storage
    .from(BUCKET)
    .createSignedUrls(rutas, SEGUNDOS_URL_FIRMADA);

  if (firmaError) {
    return errorResponse(res, 500, 'No se pudo generar los enlaces de las fotos.', firmaError.message);
  }

  const fotos = {};
  TIPOS_FOTO.forEach((tipo, i) => {
    fotos[tipo] = (firmadas && firmadas[i] && firmadas[i].signedUrl) || null;
  });

  successResponse(res, { ...solicitud, fotos });
});

/**
 * Revisa una solicitud pendiente. Registra quién y cuándo (la fecha la pone un trigger de la BD).
 */
const revisar = async (req, res, cambios, mensaje) => {
  const { id } = req.params;
  const db = req.supabase;

  const { data, error } = await db
    .from('conductores_verificacion')
    .update({ ...cambios, revisado_por: req.user.id })
    .eq('conductor_id', id)
    .eq('estado', 'pendiente')
    .select('conductor_id, estado, motivo_rechazo, revisado_en')
    .maybeSingle();

  if (error) {
    return errorResponse(res, 400, 'No se pudo registrar la revisión.', error.message);
  }
  if (!data) {
    return errorResponse(res, 404, 'No hay una solicitud pendiente de ese conductor.');
  }

  return successResponse(res, data, mensaje);
};

const aprobarConductor = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) {
    return errorResponse(res, 400, 'El identificador del conductor no es válido.');
  }
  return revisar(req, res, { estado: 'aprobado' }, 'Conductor aprobado.');
});

const rechazarConductor = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) {
    return errorResponse(res, 400, 'El identificador del conductor no es válido.');
  }
  const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
  if (!isMotivoValido(motivo)) {
    return errorResponse(res, 400, `El motivo del rechazo debe tener entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`);
  }
  return revisar(req, res, { estado: 'rechazado', motivo_rechazo: motivo }, 'Solicitud rechazada.');
});

module.exports = { listarConductores, verConductor, aprobarConductor, rechazarConductor };

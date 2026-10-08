const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { isCedulaValida, normalizarCedula } = require('../utils/validation');

const BUCKET = 'verificacion';
const TIPOS_FOTO = ['conductor', 'cedula', 'vehiculo'];
const rutaFoto = (userId, tipo) => `${userId}/${tipo}.jpg`;

/**
 * El conductor envía (o corrige y reenvía) su solicitud de verificación.
 * Las 3 fotos las sube la app directamente a Storage (bucket privado, carpeta propia);
 * aquí solo se confirma que existen y se guarda la cédula. Una solicitud rechazada
 * vuelve a "pendiente" al corregirla (lo hace un trigger en la BD).
 */
const enviarVerificacion = asyncHandler(async (req, res) => {
  const cedula = normalizarCedula(req.body.cedula);
  const userId = req.user.id;
  const db = req.supabase;

  if (!isCedulaValida(cedula)) {
    return errorResponse(res, 400, 'La cédula no es válida. Revisa los 10 dígitos.');
  }

  const { data: archivos, error: listError } = await db.storage.from(BUCKET).list(userId);
  if (listError) {
    return errorResponse(res, 500, 'No se pudo comprobar las fotos subidas.', listError.message);
  }
  const subidas = new Set((archivos || []).map((a) => a.name));
  const faltan = TIPOS_FOTO.filter((tipo) => !subidas.has(`${tipo}.jpg`));
  if (faltan.length > 0) {
    return errorResponse(res, 400, `Faltan fotos por subir: ${faltan.join(', ')}.`);
  }

  const { data: existente, error: getError } = await db
    .from('conductores_verificacion')
    .select('estado')
    .eq('conductor_id', userId)
    .maybeSingle();
  if (getError) {
    return errorResponse(res, 500, 'No se pudo consultar tu verificación.', getError.message);
  }
  if (existente && existente.estado === 'aprobado') {
    return errorResponse(res, 409, 'Tu verificación ya fue aprobada.');
  }

  const datos = {
    cedula,
    foto_conductor: rutaFoto(userId, 'conductor'),
    foto_cedula: rutaFoto(userId, 'cedula'),
    foto_vehiculo: rutaFoto(userId, 'vehiculo'),
  };

  const consulta = existente
    ? db.from('conductores_verificacion').update(datos).eq('conductor_id', userId)
    : db.from('conductores_verificacion').insert([{ conductor_id: userId, ...datos }]);

  const { data, error } = await consulta.select('conductor_id, estado, creado_en').single();

  if (error) {
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Esa cédula ya está registrada en otra cuenta.', error.message);
    }
    return errorResponse(res, 400, 'No se pudo guardar tu solicitud de verificación.', error.message);
  }

  successResponse(res, data, existente ? 'Solicitud reenviada.' : 'Solicitud enviada.', existente ? 200 : 201);
});

/**
 * Estado de la verificación del propio conductor (pendiente, aprobado o rechazado con motivo).
 */
const obtenerMiVerificacion = asyncHandler(async (req, res) => {
  const { data, error } = await req.supabase
    .from('conductores_verificacion')
    .select('estado, motivo_rechazo, revisado_en, creado_en')
    .eq('conductor_id', req.user.id)
    .maybeSingle();

  if (error) {
    return errorResponse(res, 500, 'No se pudo consultar tu verificación.', error.message);
  }

  successResponse(res, data || { estado: 'sin_enviar' });
});

module.exports = { enviarVerificacion, obtenerMiVerificacion, BUCKET, TIPOS_FOTO, rutaFoto };

const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { isCedulaValida, normalizarCedula } = require('../utils/validation');
const { obtenerDespachador } = require('../despacho');
const { guardarUbicacion } = require('../ubicacion/servicio');
const { leerConfigUbicacion } = require('../ubicacion/config');
const { CONSENT_VERSION } = require('../config/consent');

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

/**
 * El conductor se pone disponible o deja de estarlo (paso 003, criterio 1; plan R10).
 * Cuerpo: { disponible: boolean }. Un conductor sin aprobar no puede (la RLS no actualiza
 * ninguna fila). Con un viaje en curso la tricimoto está "ocupado" y no se cambia a mano:
 * vuelve a "disponible" sola al terminar el viaje.
 * Si deja de estar disponible con una oferta abierta, la BD la da por rechazada y el
 * despachador pasa al siguiente candidato sin esperar el vencimiento.
 */
const cambiarDisponibilidad = asyncHandler(async (req, res) => {
  const { disponible } = req.body;
  const conductorId = req.user.id;
  const db = req.supabase;

  if (typeof disponible !== 'boolean') {
    return errorResponse(res, 400, 'Indica "disponible": true o false.');
  }

  const { data: actual, error: getError } = await db
    .from('tricimotos')
    .select('estado')
    .eq('conductor_id', conductorId)
    .maybeSingle();

  if (getError) {
    return errorResponse(res, 500, 'No se pudo leer el estado de tu tricimoto.', getError.message);
  }
  if (!actual) {
    return errorResponse(res, 404, 'No tienes una tricimoto registrada.');
  }
  if (actual.estado === 'ocupado') {
    return errorResponse(res, 409, 'Tienes un viaje en curso. Tu disponibilidad vuelve sola al terminarlo.');
  }

  // Estar disponible ahora implica ubicación en segundo plano y avisos: hace falta haber aceptado
  // el consentimiento vigente (paso 004, criterio 5; plan P18). Dejar de estarlo no lo exige.
  if (disponible) {
    const { data: aceptado, error: consentError } = await db
      .from('consentimientos')
      .select('id')
      .eq('user_id', conductorId)
      .eq('version', CONSENT_VERSION)
      .limit(1)
      .maybeSingle();
    if (consentError) {
      return errorResponse(res, 500, 'No se pudo comprobar tu consentimiento.', consentError.message);
    }
    if (!aceptado) {
      return errorResponse(res, 428, `Acepta el aviso de privacidad actualizado (versión ${CONSENT_VERSION}) para ponerte disponible.`);
    }
  }

  // Oferta abierta antes del cambio: si deja de estar disponible, hay que pasar al siguiente.
  const { data: abiertas } = disponible
    ? { data: [] }
    : await db.from('ofertas_viaje').select('viaje_id').eq('conductor_id', conductorId).eq('resultado', 'pendiente');

  const { data: filas, error } = await db
    .from('tricimotos')
    .update({ estado: disponible ? 'disponible' : 'inactivo' })
    .eq('conductor_id', conductorId)
    .select('estado, disponible_desde');

  if (error) {
    return errorResponse(res, 400, 'No se pudo cambiar tu disponibilidad.', error.message);
  }
  // La RLS no da error si el conductor no está aprobado: simplemente no actualiza nada.
  if (!filas || filas.length === 0) {
    return errorResponse(res, 403, 'Tu cuenta de conductor aún no está aprobada.');
  }

  for (const { viaje_id: viajeId } of abiertas || []) {
    obtenerDespachador()?.alResponder(viajeId);
  }

  // Frecuencia de envío de la ubicación que debe usar la app (paso 004, D-13; plan P12).
  successResponse(
    res,
    { ...filas[0], ubicacion: leerConfigUbicacion() },
    disponible ? 'Ahora estás disponible.' : 'Ya no estás disponible.'
  );
});

/**
 * Respaldo REST de update_location (paso 004, plan P11): la tarea de ubicación en segundo plano
 * lo usa cuando el socket se cayó. La vía normal sigue siendo el socket, que gasta muchos menos
 * bytes por envío (criterio 18). Responde 204 sin cuerpo para no gastar datos.
 */
const actualizarUbicacion = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const resultado = await guardarUbicacion({
    db: req.supabase,
    usuario: { id: req.user.id, rol: req.user.rol, nombre: req.user.nombre },
    sectorId: req.body?.sectorId,
    coords: req.body?.coords,
    emitir: (sala, evento, datos) => io?.to(sala).emit(evento, datos),
  });
  if (!resultado.ok) {
    return errorResponse(res, resultado.status, resultado.mensaje);
  }
  res.status(204).end();
});

module.exports = { enviarVerificacion, obtenerMiVerificacion, cambiarDisponibilidad, actualizarUbicacion, BUCKET, TIPOS_FOTO, rutaFoto };

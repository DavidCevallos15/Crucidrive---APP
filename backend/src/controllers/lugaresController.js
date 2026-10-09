const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { toWKT, isValidCoordinate, puntoDesdeEwkb } = require('../utils/geo');
const { normalizar } = require('../utils/texto');
const {
  isUuid, isCategoriaLugar, isNombreLugarValido, CATEGORIAS_LUGAR, NOMBRE_LUGAR_MAX,
} = require('../utils/validation');

/**
 * Catálogo de lugares para el administrador (paso 003, criterio 24; plan R20).
 * Todo va con req.supabase: la RLS de 0011 solo deja crear y corregir al admin, y nadie borra
 * (un lugar se oculta con visible = false). Cualquier cambio del admin queda marcado
 * (editado_por_admin) y una nueva importación de OSM no lo pisa.
 * La búsqueda del pasajero no pasa por aquí: la app llama a buscar_lugares directamente (R15).
 */

const COLUMNAS = 'id, nombre, categoria, ubicacion, sector_id, fuente, visible, editado_por_admin, actualizado_en';
const LIMITE = 200;

/** La ubicación llega como EWKB: se devuelve como { lat, lng } para el mapa del panel. */
const aRespuesta = ({ ubicacion, ...resto }) => ({ ...resto, ...puntoDesdeEwkb(ubicacion) });

/** Valida y arma los campos editables; con `parcial`, solo los que vienen en el cuerpo. */
const leerCampos = (body, { parcial }) => {
  const campos = {};
  if (body.nombre !== undefined || !parcial) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim().replace(/\s+/g, ' ') : '';
    if (!isNombreLugarValido(nombre)) return { error: `El nombre debe tener entre 2 y ${NOMBRE_LUGAR_MAX} caracteres.` };
    campos.nombre = nombre;
  }
  if (body.categoria !== undefined || !parcial) {
    const categoria = body.categoria === undefined ? 'otro' : body.categoria;
    if (!isCategoriaLugar(categoria)) return { error: `La categoría debe ser una de: ${CATEGORIAS_LUGAR.join(', ')}.` };
    campos.categoria = categoria;
  }
  if (body.lat !== undefined || body.lng !== undefined || !parcial) {
    if (!isValidCoordinate(body.lat, body.lng)) return { error: 'La ubicación (lat, lng) no es válida.' };
    campos.ubicacion = toWKT(Number(body.lng), Number(body.lat));
  }
  if (body.visible !== undefined) {
    if (typeof body.visible !== 'boolean') return { error: '"visible" debe ser true o false.' };
    campos.visible = body.visible;
  }
  return { campos };
};

/** GET /api/admin/lugares?q=&visible=true|false — hasta 200, por nombre. */
const listarLugares = asyncHandler(async (req, res) => {
  const { q, visible } = req.query;
  if (visible !== undefined && !['true', 'false'].includes(visible)) {
    return errorResponse(res, 400, '"visible" debe ser true o false.');
  }
  if (q !== undefined && (typeof q !== 'string' || q.length > 80)) {
    return errorResponse(res, 400, 'La búsqueda no puede superar 80 caracteres.');
  }

  let consulta = req.supabase.from('lugares').select(COLUMNAS).order('nombre').limit(LIMITE);
  const texto = normalizar(q).replace(/[%_\\]/g, '');
  if (texto) consulta = consulta.ilike('nombre_norm', `%${texto}%`);
  if (visible !== undefined) consulta = consulta.eq('visible', visible === 'true');

  const { data, error } = await consulta;
  if (error) {
    return errorResponse(res, 500, 'No se pudo listar los lugares.', error.message);
  }
  successResponse(res, (data || []).map(aRespuesta));
});

/** POST /api/admin/lugares { nombre, categoria?, lat, lng, visible? } */
const crearLugar = asyncHandler(async (req, res) => {
  const { campos, error: invalido } = leerCampos(req.body || {}, { parcial: false });
  if (invalido) return errorResponse(res, 400, invalido);

  const { data, error } = await req.supabase.from('lugares').insert([campos]).select(COLUMNAS).single();
  if (error) {
    return errorResponse(res, 400, 'No se pudo crear el lugar.', error.message);
  }
  successResponse(res, aRespuesta(data), 'Lugar creado.', 201);
});

/** PATCH /api/admin/lugares/:id { nombre?, categoria?, lat?, lng?, visible? } */
const actualizarLugar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return errorResponse(res, 400, 'El identificador del lugar no es válido.');
  }
  const { campos, error: invalido } = leerCampos(req.body || {}, { parcial: true });
  if (invalido) return errorResponse(res, 400, invalido);
  if (Object.keys(campos).length === 0) {
    return errorResponse(res, 400, 'No hay cambios: envía nombre, categoria, lat y lng, o visible.');
  }

  const { data, error } = await req.supabase.from('lugares').update(campos).eq('id', id).select(COLUMNAS);
  if (error) {
    return errorResponse(res, 400, 'No se pudo actualizar el lugar.', error.message);
  }
  if (!data || data.length === 0) {
    return errorResponse(res, 404, 'No se encontró el lugar.');
  }
  successResponse(res, aRespuesta(data[0]), 'Lugar actualizado.');
});

module.exports = { listarLugares, crearLugar, actualizarLugar };

/**
 * Ubicación del conductor (paso 004, plan P11 y P14). Un solo camino para el socket
 * (update_location, la vía normal: pocos bytes) y para POST /api/conductores/ubicacion (respaldo
 * cuando la app está en segundo plano y el socket se cayó). Siempre con el JWT del conductor:
 * la RLS solo deja actualizar la tricimoto propia y aprobada.
 */
const { toWKT, isValidCoordinate } = require('../utils/geo');
const { isSectorId } = require('../utils/validation');

/**
 * @param {object} p
 * @param {import('@supabase/supabase-js').SupabaseClient} p.db - Cliente con el JWT del conductor.
 * @param {{ id: string, rol: string, nombre?: string }} p.usuario
 * @param {string} p.sectorId
 * @param {{ lat: number, lng: number }} p.coords
 * @param {(sala: string, evento: string, datos: object) => void} p.emitir - Reenvío por socket.
 * @returns {Promise<{ ok: true, estado: string } | { ok: false, status: number, mensaje: string }>}
 */
const guardarUbicacion = async ({ db, usuario, sectorId, coords, emitir }) => {
  if (usuario.rol !== 'conductor') {
    return { ok: false, status: 403, mensaje: 'Acción denegada. Solo los conductores pueden actualizar geolocalización.' };
  }
  if (!coords || !isSectorId(sectorId)) {
    return { ok: false, status: 400, mensaje: 'Parámetros de ubicación incompletos.' };
  }
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (!isValidCoordinate(lat, lng)) {
    return { ok: false, status: 400, mensaje: 'Coordenadas inválidas.' };
  }

  // Solo la última posición: no se guarda historial (regla 4, criterio 16 del 004).
  const { data: actualizadas, error } = await db
    .from('tricimotos')
    .update({ ubicacion_actual: toWKT(lng, lat), sector_id: sectorId })
    .eq('conductor_id', usuario.id)
    .select('conductor_id, estado');

  if (error) {
    console.error(`[Ubicación] Error al guardar GPS en DB: ${error.message}`);
    return { ok: false, status: 500, mensaje: 'Error al guardar la ubicación.' };
  }
  // La RLS no da error si el conductor no está aprobado: simplemente no actualiza ninguna fila.
  if (!actualizadas || actualizadas.length === 0) {
    return { ok: false, status: 403, mensaje: 'Tu cuenta de conductor aún no está aprobada.' };
  }

  const { estado } = actualizadas[0];
  emitir(`sector:${sectorId}`, 'location_updated', {
    conductorId: usuario.id,
    nombre: usuario.nombre || '',
    coords: { lat, lng },
    estado,
  });
  return { ok: true, estado };
};

module.exports = { guardarUbicacion };

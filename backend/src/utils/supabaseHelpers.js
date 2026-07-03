const { supabase } = require('../config/supabase');

/**
 * Busca un viaje por su ID en la tabla `viajes`.
 *
 * @param {string} viajeId - ID del viaje a buscar.
 * @returns {Promise<{viaje: Object|null, error: Object|null}>}
 */
const findViajeById = async (viajeId) => {
  const { data: viaje, error } = await supabase
    .from('viajes')
    .select('*')
    .eq('id', viajeId)
    .single();

  return { viaje, error };
};

/**
 * Verifica que un usuario sea miembro de un hilo de chat.
 *
 * @param {string} threadId - ID del hilo de chat.
 * @param {string} userId - ID del usuario a verificar.
 * @returns {Promise<{member: Object|null, error: Object|null}>}
 */
const checkThreadMembership = async (threadId, userId) => {
  const { data: member, error } = await supabase
    .from('thread_members')
    .select('id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  return { member, error };
};

module.exports = { findViajeById, checkThreadMembership };

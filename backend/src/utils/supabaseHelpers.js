/**
 * Busca un viaje por su ID. RLS limita el resultado a lo que el usuario puede ver.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db - Cliente del usuario.
 * @param {string} viajeId - ID del viaje.
 * @returns {Promise<{viaje: Object|null, error: Object|null}>}
 */
const findViajeById = async (db, viajeId) => {
  const { data: viaje, error } = await db
    .from('viajes')
    .select('*')
    .eq('id', viajeId)
    .single();

  return { viaje, error };
};

/**
 * Verifica que un usuario sea miembro de un hilo de chat.
 * thread_members tiene clave primaria compuesta (thread_id, user_id).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} db - Cliente del usuario.
 * @param {string} threadId - ID del hilo.
 * @param {string} userId - ID del usuario.
 * @returns {Promise<{member: Object|null, error: Object|null}>}
 */
const checkThreadMembership = async (db, threadId, userId) => {
  const { data: member, error } = await db
    .from('thread_members')
    .select('thread_id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  return { member, error };
};

module.exports = { findViajeById, checkThreadMembership };

const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const { checkThreadMembership } = require('../utils/supabaseHelpers');
const { isUuid } = require('../utils/validation');

/**
 * Obtiene el historial de mensajes de un hilo de conversación de chat.
 * Valida que el usuario solicitante sea un participante del hilo de chat.
 */
const getHistorialChat = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const userId = req.user.id;
  const db = req.supabase;

  if (!threadId) {
    return errorResponse(res, 400, 'El identificador del hilo (threadId) es obligatorio.');
  }

  if (!isUuid(threadId)) {
    return errorResponse(res, 400, 'El identificador del hilo no es válido.');
  }

  const { member, error: memberError } = await checkThreadMembership(db, threadId, userId);

  if (memberError) {
    return errorResponse(res, 500, 'Error al verificar la afiliación al hilo de chat.', memberError.message);
  }

  if (!member) {
    return errorResponse(res, 403, 'Acceso denegado. No eres miembro autorizado de este hilo de conversación.');
  }

  const { data: messages, error: messagesError } = await db
    .from('messages')
    .select(`
      id,
      thread_id,
      sender_id,
      content,
      created_at,
      perfiles:sender_id (
        nombre,
        rol
      )
    `)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (messagesError) {
    return errorResponse(res, 400, 'Error al recuperar los mensajes del chat.', messagesError.message);
  }

  successResponse(res, messages);
});

module.exports = { getHistorialChat };

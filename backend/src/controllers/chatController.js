const { supabase } = require('../config/supabase');

/**
 * Obtiene el historial de mensajes de un hilo de conversación de chat.
 * Valida que el usuario solicitante sea un participante del hilo de chat.
 * 
 * @param {import('express').Request} req - Objeto de petición Express.
 * @param {import('express').Response} res - Objeto de respuesta Express.
 */
const getHistorialChat = async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.id;

    if (!threadId) {
      return res.status(400).json({
        status: 'error',
        message: 'El identificador del hilo (threadId) es obligatorio.'
      });
    }

    // 1. Validar que el usuario sea miembro de este hilo de chat (seguridad por diseño)
    const { data: member, error: memberError } = await supabase
      .from('thread_members')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberError) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al verificar la afiliación al hilo de chat.',
        details: memberError.message
      });
    }

    if (!member) {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. No eres miembro autorizado de este hilo de conversación.'
      });
    }

    // 2. Obtener el historial de mensajes ordenados cronológicamente
    const { data: messages, error: messagesError } = await supabase
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
      return res.status(400).json({
        status: 'error',
        message: 'Error al recuperar los mensajes del chat.',
        details: messagesError.message
      });
    }

    res.status(200).json({
      status: 'success',
      data: messages
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error interno al obtener el historial de chat.',
      details: err.message
    });
  }
};

module.exports = {
  getHistorialChat
};

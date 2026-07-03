const { supabase } = require('../config/supabase');
const { toWKT, isValidCoordinate } = require('../utils/geo');
const { checkThreadMembership } = require('../utils/supabaseHelpers');

/**
 * Registra y maneja los eventos de Socket.io para geolocalización y chat en tiempo real.
 * 
 * @param {import('socket.io').Server} io - Instancia del servidor de Socket.io.
 */
const initSocketHandler = (io) => {
  // Middleware de autenticación para WebSockets usando Supabase JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
                    socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Error de autenticación: Token no suministrado.'));
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return next(new Error('Error de autenticación: Token inválido o expirado.'));
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol, nombre')
        .eq('id', user.id)
        .single();

      socket.user = {
        id: user.id,
        email: user.email,
        rol: perfil?.rol || 'pasajero',
        nombre: perfil?.nombre || ''
      };

      next();
    } catch (err) {
      next(new Error('Error interno del middleware de WebSockets.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Nuevo cliente conectado: ${socket.user.nombre} (${socket.user.rol}) - ID: ${socket.id}`);

    // --- MÓDULO 1: GEOLOCALIZACIÓN Y GEOCERCAS ---

    socket.on('join_sector', ({ sectorId }) => {
      if (!sectorId || typeof sectorId !== 'string') return;
      const sanitizedSectorId = sectorId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!sanitizedSectorId) return;
      const room = `sector:${sanitizedSectorId}`;
      socket.join(room);
      console.log(`[Socket.io] Usuario ${socket.user.nombre} se unió a la sala del sector: ${room}`);
    });

    socket.on('update_location', async ({ sectorId, coords, estado }) => {
      try {
        if (socket.user.rol !== 'conductor') {
          return socket.emit('error_message', 'Acción denegada. Solo los conductores pueden actualizar geolocalización.');
        }

        if (!coords || coords.lat == null || coords.lng == null || !sectorId) {
          return socket.emit('error_message', 'Parámetros de ubicación incompletos.');
        }

        const lat = Number(coords.lat);
        const lng = Number(coords.lng);
        if (!isValidCoordinate(lat, lng)) {
          return socket.emit('error_message', 'Coordenadas geográficas inválidas.');
        }

        const validEstados = ['disponible', 'ocupado', 'inactivo'];
        const estadoSanitizado = validEstados.includes(estado) ? estado : 'disponible';

        const { error } = await supabase
          .from('tricimotos')
          .update({
            ubicacion_actual: toWKT(lng, lat),
            estado: estadoSanitizado,
            updated_at: new Date().toISOString()
          })
          .eq('conductor_id', socket.user.id);

        if (error) {
          console.error(`[Socket.io] Error al guardar GPS en DB: ${error.message}`);
          return;
        }

        const sanitizedSectorId = String(sectorId).replace(/[^a-zA-Z0-9_-]/g, '');
        const room = `sector:${sanitizedSectorId}`;
        socket.to(room).emit('location_updated', {
          conductorId: socket.user.id,
          nombre: socket.user.nombre,
          coords: { lat, lng },
          estado: estadoSanitizado
        });

      } catch (err) {
        console.error(`[Socket.io] Error en update_location: ${err.message}`);
      }
    });

    // --- MÓDULO 2: CHAT EN TIEMPO REAL ---

    socket.on('join_chat', async ({ threadId }) => {
      try {
        if (!threadId) return;

        const { member, error } = await checkThreadMembership(threadId, socket.user.id);

        if (error || !member) {
          console.warn(`[Socket.io] Acceso denegado a chat. Usuario ${socket.user.nombre} intentó ingresar a thread ${threadId}`);
          return socket.emit('error_message', 'No tienes permiso para ingresar a este chat.');
        }

        const room = `chat:${threadId}`;
        socket.join(room);
        console.log(`[Socket.io] Usuario ${socket.user.nombre} ingresó a la sala de chat: ${room}`);
      } catch (err) {
        console.error(`[Socket.io] Error en join_chat: ${err.message}`);
      }
    });

    socket.on('send_message', async ({ threadId, content }) => {
      try {
        if (!threadId || !content || String(content).trim() === '') {
          return socket.emit('error_message', 'Contenido del mensaje vacío o threadId faltante.');
        }

        // Validar que el usuario es miembro del hilo de chat
        const { member, error: memberError } = await checkThreadMembership(threadId, socket.user.id);

        if (memberError || !member) {
          return socket.emit('error_message', 'No tienes permiso para enviar mensajes en este chat.');
        }

        const sanitizedContent = String(content).trim().slice(0, 2000);

        const { data: message, error } = await supabase
          .from('messages')
          .insert([
            {
              thread_id: threadId,
              sender_id: socket.user.id,
              content: sanitizedContent
            }
          ])
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
          .single();

        if (error) {
          console.error(`[Socket.io] Error al guardar mensaje en DB: ${error.message}`);
          return socket.emit('error_message', 'No se pudo guardar el mensaje.');
        }

        const room = `chat:${threadId}`;
        io.to(room).emit('message_received', message);

      } catch (err) {
        console.error(`[Socket.io] Error en send_message: ${err.message}`);
      }
    });

    // --- MÓDULO 3: DESCONEXIÓN ---
    socket.on('disconnect', () => {
      console.log(`[Socket.io] Cliente desconectado: ${socket.user.nombre} - ID: ${socket.id}`);
    });
  });
};

module.exports = initSocketHandler;

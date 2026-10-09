const { supabase, createUserClient } = require('../config/supabase');
const { toWKT, isValidCoordinate } = require('../utils/geo');
const { checkThreadMembership } = require('../utils/supabaseHelpers');
const { isUuid, isSectorId, MAX_MENSAJE } = require('../utils/validation');
const { conexiones: conexionesProceso } = require('../despacho/conexiones');
const { salaUsuario } = require('../despacho/salas');

/**
 * Registra y maneja los eventos de Socket.io para geolocalización y chat en tiempo real.
 * Todo acceso a datos usa socket.supabase (JWT del usuario), así RLS aplica.
 *
 * @param {import('socket.io').Server} io - Instancia del servidor de Socket.io.
 * @param {{ conexiones?: import('../despacho/conexiones').RegistroConexiones }} [opciones]
 */
const initSocketHandler = (io, { conexiones = conexionesProceso } = {}) => {
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

      const db = createUserClient(token);

      const { data: perfil, error: perfilError } = await db
        .from('perfiles')
        .select('rol, nombre')
        .eq('id', user.id)
        .single();

      if (perfilError) {
        console.error(`[Socket.io] Error al obtener perfil para socket auth: ${perfilError.message}`);
        return next(new Error('Error de autenticación: No se pudo verificar el perfil del usuario.'));
      }

      // Sin perfil no hay rol: no se asume "pasajero" por defecto.
      if (!perfil) {
        return next(new Error('Error de autenticación: Perfil de usuario no encontrado.'));
      }

      socket.supabase = db;
      socket.user = {
        id: user.id,
        email: user.email,
        rol: perfil.rol,
        nombre: perfil.nombre || ''
      };

      next();
    } catch (err) {
      console.error(`[Socket.io] Error en middleware de autenticación: ${err.message}`);
      next(new Error('Error interno del middleware de WebSockets.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Cliente conectado: ${socket.user.nombre} (${socket.user.rol}) - ID: ${socket.id}`);

    socket.join(salaUsuario(socket.user.id));
    conexiones.agregar(socket.user.id, socket.id);
    // Hora del servidor para que la app corrija el desfase de su reloj en la cuenta regresiva (plan R14).
    socket.emit('hora_servidor', { ahora: Date.now() });

    // --- MÓDULO 1: GEOLOCALIZACIÓN Y GEOCERCAS ---

    socket.on('join_sector', ({ sectorId } = {}) => {
      if (!isSectorId(sectorId)) {
        return socket.emit('error_message', 'El identificador del sector (sectorId) no es válido.');
      }
      const room = `sector:${sectorId}`;
      socket.join(room);
      console.log(`[Socket.io] ${socket.user.nombre} se unió a ${room}`);
    });

    // Solo ubicación y sector. La disponibilidad se cambia con PATCH /api/conductores/disponibilidad
    // y "ocupado" lo pone la aceptación (plan R10): si llega "estado", se ignora.
    socket.on('update_location', async ({ sectorId, coords } = {}) => {
      try {
        if (socket.user.rol !== 'conductor') {
          return socket.emit('error_message', 'Acción denegada. Solo los conductores pueden actualizar geolocalización.');
        }

        if (!coords || !isSectorId(sectorId)) {
          return socket.emit('error_message', 'Parámetros de ubicación incompletos.');
        }

        const lat = Number(coords.lat);
        const lng = Number(coords.lng);
        if (!isValidCoordinate(lat, lng)) {
          return socket.emit('error_message', 'Coordenadas inválidas.');
        }

        const { data: actualizadas, error } = await socket.supabase
          .from('tricimotos')
          .update({
            ubicacion_actual: toWKT(lng, lat),
            sector_id: sectorId
          })
          .eq('conductor_id', socket.user.id)
          .select('conductor_id, estado');

        if (error) {
          console.error(`[Socket.io] Error al guardar GPS en DB: ${error.message}`);
          return socket.emit('error_message', 'Error al guardar la ubicación.');
        }

        // La RLS no da error si el conductor no está aprobado: simplemente no actualiza ninguna fila.
        if (!actualizadas || actualizadas.length === 0) {
          return socket.emit('error_message', 'Tu cuenta de conductor aún no está aprobada.');
        }

        socket.to(`sector:${sectorId}`).emit('location_updated', {
          conductorId: socket.user.id,
          nombre: socket.user.nombre,
          coords: { lat, lng },
          estado: actualizadas[0].estado
        });
      } catch (err) {
        console.error(`[Socket.io] Error en update_location: ${err.message}`);
        socket.emit('error_message', 'Error interno al actualizar la ubicación.');
      }
    });

    // --- MÓDULO 2: CHAT EN TIEMPO REAL ---

    socket.on('join_chat', async ({ threadId } = {}) => {
      try {
        if (!isUuid(threadId)) {
          return socket.emit('error_message', 'El identificador del chat no es válido.');
        }

        const { member, error } = await checkThreadMembership(socket.supabase, threadId, socket.user.id);

        if (error) {
          console.error(`[Socket.io] Error al verificar membresía de chat: ${error.message}`);
          return socket.emit('error_message', 'Error al verificar el acceso al chat.');
        }

        if (!member) {
          console.warn(`[Socket.io] Acceso denegado: ${socket.user.id} intentó entrar a ${threadId}`);
          return socket.emit('error_message', 'No tienes permiso para ingresar a este chat.');
        }

        socket.join(`chat:${threadId}`);
      } catch (err) {
        console.error(`[Socket.io] Error en join_chat: ${err.message}`);
        socket.emit('error_message', 'Error interno al unirse al chat.');
      }
    });

    socket.on('send_message', async ({ threadId, content } = {}) => {
      try {
        const texto = typeof content === 'string' ? content.trim() : '';

        if (!isUuid(threadId) || texto === '') {
          return socket.emit('error_message', 'Contenido del mensaje vacío o chat inválido.');
        }

        if (texto.length > MAX_MENSAJE) {
          return socket.emit('error_message', `El mensaje supera los ${MAX_MENSAJE} caracteres.`);
        }

        const { data: message, error } = await socket.supabase
          .from('messages')
          .insert([{ thread_id: threadId, sender_id: socket.user.id, content: texto }])
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

        io.to(`chat:${threadId}`).emit('message_received', message);
      } catch (err) {
        console.error(`[Socket.io] Error en send_message: ${err.message}`);
        socket.emit('error_message', 'Error interno al enviar el mensaje.');
      }
    });

    socket.on('disconnect', () => {
      conexiones.quitar(socket.user.id, socket.id);
      console.log(`[Socket.io] Cliente desconectado: ${socket.user.nombre} - ID: ${socket.id}`);
    });
  });
};

module.exports = initSocketHandler;

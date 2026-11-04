const { supabase, createUserClient } = require('../config/supabase');
const { guardarUbicacion } = require('../ubicacion/servicio');
const { checkThreadMembership } = require('../utils/supabaseHelpers');
const { isUuid, isSectorId, MAX_MENSAJE } = require('../utils/validation');
const { conexiones: conexionesProceso } = require('../despacho/conexiones');
const { salaUsuario } = require('../despacho/salas');
const { obtenerDespachador } = require('../despacho');
const { leerConfigSockets } = require('./config');
const { crearCatalogoSectores } = require('./sectores');

const VENTANA_CAMBIOS_MS = 60 * 1000;
const MENSAJE_SECTOR_INVALIDO = 'El identificador del sector (sectorId) no es válido.';

/**
 * Registra y maneja los eventos de Socket.io para geolocalización y chat en tiempo real.
 * Todo acceso a datos usa socket.supabase (JWT del usuario), así RLS aplica.
 *
 * @param {import('socket.io').Server} io - Instancia del servidor de Socket.io.
 * @param {{
 *   conexiones?: import('../despacho/conexiones').RegistroConexiones,
 *   config?: ReturnType<typeof leerConfigSockets>,
 *   sectores?: ReturnType<typeof crearCatalogoSectores>,
 * }} [opciones]
 */
const initSocketHandler = (io, {
  conexiones = conexionesProceso,
  config = leerConfigSockets(),
  sectores = crearCatalogoSectores(),
} = {}) => {
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
        .select('rol')
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
      // Sin nombre: ningún evento del socket lo necesita y no debe acabar en los logs (007, criterio 6).
      socket.user = {
        id: user.id,
        email: user.email,
        rol: perfil.rol,
      };

      next();
    } catch (err) {
      console.error(`[Socket.io] Error en middleware de autenticación: ${err.message}`);
      next(new Error('Error interno del middleware de WebSockets.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Conexión: usuario=${socket.user.id} rol=${socket.user.rol} socket=${socket.id}`);

    socket.join(salaUsuario(socket.user.id));
    conexiones.agregar(socket.user.id, socket.id);
    // Hora del servidor para que la app corrija el desfase de su reloj en la cuenta regresiva (plan R14).
    socket.emit('hora_servidor', { ahora: Date.now() });

    // --- MÓDULO 1: GEOLOCALIZACIÓN Y GEOCERCAS ---

    // Una sola sala de sector por conexión, solo sectores del catálogo y un tope de cambios por
    // minuto: así nadie escucha todos los sectores a la vez ni los recorre en bucle (007, C1 y C2).
    let sectorActual = null;
    let turnoSector = 0;
    const cambiosSector = [];

    socket.on('join_sector', async ({ sectorId } = {}) => {
      // El formato se revisa antes de cualquier espera: la respuesta es inmediata.
      if (!isSectorId(sectorId)) {
        return socket.emit('error_message', MENSAJE_SECTOR_INVALIDO);
      }
      if (sectorId === sectorActual) return;

      const ahora = Date.now();
      while (cambiosSector.length && ahora - cambiosSector[0] >= VENTANA_CAMBIOS_MS) cambiosSector.shift();
      if (cambiosSector.length >= config.cambiosSectorPorMin) {
        return socket.emit('error_message', 'Cambias de sector demasiado seguido. Espera un momento.');
      }
      // Cuenta el intento, exista o no el sector: probar sectores al azar también consume el tope.
      cambiosSector.push(ahora);
      const turno = ++turnoSector;

      try {
        if (!(await sectores.existe(socket.supabase, sectorId, ahora))) {
          return socket.emit('error_message', MENSAJE_SECTOR_INVALIDO);
        }
      } catch (err) {
        console.error(`[Socket.io] Error en join_sector: ${err.message}`);
        return socket.emit('error_message', 'No se pudo entrar al sector. Intenta de nuevo.');
      }
      // Si llegó otro join_sector mientras se esperaba el catálogo, gana el más reciente.
      if (turno !== turnoSector) return;

      if (sectorActual) socket.leave(`sector:${sectorActual}`);
      socket.join(`sector:${sectorId}`);
      sectorActual = sectorId;
      console.log(`[Socket.io] usuario=${socket.user.id} sector=${sectorId}`);
    });

    // Solo ubicación y sector. La disponibilidad se cambia con PATCH /api/conductores/disponibilidad
    // y "ocupado" lo pone la aceptación (plan R10): si llega "estado", se ignora.
    // La misma lógica atiende POST /api/conductores/ubicacion (paso 004, plan P11 y P14).
    socket.on('update_location', async ({ sectorId, coords } = {}) => {
      try {
        const resultado = await guardarUbicacion({
          db: socket.supabase,
          usuario: socket.user,
          sectorId,
          coords,
          emitir: (sala, evento, datos) => socket.to(sala).emit(evento, datos),
        });
        if (!resultado.ok) socket.emit('error_message', resultado.mensaje);
      } catch (err) {
        console.error(`[Socket.io] Error en update_location: ${err.message}`);
        socket.emit('error_message', 'Error interno al actualizar la ubicación.');
      }
    });

    // --- MÓDULO 2: DESPACHO (paso 003) ---

    // El conductor rechaza su oferta: la BD la marca (rechazar_oferta, con su JWT) y el
    // despachador pasa al siguiente sin esperar los 15 s (criterio 6).
    socket.on('rechazar_oferta', async ({ viajeId } = {}) => {
      try {
        if (socket.user.rol !== 'conductor') {
          return socket.emit('error_message', 'Acción denegada. Solo los conductores responden ofertas.');
        }
        if (!isUuid(viajeId)) {
          return socket.emit('error_message', 'El identificador del viaje no es válido.');
        }

        const { data: rechazada, error } = await socket.supabase.rpc('rechazar_oferta', { p_viaje: viajeId });
        if (error) {
          console.error(`[Socket.io] Error en rechazar_oferta: ${error.message}`);
          return socket.emit('error_message', 'No se pudo rechazar la oferta.');
        }
        // Sin oferta pendiente (ya venció o la tomó otro) no hay nada que hacer.
        if (rechazada) {
          obtenerDespachador()?.alResponder(viajeId);
        }
      } catch (err) {
        console.error(`[Socket.io] Error en rechazar_oferta: ${err.message}`);
        socket.emit('error_message', 'Error interno al rechazar la oferta.');
      }
    });

    // --- MÓDULO 3: CHAT EN TIEMPO REAL ---

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
          // 42501: la política de 0017 no deja escribir si el viaje terminó o se canceló (005, criterio 7).
          if (error.code === '42501') {
            return socket.emit('error_message', 'El chat se cerró porque el viaje terminó. Puedes leer los mensajes, pero ya no escribir.');
          }
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
      console.log(`[Socket.io] Desconexión: usuario=${socket.user.id} socket=${socket.id}`);
    });
  });
};

module.exports = initSocketHandler;

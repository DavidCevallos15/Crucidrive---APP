const { supabase } = require('../config/supabase');

/**
 * Valida que un valor sea una coordenada numérica finita dentro de rangos geográficos.
 * @param {*} lat - Latitud a validar
 * @param {*} lng - Longitud a validar
 * @returns {boolean}
 */
const isValidCoordinate = (lat, lng) => {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

/**
 * Crea una nueva solicitud de viaje para el pasajero autenticado.
 * 
 * @param {import('express').Request} req - Objeto de petición Express.
 * @param {import('express').Response} res - Objeto de respuesta Express.
 */
const solicitarViaje = async (req, res) => {
  try {
    const { origen, destino } = req.body;
    const pasajeroId = req.user.id;

    if (!origen || !destino || origen.lat == null || origen.lng == null || destino.lat == null || destino.lng == null) {
      return res.status(400).json({
        status: 'error',
        message: 'Las coordenadas de origen (lat, lng) y destino (lat, lng) son obligatorias.'
      });
    }

    const origenLat = Number(origen.lat);
    const origenLng = Number(origen.lng);
    const destinoLat = Number(destino.lat);
    const destinoLng = Number(destino.lng);

    if (!isValidCoordinate(origenLat, origenLng) || !isValidCoordinate(destinoLat, destinoLng)) {
      return res.status(400).json({
        status: 'error',
        message: 'Las coordenadas proporcionadas no son válidas.'
      });
    }

    // Para el MVP en Crucita, asignaremos una tarifa fija estándar de $1.50 USD
    const tarifa = 1.50;

    // Coordenadas validadas numéricamente antes de interpolación WKT
    const origenWKT = `POINT(${origenLng} ${origenLat})`;
    const destinoWKT = `POINT(${destinoLng} ${destinoLat})`;

    // Insertar el nuevo viaje en la base de datos
    const { data: viaje, error } = await supabase
      .from('viajes')
      .insert([
        {
          pasajero_id: pasajeroId,
          origen: origenWKT,
          destino: destinoWKT,
          estado: 'solicitado',
          tarifa
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('[Viaje] Error al registrar solicitud:', error.message);
      return res.status(400).json({
        status: 'error',
        message: 'Error al registrar la solicitud del viaje.'
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Viaje solicitado correctamente.',
      data: viaje
    });
  } catch (err) {
    console.error('[Viaje] Error interno al solicitar viaje:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Error interno al solicitar el viaje.'
    });
  }
};

/**
 * Permite a un conductor aceptar un viaje en estado 'solicitado'.
 * Crea transaccionalmente el canal de chat (thread) e ingresa a ambos miembros.
 * 
 * @param {import('express').Request} req - Objeto de petición Express.
 * @param {import('express').Response} res - Objeto de respuesta Express.
 */
const aceptarViaje = async (req, res) => {
  try {
    const { viajeId } = req.body;
    const conductorId = req.user.id;

    if (!viajeId || typeof viajeId !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'El identificador del viaje (viajeId) es requerido.'
      });
    }

    // 1. Obtener detalles actuales del viaje
    const { data: viaje, error: getError } = await supabase
      .from('viajes')
      .select('*')
      .eq('id', viajeId)
      .single();

    if (getError || !viaje) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontró el viaje solicitado.'
      });
    }

    // Validar estado del viaje
    if (viaje.estado !== 'solicitado') {
      return res.status(400).json({
        status: 'error',
        message: `El viaje no puede ser aceptado porque está en estado: ${viaje.estado}`
      });
    }

    // 2. Actualizar el estado del viaje a 'aceptado' y asignar conductor
    const { data: viajeActualizado, error: updateError } = await supabase
      .from('viajes')
      .update({
        conductor_id: conductorId,
        estado: 'aceptado',
        updated_at: new Date().toISOString()
      })
      .eq('id', viajeId)
      .select()
      .single();

    if (updateError) {
      console.error('[Viaje] Error al aceptar viaje:', updateError.message);
      return res.status(400).json({
        status: 'error',
        message: 'Error al aceptar el viaje.'
      });
    }

    // 3. Crear el hilo de chat (Thread) para el viaje
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .insert([{ viaje_id: viajeId }])
      .select()
      .single();

    if (threadError) {
      // Intentamos revertir el viaje a solicitado si falla la creación del chat
      await supabase.from('viajes').update({ conductor_id: null, estado: 'solicitado' }).eq('id', viajeId);
      console.error('[Viaje] Error al crear thread de chat:', threadError.message);
      return res.status(500).json({
        status: 'error',
        message: 'Error al inicializar el hilo de comunicación del viaje.'
      });
    }

    // 4. Agregar a los miembros al hilo de chat (Pasajero y Conductor)
    const miembros = [
      { thread_id: thread.id, user_id: viaje.pasajero_id },
      { thread_id: thread.id, user_id: conductorId }
    ];

    const { error: membersError } = await supabase
      .from('thread_members')
      .insert(miembros);

    if (membersError) {
      // Limpieza en caso de falla
      await supabase.from('threads').delete().eq('id', thread.id);
      await supabase.from('viajes').update({ conductor_id: null, estado: 'solicitado' }).eq('id', viajeId);
      
      console.error('[Viaje] Error al registrar miembros del chat:', membersError.message);
      return res.status(500).json({
        status: 'error',
        message: 'Error al registrar los participantes en el chat del viaje.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Viaje aceptado correctamente e hilo de chat inicializado.',
      data: {
        viaje: viajeActualizado,
        chat: {
          threadId: thread.id
        }
      }
    });
  } catch (err) {
    console.error('[Viaje] Error interno al aceptar viaje:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Error interno al aceptar el viaje.'
    });
  }
};

/**
 * Cambia el estado del viaje (en_curso, finalizado, cancelado).
 * Valida que el solicitante sea participante del viaje.
 * 
 * @param {import('express').Request} req - Objeto de petición Express.
 * @param {import('express').Response} res - Objeto de respuesta Express.
 */
const cambiarEstadoViaje = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const userId = req.user.id;

    if (!estado || !['en_curso', 'finalizado', 'cancelado'].includes(estado)) {
      return res.status(400).json({
        status: 'error',
        message: 'Estado inválido. Debe ser: "en_curso", "finalizado" o "cancelado".'
      });
    }

    // 1. Obtener detalles del viaje
    const { data: viaje, error: getError } = await supabase
      .from('viajes')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !viaje) {
      return res.status(404).json({
        status: 'error',
        message: 'No se encontró el viaje solicitado.'
      });
    }

    // Validar que el usuario sea el pasajero o el conductor del viaje
    if (viaje.pasajero_id !== userId && viaje.conductor_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. No eres participante de este viaje.'
      });
    }

    // Validaciones de transición lógica de estados
    if (estado === 'en_curso' && viaje.estado !== 'aceptado') {
      return res.status(400).json({
        status: 'error',
        message: 'El viaje debe estar "aceptado" antes de iniciar ("en_curso").'
      });
    }

    if (estado === 'finalizado' && viaje.estado !== 'en_curso') {
      return res.status(400).json({
        status: 'error',
        message: 'El viaje debe estar "en_curso" antes de finalizar.'
      });
    }

    if (estado === 'cancelado' && ['finalizado', 'cancelado'].includes(viaje.estado)) {
      return res.status(400).json({
        status: 'error',
        message: `No se puede cancelar un viaje que ya está ${viaje.estado}.`
      });
    }

    // 2. Actualizar el estado en la base de datos
    const { data: viajeActualizado, error: updateError } = await supabase
      .from('viajes')
      .update({
        estado,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[Viaje] Error al actualizar estado:', updateError.message);
      return res.status(400).json({
        status: 'error',
        message: 'Error al actualizar el estado del viaje.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Estado del viaje actualizado a "${estado}" correctamente.`,
      data: viajeActualizado
    });
  } catch (err) {
    console.error('[Viaje] Error interno al cambiar estado:', err.message);
    res.status(500).json({
      status: 'error',
      message: 'Error interno al cambiar el estado del viaje.'
    });
  }
};

module.exports = {
  solicitarViaje,
  aceptarViaje,
  cambiarEstadoViaje
};

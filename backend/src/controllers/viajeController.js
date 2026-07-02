const { supabase } = require('../config/supabase');

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

    if (!origen || !destino || !origen.lat || !origen.lng || !destino.lat || !origen.lng) {
      return res.status(400).json({
        status: 'error',
        message: 'Las coordenadas de origen (lat, lng) y destino (lat, lng) son obligatorias.'
      });
    }

    // Para el MVP en Crucita, asignaremos una tarifa fija estándar de $1.50 USD
    // En el futuro, se puede integrar una fórmula de cálculo por cuadrantes de geocercas
    const tarifa = 1.50;

    // Convertir coordenadas al formato Well-Known Text (WKT) de PostGIS: POINT(longitude latitude)
    const origenWKT = `POINT(${origen.lng} ${origen.lat})`;
    const destinoWKT = `POINT(${destino.lng} ${destino.lat})`;

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
      return res.status(400).json({
        status: 'error',
        message: 'Error al registrar la solicitud del viaje.',
        details: error.message
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Viaje solicitado correctamente.',
      data: viaje
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error interno al solicitar el viaje.',
      details: err.message
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

    if (!viajeId) {
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
        message: 'No se encontró el viaje solicitado.',
        details: getError ? getError.message : null
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
      return res.status(400).json({
        status: 'error',
        message: 'Error al aceptar el viaje.',
        details: updateError.message
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
      return res.status(500).json({
        status: 'error',
        message: 'Error al inicializar el hilo de comunicación del viaje.',
        details: threadError.message
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
      
      return res.status(500).json({
        status: 'error',
        message: 'Error al registrar los participantes en el chat del viaje.',
        details: membersError.message
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
    res.status(500).json({
      status: 'error',
      message: 'Error interno al aceptar el viaje.',
      details: err.message
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
        message: 'No se encontró el viaje solicitado.',
        details: getError ? getError.message : null
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
      return res.status(400).json({
        status: 'error',
        message: 'Error al actualizar el estado del viaje.',
        details: updateError.message
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Estado del viaje actualizado a "${estado}" correctamente.`,
      data: viajeActualizado
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error interno al cambiar el estado del viaje.',
      details: err.message
    });
  }
};

module.exports = {
  solicitarViaje,
  aceptarViaje,
  cambiarEstadoViaje
};

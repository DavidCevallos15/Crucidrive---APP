/** Sincronización y limpieza del guion de humo; no depende de cuentas reales. */
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const conectarSocket = (crearSocket, api, token, ms = 8000) =>
  new Promise((resolve, reject) => {
    const socket = crearSocket(api, {
      auth: { token }, transports: ['websocket'], autoConnect: false, reconnection: false,
    });
    let conectado = false;
    let horaRecibida = false;
    const limpiar = () => {
      clearTimeout(timer);
      socket.off('connect', alConectar);
      socket.off('hora_servidor', alRecibirHora);
      socket.off('connect_error', alFallar);
    };
    const completar = () => {
      if (!conectado || !horaRecibida) return;
      limpiar();
      resolve(socket);
    };
    const alConectar = () => { conectado = true; completar(); };
    const alFallar = (error) => {
      limpiar();
      socket.close();
      reject(new Error(`Socket: ${error.message}`));
    };
    const alRecibirHora = (datos) => {
      if (!Number.isFinite(datos?.ahora)) return alFallar(new Error('hora_servidor inválida'));
      socket.desfaseMs = datos.ahora - Date.now();
      horaRecibida = true;
      completar();
    };
    const timer = setTimeout(() => alFallar(new Error('No llegaron la conexión y hora_servidor a tiempo')), ms);
    socket.on('connect', alConectar);
    socket.on('hora_servidor', alRecibirHora);
    socket.on('connect_error', alFallar);
    socket.connect();
  });

/** Registra el listener antes de la acción que provoca el evento. */
const esperar = (socket, evento, filtro = () => true, ms = 8000) =>
  new Promise((resolve) => {
    const terminar = (datos) => {
      clearTimeout(timer);
      socket.off(evento, alRecibir);
      resolve(datos);
    };
    const alRecibir = (datos) => { if (filtro(datos)) terminar(datos); };
    const timer = setTimeout(() => terminar(null), ms);
    socket.on(evento, alRecibir);
  });

const esperarCondicion = async (consultar, mensaje, ms = 8000) => {
  const limite = Date.now() + ms;
  do {
    const resultado = await consultar();
    if (resultado) return resultado;
    await dormir(Math.min(200, Math.max(0, limite - Date.now())));
  } while (Date.now() < limite);
  throw new Error(mensaje);
};

/** Solo se cierran viajes de estas cuentas identificados como prueba de humo. */
const cerrarViajesDePrueba = async (pas, con, http) => {
  const viajes = new Map();
  for (const usuario of [pas, con]) {
    const { data, error } = await usuario.sb.from('viajes')
      .select('id, estado, pasajero_id, conductor_id, destino_descripcion')
      .or(`pasajero_id.eq.${usuario.id},conductor_id.eq.${usuario.id}`)
      .in('estado', ['solicitado', 'aceptado', 'en_curso']);
    if (error) throw new Error('No se pudieron consultar los viajes activos para la limpieza.');
    for (const viaje of data || []) viajes.set(viaje.id, viaje);
  }
  // Validar todos antes de cambiar cualquiera: no interrumpir viajes ajenos a la prueba.
  for (const viaje of viajes.values()) {
    if (viaje.pasajero_id !== pas.id || (viaje.conductor_id && viaje.conductor_id !== con.id)
        || viaje.destino_descripcion !== 'Prueba de humo') {
      throw new Error('Las cuentas tienen un viaje activo ajeno al guion. Termínalo desde la app antes de correr smoke.');
    }
  }
  for (const viaje of viajes.values()) {
    const estado = viaje.estado === 'en_curso' ? 'finalizado' : 'cancelado';
    const respuesta = await http(pas.token, 'PATCH', `/api/viajes/${viaje.id}/estado`, { estado });
    if (respuesta.status === 200) continue;
    // Puede haber vencido entre el SELECT y la cancelación.
    const { data, error } = await pas.sb.from('viajes').select('estado').eq('id', viaje.id).single();
    if (error || !['cancelado', 'finalizado', 'sin_conductor'].includes(data?.estado)) {
      throw new Error(`No se pudo cerrar un viaje de prueba (HTTP ${respuesta.status}).`);
    }
  }
  return viajes.size;
};

const bytesEvento = (evento, datos) => Buffer.byteLength(`42${JSON.stringify([evento, datos])}`);

module.exports = { conectarSocket, esperar, esperarCondicion, cerrarViajesDePrueba, dormir, bytesEvento };

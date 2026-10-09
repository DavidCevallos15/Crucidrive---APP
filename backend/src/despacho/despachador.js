/**
 * Despachador del paso 003 (D-11; plan R1, R5, R6, R12, R22).
 *
 * Regla mixta: el viaje se ofrece de uno en uno a los N candidatos más cercanos (X s cada uno);
 * si ninguno acepta, se avisa a la vez a todos los demás candidatos hasta el máximo de tiempo.
 * Sin candidatos, o cumplido el máximo, la solicitud se cierra como "sin_conductor".
 *
 * La BD es la fuente de verdad (ofertas_viaje con vence_en): este módulo solo decide cuándo
 * pedir candidatos, crear ofertas y avisar por socket. Si el proceso se reinicia, recuperar()
 * reconstruye el estado desde las filas. Usa la clave de servicio, como permite CLAUDE.md para
 * el despacho; aceptar y rechazar los hace cada conductor con su propio JWT.
 */
const { armarOferta, COLUMNAS_VIAJE } = require('./oferta');
const { salaUsuario } = require('./salas');

/**
 * @param {object} deps
 * @param {() => import('@supabase/supabase-js').SupabaseClient} deps.obtenerDb - Cliente con la clave de servicio.
 * @param {{ to: (sala: string) => { emit: Function } }} deps.io - Servidor de Socket.io.
 * @param {{ estaConectado: (userId: string) => boolean }} deps.conexiones
 * @param {ReturnType<import('./config').leerConfigDespacho>} deps.config
 * @param {() => number} [deps.ahora]
 */
const crearDespachador = ({ obtenerDb, io, conexiones, config, ahora = Date.now }) => {
  /** viajeId → { viaje, fase, enviadas, timer, cola } */
  const activos = new Map();

  const emitir = (userId, evento, datos) => io.to(salaUsuario(userId)).emit(evento, datos);
  const limite = (viaje) => new Date(viaje.creado_en).getTime() + config.maxSeg * 1000;

  const rpc = async (nombre, args) => {
    const { data, error } = await obtenerDb().rpc(nombre, args);
    if (error) throw new Error(`${nombre}: ${error.message}`);
    return data || [];
  };

  const ofertasDelViaje = async (viajeId) => {
    const { data, error } = await obtenerDb()
      .from('ofertas_viaje')
      .select('conductor_id, fase, resultado, vence_en')
      .eq('viaje_id', viajeId);
    if (error) throw new Error(`ofertas_viaje: ${error.message}`);
    return data || [];
  };

  /** Ejecuta las tareas de un mismo viaje de una en una (temporizador, rechazo y barrido pueden coincidir). */
  const enCola = (viajeId, tarea) => {
    const estado = activos.get(viajeId);
    if (!estado) return Promise.resolve();
    estado.cola = estado.cola.then(tarea).catch((err) => {
      console.error(`[despacho] Viaje ${viajeId}: ${err.message}`);
    });
    return estado.cola;
  };

  const programar = (viajeId, ms) => {
    const estado = activos.get(viajeId);
    if (!estado) return;
    clearTimeout(estado.timer);
    const espera = Math.max(0, Math.min(ms, limite(estado.viaje) - ahora()));
    // Al vencer: se cierran las ofertas pasadas de hora y se decide el siguiente paso.
    estado.timer = setTimeout(() => {
      barrer().then(() => enCola(viajeId, () => avanzar(viajeId)));
    }, espera + 50);
  };

  const olvidar = (viajeId) => {
    const estado = activos.get(viajeId);
    if (estado) clearTimeout(estado.timer);
    activos.delete(viajeId);
  };

  /** Avisa según las filas que devuelven cerrar_vencidos y cerrar_sin_conductor. */
  const avisarCierres = (filas) => {
    for (const { tipo, viaje_id: viajeId, usuario_id: userId } of filas) {
      if (tipo === 'oferta_vencida' || tipo === 'oferta_retirada') {
        emitir(userId, 'oferta_retirada', { viajeId });
      } else if (tipo === 'viaje_sin_conductor') {
        emitir(userId, 'viaje_sin_conductor', { viajeId });
        olvidar(viajeId);
      }
    }
  };

  const cerrarSinConductor = async (viajeId) => {
    avisarCierres(await rpc('cerrar_sin_conductor', { p_viaje: viajeId }));
    olvidar(viajeId);
  };

  const candidatosConectados = async (viajeId) => {
    const candidatos = await rpc('candidatos_despacho', {
      p_viaje: viajeId,
      p_ubicacion_max_seg: config.ubicacionMaxSeg,
    });
    return candidatos.filter((c) => conexiones.estaConectado(c.conductor_id));
  };

  const ofrecer = async (estado, conductores, fase, venceEn) => {
    const creadas = await rpc('crear_ofertas', {
      p_viaje: estado.viaje.id,
      p_conductores: conductores,
      p_fase: fase,
      p_vence_en: new Date(venceEn).toISOString(),
    });
    for (const oferta of creadas) {
      emitir(oferta.conductor_id, 'oferta_viaje', armarOferta(estado.viaje, oferta));
    }
    return creadas;
  };

  /** Decide el siguiente paso del viaje. Siempre corre dentro de enCola. */
  const avanzar = async (viajeId) => {
    const estado = activos.get(viajeId);
    if (!estado) return;
    if (ahora() >= limite(estado.viaje)) return cerrarSinConductor(viajeId);

    const pendientes = (await ofertasDelViaje(viajeId)).filter((o) => o.resultado === 'pendiente');

    if (estado.fase === 'secuencial') {
      // Hay una oferta secuencial vigente: se espera su respuesta o lo que le falta para vencer
      // según la BD (si el reloj de la BD va un poco atrás, se reintenta en medio segundo).
      if (pendientes.length > 0) {
        const vence = Math.max(...pendientes.map((o) => new Date(o.vence_en).getTime()));
        return programar(viajeId, Math.max(500, vence - ahora()));
      }
      if (estado.enviadas < config.secuenciales) {
        for (const candidato of await candidatosConectados(viajeId)) {
          const creadas = await ofrecer(estado, [candidato.conductor_id], 'secuencial', ahora() + config.ofertaSeg * 1000);
          // Si no se creó (el conductor recibió otra oferta un instante antes), se prueba el siguiente.
          if (creadas.length > 0) {
            estado.enviadas += 1;
            return programar(viajeId, config.ofertaSeg * 1000);
          }
        }
        // Nadie a quien ofrecer: sin candidatos o ya se ofreció a todos.
        if (estado.enviadas === 0) return cerrarSinConductor(viajeId);
      }
      estado.fase = 'abierta';
    }

    // Aviso abierto: a todos los candidatos conectados que aún no lo recibieron, hasta el límite.
    const nuevos = await candidatosConectados(viajeId);
    const creadas = nuevos.length
      ? await ofrecer(estado, nuevos.map((c) => c.conductor_id), 'abierta', limite(estado.viaje))
      : [];
    if (pendientes.length + creadas.length === 0) return cerrarSinConductor(viajeId);
    // Cada cierto tiempo se vuelve a mirar si se conectó alguien más.
    programar(viajeId, config.barridoSeg * 1000);
  };

  const registrar = (viaje, { fase = 'secuencial', enviadas = 0 } = {}) => {
    if (activos.has(viaje.id)) return activos.get(viaje.id);
    const estado = { viaje, fase, enviadas, timer: null, cola: Promise.resolve() };
    activos.set(viaje.id, estado);
    return estado;
  };

  const leerViaje = async (viajeId) => {
    const { data, error } = await obtenerDb().from('viajes').select(COLUMNAS_VIAJE).eq('id', viajeId).single();
    if (error) throw new Error(`viajes: ${error.message}`);
    return data;
  };

  /** Ofertas vencidas y solicitudes viejas: lo cierra la BD y aquí se avisa (criterio 14). */
  const barrer = async () => {
    try {
      avisarCierres(await rpc('cerrar_vencidos', { p_max_seg: config.maxSeg }));
    } catch (err) {
      console.error(`[despacho] Barrido: ${err.message}`);
    }
  };

  return {
    /** Empieza a buscar conductor para un viaje recién solicitado. */
    async iniciar(viajeOId) {
      try {
        const viaje = typeof viajeOId === 'string' ? await leerViaje(viajeOId) : viajeOId;
        if (!viaje || viaje.estado !== 'solicitado') return;
        registrar(viaje);
        await enCola(viaje.id, () => avanzar(viaje.id));
      } catch (err) {
        console.error(`[despacho] No se pudo iniciar el despacho: ${err.message}`);
      }
    },

    /** Un conductor rechazó o soltó su oferta: se pasa al siguiente sin esperar el vencimiento. */
    alResponder(viajeId) {
      return enCola(viajeId, () => avanzar(viajeId));
    },

    /**
     * El viaje fue aceptado: se deja de buscar, se retira la oferta de los demás y se avisa al pasajero.
     * @param {object} viaje - Fila del viaje (al menos id y pasajero_id).
     * @param {object} datosConductor - Lo que el pasajero puede ver del conductor (criterio 10).
     */
    async aceptado(viaje, datosConductor) {
      olvidar(viaje.id);
      try {
        for (const o of await ofertasDelViaje(viaje.id)) {
          if (o.resultado === 'tomada') emitir(o.conductor_id, 'oferta_retirada', { viajeId: viaje.id });
        }
      } catch (err) {
        console.error(`[despacho] Retirar ofertas del viaje ${viaje.id}: ${err.message}`);
      }
      emitir(viaje.pasajero_id, 'viaje_aceptado', { viajeId: viaje.id, ...datosConductor });
    },

    /** El pasajero canceló mientras se buscaba (criterio 12): la BD ya cerró las ofertas. */
    async cancelar(viajeId) {
      olvidar(viajeId);
      try {
        for (const o of await ofertasDelViaje(viajeId)) {
          if (o.resultado === 'cancelada') emitir(o.conductor_id, 'oferta_retirada', { viajeId });
        }
      } catch (err) {
        console.error(`[despacho] Retirar ofertas del viaje cancelado ${viajeId}: ${err.message}`);
      }
    },

    barrer,

    /** Al arrancar: cierra lo vencido y retoma las solicitudes que siguen buscando (criterio 14). */
    async recuperar() {
      await barrer();
      try {
        const { data: viajes, error } = await obtenerDb().from('viajes').select(COLUMNAS_VIAJE).eq('estado', 'solicitado');
        if (error) throw new Error(`viajes: ${error.message}`);
        for (const viaje of viajes || []) {
          const ofertas = await ofertasDelViaje(viaje.id);
          const enviadas = ofertas.filter((o) => o.fase === 'secuencial').length;
          const abierta = ofertas.some((o) => o.fase === 'abierta') || enviadas >= config.secuenciales;
          registrar(viaje, { fase: abierta ? 'abierta' : 'secuencial', enviadas });
          await enCola(viaje.id, () => avanzar(viaje.id));
        }
        if (viajes?.length) console.log(`[despacho] Retomadas ${viajes.length} solicitudes tras el arranque.`);
      } catch (err) {
        console.error(`[despacho] Recuperación: ${err.message}`);
      }
    },

    /** Para pruebas y para el apagado ordenado. */
    detener() {
      for (const viajeId of [...activos.keys()]) olvidar(viajeId);
    },

    estaBuscando: (viajeId) => activos.has(viajeId),
  };
};

module.exports = { crearDespachador };

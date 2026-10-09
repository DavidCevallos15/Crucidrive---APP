/**
 * BD falsa para probar el despachador sin Supabase. Imita las reglas de 0012_despacho.sql que le
 * importan al despachador: una oferta pendiente por conductor, nadie recibe dos veces el mismo
 * viaje, cerrar_vencidos y cerrar_sin_conductor. Las reglas en sí se prueban en supabase/tests.
 */
const crearBdDespachoFalsa = ({ ahora = Date.now } = {}) => {
  const viajes = new Map();
  const ofertas = [];
  /** Candidatos en orden de cercanía, por viaje: [{ conductor_id, distancia_m }] */
  const candidatosBase = new Map();
  const rechazarCreacion = new Set();

  const tieneOfertaPendiente = (conductorId) => ofertas.some((o) => o.conductor_id === conductorId && o.resultado === 'pendiente');
  const recibioViaje = (viajeId, conductorId) => ofertas.some((o) => o.viaje_id === viajeId && o.conductor_id === conductorId);

  const rpcs = {
    candidatos_despacho: ({ p_viaje }) => {
      const viaje = viajes.get(p_viaje);
      if (!viaje || viaje.estado !== 'solicitado') return [];
      return (candidatosBase.get(p_viaje) || [])
        .filter((c) => !tieneOfertaPendiente(c.conductor_id) && !recibioViaje(p_viaje, c.conductor_id));
    },
    crear_ofertas: ({ p_viaje, p_conductores, p_fase, p_vence_en }) => {
      const viaje = viajes.get(p_viaje);
      if (!viaje || viaje.estado !== 'solicitado') return [];
      const creadas = [];
      for (const conductorId of p_conductores) {
        if (rechazarCreacion.has(conductorId) || tieneOfertaPendiente(conductorId) || recibioViaje(p_viaje, conductorId)) continue;
        const base = (candidatosBase.get(p_viaje) || []).find((c) => c.conductor_id === conductorId);
        const oferta = {
          viaje_id: p_viaje, conductor_id: conductorId, fase: p_fase, vence_en: p_vence_en,
          resultado: 'pendiente', distancia_m: base ? base.distancia_m : null,
        };
        ofertas.push(oferta);
        creadas.push(oferta);
      }
      return creadas;
    },
    cerrar_vencidos: ({ p_max_seg }) => {
      const filas = [];
      for (const o of ofertas) {
        if (o.resultado === 'pendiente' && new Date(o.vence_en).getTime() <= ahora()) {
          o.resultado = 'vencida';
          filas.push({ tipo: 'oferta_vencida', viaje_id: o.viaje_id, usuario_id: o.conductor_id });
        }
      }
      for (const v of viajes.values()) {
        if (v.estado === 'solicitado' && new Date(v.creado_en).getTime() <= ahora() - p_max_seg * 1000) {
          filas.push(...rpcs.cerrar_sin_conductor({ p_viaje: v.id }));
        }
      }
      return filas;
    },
    cerrar_sin_conductor: ({ p_viaje }) => {
      const viaje = viajes.get(p_viaje);
      if (!viaje || viaje.estado !== 'solicitado') return [];
      const filas = [];
      for (const o of ofertas) {
        if (o.viaje_id === p_viaje && o.resultado === 'pendiente') {
          filas.push({ tipo: 'oferta_retirada', viaje_id: p_viaje, usuario_id: o.conductor_id });
          o.resultado = 'vencida';
        }
      }
      viaje.estado = 'sin_conductor';
      filas.push({ tipo: 'viaje_sin_conductor', viaje_id: p_viaje, usuario_id: viaje.pasajero_id });
      return filas;
    },
  };

  /** Consultas encadenadas mínimas: from(t).select(c).eq(k, v)[.single()] */
  const consulta = (tabla) => {
    const filtros = [];
    const filas = () => {
      const fuente = tabla === 'viajes' ? [...viajes.values()] : ofertas;
      return fuente.filter((f) => filtros.every(([k, v]) => f[k] === v)).map((f) => ({ ...f }));
    };
    const q = {
      select: () => q,
      eq: (k, v) => { filtros.push([k, v]); return q; },
      single: () => Promise.resolve({ data: filas()[0] || null, error: filas()[0] ? null : { message: 'sin filas' } }),
      then: (ok, mal) => Promise.resolve({ data: filas(), error: null }).then(ok, mal),
    };
    return q;
  };

  const db = {
    rpc: jest.fn(async (nombre, args) => ({ data: rpcs[nombre](args), error: null })),
    from: jest.fn((tabla) => consulta(tabla)),
  };

  return {
    db,
    viajes,
    ofertas,
    agregarViaje(viaje) {
      viajes.set(viaje.id, { estado: 'solicitado', creado_en: new Date(ahora()).toISOString(), ...viaje });
      return viajes.get(viaje.id);
    },
    fijarCandidatos(viajeId, lista) { candidatosBase.set(viajeId, lista); },
    /** Simula una carrera: el conductor recibió otra oferta justo antes y crear_ofertas lo omite. */
    ocupadoEnOtraOferta(conductorId) { rechazarCreacion.add(conductorId); },
    /** Lo que hace la BD cuando el conductor llama a rechazar_oferta. */
    rechazar(viajeId, conductorId) {
      const o = ofertas.find((x) => x.viaje_id === viajeId && x.conductor_id === conductorId && x.resultado === 'pendiente');
      if (o) o.resultado = 'rechazada';
    },
    /** Lo que hace el trigger al cancelar el pasajero una solicitud. */
    cancelarViaje(viajeId) {
      viajes.get(viajeId).estado = 'cancelado';
      for (const o of ofertas) if (o.viaje_id === viajeId && o.resultado === 'pendiente') o.resultado = 'cancelada';
    },
    /** Lo que hace aceptar_viaje. */
    aceptar(viajeId, conductorId) {
      viajes.get(viajeId).estado = 'aceptado';
      for (const o of ofertas) {
        if (o.viaje_id !== viajeId || o.resultado !== 'pendiente') continue;
        o.resultado = o.conductor_id === conductorId ? 'aceptada' : 'tomada';
      }
    },
  };
};

module.exports = { crearBdDespachoFalsa };

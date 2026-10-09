/**
 * Avisos con la app cerrada (paso 004, D-12). Lee los tokens con la clave de servicio (tarea del
 * sistema, como el despacho) y envía sin que nadie espere el resultado: si Expo falla o tarda,
 * el despacho sigue igual por la BD y el socket (criterio 12).
 */
const { crearClienteExpo } = require('./expo');
const mensajes = require('./mensajes');

/**
 * @param {object} deps
 * @param {() => import('@supabase/supabase-js').SupabaseClient} deps.obtenerDb - Clave de servicio.
 * @param {ReturnType<typeof crearClienteExpo>} [deps.cliente]
 * @param {boolean} [deps.activos] - AVISOS_ACTIVOS=false los apaga (p. ej. en pruebas locales).
 */
const crearAvisos = ({ obtenerDb, cliente = crearClienteExpo(), activos = process.env.AVISOS_ACTIVOS !== 'false' }) => {
  let sectores = null;

  /** Nombres de los sectores, leídos una vez de la BD (no se copian a mano en el código). */
  const cargarSectores = async () => {
    if (sectores) return sectores;
    const { data, error } = await obtenerDb().from('sectores').select('id, nombre');
    if (error) throw new Error(`sectores: ${error.message}`);
    sectores = new Map((data || []).map((s) => [s.id, s.nombre]));
    return sectores;
  };

  /** userId → tokens de sus teléfonos. */
  const tokensDe = async (userIds) => {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return new Map();
    const { data, error } = await obtenerDb().from('dispositivos_push').select('token, usuario_id').in('usuario_id', ids);
    if (error) throw new Error(`dispositivos_push: ${error.message}`);
    const porUsuario = new Map();
    for (const { token, usuario_id: uid } of data || []) {
      porUsuario.set(uid, [...(porUsuario.get(uid) || []), token]);
    }
    return porUsuario;
  };

  /** Tokens que Expo da por desinstalados: se borran para no seguir gastando envíos (P4). */
  const olvidar = async (tokens) => {
    if (!tokens.length) return;
    const { error } = await obtenerDb().from('dispositivos_push').delete().in('token', tokens);
    if (error) console.error(`[Avisos] No se pudieron borrar tokens inválidos: ${error.message}`);
  };

  /** Arma y envía a los teléfonos de un usuario. Nunca lanza: registra el error y sigue. */
  const enviarA = async (userId, armar) => {
    if (!activos) return;
    try {
      const tokens = (await tokensDe([userId])).get(userId) || [];
      if (!tokens.length) return;
      const lista = await armar(tokens);
      const { invalidos } = await cliente.enviar(lista);
      await olvidar(invalidos);
    } catch (err) {
      console.error(`[Avisos] ${err.message}`);
    }
  };

  return {
    /** Quiénes de estos usuarios tienen al menos un teléfono para avisos (candidatos sin socket, P5). */
    async conToken(userIds) {
      if (!activos) return new Set();
      return new Set((await tokensDe(userIds)).keys());
    },
    oferta(conductorId, oferta) {
      return enviarA(conductorId, async (tokens) => {
        const nombres = await cargarSectores();
        return mensajes.avisoOferta(oferta, tokens, (id) => nombres.get(id));
      });
    },
    retirada(conductorId, viajeId) {
      return enviarA(conductorId, (tokens) => mensajes.avisoRetirada(viajeId, tokens));
    },
    aceptado(pasajeroId, viajeId, conductor) {
      return enviarA(pasajeroId, (tokens) => mensajes.avisoAceptado(viajeId, conductor, tokens));
    },
    sinConductor(pasajeroId, viajeId) {
      return enviarA(pasajeroId, (tokens) => mensajes.avisoSinConductor(viajeId, tokens));
    },
  };
};

module.exports = { crearAvisos };

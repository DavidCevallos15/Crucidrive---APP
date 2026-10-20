/**
 * Sanción por finalizar el viaje el pasajero (005, criterios 5b y 5c; plan P5b). Con N
 * finalizaciones propias en la ventana, no puede pedir viajes durante el bloqueo, contado
 * desde la última. Los números se leen del entorno, como los de D-11: un valor inválido
 * detiene el arranque del servidor.
 */

// nombre de la variable → [mínimo, máximo, por defecto]
const LIMITES = {
  SANCION_FINALIZAR_MAX: [1, 20, 3],
  SANCION_VENTANA_DIAS: [1, 90, 30],
  SANCION_BLOQUEO_HORAS: [1, 168, 24],
};

const leerEntero = (env, nombre) => {
  const [min, max, defecto] = LIMITES[nombre];
  const crudo = env[nombre];
  if (crudo === undefined || String(crudo).trim() === '') return defecto;
  const valor = Number(crudo);
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max} (recibido: "${crudo}").`);
  }
  return valor;
};

/** @returns {{ max: number, ventanaDias: number, bloqueoHoras: number }} */
const leerConfigSancion = (env = process.env) => ({
  max: leerEntero(env, 'SANCION_FINALIZAR_MAX'),
  ventanaDias: leerEntero(env, 'SANCION_VENTANA_DIAS'),
  bloqueoHoras: leerEntero(env, 'SANCION_BLOQUEO_HORAS'),
});

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;

/**
 * Cuántas finalizaciones propias lleva en la ventana y, si llegó al tope, hasta cuándo no
 * puede pedir (función pura).
 * @param {string[]} fechas - `finalizado_en` de sus viajes con finalizado_por = 'pasajero'.
 * @returns {{ llevas: number, bloqueadoHasta: number | null }}
 */
const evaluarSancion = (fechas, ahora, config) => {
  const desde = ahora - config.ventanaDias * DIA_MS;
  const enVentana = (fechas || []).map((f) => Date.parse(f)).filter((t) => Number.isFinite(t) && t >= desde && t <= ahora);
  const llevas = enVentana.length;
  if (llevas < config.max) return { llevas, bloqueadoHasta: null };
  const hasta = Math.max(...enVentana) + config.bloqueoHoras * HORA_MS;
  return { llevas, bloqueadoHasta: hasta > ahora ? hasta : null };
};

/**
 * Lee las finalizaciones propias del pasajero con su cliente (RLS: las suyas) y las evalúa.
 * Si la lectura falla, no bloquea (se registra): es preferible dejar pedir un viaje que
 * dejar sin servicio a alguien por un fallo de lectura.
 */
const revisarSancion = async (db, pasajeroId, config, ahora = Date.now()) => {
  try {
    const { data, error } = await db
      .from('viajes')
      .select('finalizado_en')
      .eq('pasajero_id', pasajeroId)
      .eq('finalizado_por', 'pasajero')
      .gte('finalizado_en', new Date(ahora - config.ventanaDias * DIA_MS).toISOString());
    if (error) throw new Error(error.message);
    return evaluarSancion((data || []).map((v) => v.finalizado_en), ahora, config);
  } catch (err) {
    console.error(`[sancion] No se pudo revisar al pasajero ${pasajeroId}: ${err.message}`);
    return { llevas: 0, bloqueadoHasta: null };
  }
};

/** "18:30", hora de Ecuador continental. */
const horaLocal = (ms) => new Date(ms).toLocaleTimeString('es-EC', {
  timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit', hour12: false,
});

module.exports = { LIMITES, leerConfigSancion, evaluarSancion, revisarSancion, horaLocal };

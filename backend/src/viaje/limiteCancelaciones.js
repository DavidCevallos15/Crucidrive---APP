// @ts-check
/**
 * Tope de cancelaciones del pasajero (007, criterios 12 y 13; plan P8; E2). Con N cancelaciones
 * propias en la ventana, no puede pedir durante el bloqueo, contado desde la última. Cuentan las
 * que hace mientras busca y después de aceptado; las del conductor no. Mismo formato que la
 * sanción del 005: un valor inválido en el entorno detiene el arranque del servidor.
 */
const { leerEntero } = require('./sancion');

// nombre de la variable → [mínimo, máximo, por defecto]
const LIMITES = {
  CANCELACIONES_MAX: [1, 50, 5],
  CANCELACIONES_VENTANA_MIN: [5, 1440, 60],
  CANCELACIONES_BLOQUEO_MIN: [5, 1440, 30],
};

/**
 * @typedef {{ max: number, ventanaMin: number, bloqueoMin: number }} ConfigCancelaciones
 */

/** @returns {ConfigCancelaciones} */
const leerConfigCancelaciones = (env = process.env) => ({
  max: leerEntero(env, 'CANCELACIONES_MAX', LIMITES),
  ventanaMin: leerEntero(env, 'CANCELACIONES_VENTANA_MIN', LIMITES),
  bloqueoMin: leerEntero(env, 'CANCELACIONES_BLOQUEO_MIN', LIMITES),
});

const MINUTO_MS = 60 * 1000;

/**
 * Cuántas cancelaciones propias lleva en la ventana y, si llegó al tope, hasta cuándo no puede
 * pedir (función pura).
 * @param {Array<string | null | undefined>} fechas `finalizado_en` de sus viajes cancelados por él
 * @param {number} ahora
 * @param {ConfigCancelaciones} config
 * @returns {{ llevas: number, bloqueadoHasta: number | null }}
 */
const evaluarCancelaciones = (fechas, ahora, config) => {
  const desde = ahora - config.ventanaMin * MINUTO_MS;
  const enVentana = (fechas || [])
    .map((f) => Date.parse(String(f)))
    .filter((t) => Number.isFinite(t) && t >= desde && t <= ahora);
  const llevas = enVentana.length;
  if (llevas < config.max) return { llevas, bloqueadoHasta: null };
  const hasta = Math.max(...enVentana) + config.bloqueoMin * MINUTO_MS;
  return { llevas, bloqueadoHasta: hasta > ahora ? hasta : null };
};

/**
 * Lee las cancelaciones propias del pasajero con su cliente (RLS: solo las suyas) y las evalúa.
 * `cancelar_viaje` (0017) siempre deja `cancelado_por`, también por la ruta heredada
 * `PATCH /:id/estado`. Si la lectura falla, no bloquea (se registra), igual que la sanción.
 * @param {any} db cliente con el JWT del pasajero
 * @param {string} pasajeroId
 * @param {ConfigCancelaciones} config
 * @param {number} [ahora]
 */
const revisarCancelaciones = async (db, pasajeroId, config, ahora = Date.now()) => {
  try {
    const { data, error } = await db
      .from('viajes')
      .select('finalizado_en')
      .eq('pasajero_id', pasajeroId)
      .eq('estado', 'cancelado')
      .eq('cancelado_por', 'pasajero')
      .gte('finalizado_en', new Date(ahora - config.ventanaMin * MINUTO_MS).toISOString());
    if (error) throw new Error(error.message);
    return evaluarCancelaciones((data || []).map((/** @type {{ finalizado_en: string }} */ v) => v.finalizado_en), ahora, config);
  } catch (err) {
    console.error(`[cancelaciones] No se pudo revisar al pasajero ${pasajeroId}: ${/** @type {Error} */ (err).message}`);
    return { llevas: 0, bloqueadoHasta: null };
  }
};

module.exports = { LIMITES, leerConfigCancelaciones, evaluarCancelaciones, revisarCancelaciones };

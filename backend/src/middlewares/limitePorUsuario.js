// @ts-check
/**
 * Límites por usuario (007, criterios 17 y 18; plan P9; E6). Van después de authMiddleware: la
 * clave es `req.user.id`, no la IP. Detrás del CGNAT de las operadoras muchos usuarios comparten
 * IP, y el límite por IP de app.js tiene que ser holgado; este frena a una sola cuenta.
 * Cada 429 lleva Retry-After (lo pone express-rate-limit con standardHeaders).
 */
const { rateLimit } = require('express-rate-limit');
const { leerEntero } = require('../viaje/sancion');

const VENTANA_MS = 15 * 60 * 1000;

// nombre de la variable → [mínimo, máximo, por defecto], por usuario cada 15 min.
const LIMITES = {
  RATE_LIMIT_USUARIO_PEDIR: [1, 1000, 10],
  RATE_LIMIT_USUARIO_CANCELAR: [1, 1000, 10],
  RATE_LIMIT_USUARIO_ACEPTAR: [1, 1000, 30],
  // Recargas y ajustes del administrador (020): frena errores en bucle o una sesión robada.
  RATE_LIMIT_USUARIO_ACREDITAR: [1, 1000, 30],
};

/** @returns {{ pedir: number, cancelar: number, aceptar: number, acreditar: number }} */
const leerConfigLimites = (env = process.env) => ({
  pedir: leerEntero(env, 'RATE_LIMIT_USUARIO_PEDIR', LIMITES),
  cancelar: leerEntero(env, 'RATE_LIMIT_USUARIO_CANCELAR', LIMITES),
  aceptar: leerEntero(env, 'RATE_LIMIT_USUARIO_ACEPTAR', LIMITES),
  acreditar: leerEntero(env, 'RATE_LIMIT_USUARIO_ACREDITAR', LIMITES),
});

const MENSAJE = { status: 'error', message: 'Hiciste demasiadas solicitudes seguidas. Intenta de nuevo en unos minutos.' };

/**
 * @param {number} limit
 * @param {number} [windowMs]
 */
const crearLimite = (limit, windowMs = VENTANA_MS) => rateLimit({
  windowMs,
  limit,
  keyGenerator: (req) => /** @type {any} */ (req).user.id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: MENSAJE,
});

/**
 * Un limitador por acción; cada uno guarda su cuenta en memoria. `cancelar` es el mismo para
 * `POST /:id/cancelar` y para la ruta heredada `PATCH /:id/estado`.
 */
const crearLimitesPorUsuario = (env = process.env) => {
  const config = leerConfigLimites(env);
  return {
    pedir: crearLimite(config.pedir),
    cancelar: crearLimite(config.cancelar),
    aceptar: crearLimite(config.aceptar),
    acreditar: crearLimite(config.acreditar),
  };
};

module.exports = { LIMITES, VENTANA_MS, leerConfigLimites, crearLimite, crearLimitesPorUsuario };

/**
 * Instancia única del despachador (un solo proceso de backend; plan, riesgo "un solo proceso").
 * index.js la arranca; los controladores la usan para iniciar, cancelar y avisar aceptaciones.
 * Sin arrancar (por ejemplo en las pruebas de controladores) devuelve null y nadie despacha.
 */
const { crearDespachador } = require('./despachador');
const { conexiones } = require('./conexiones');
const { leerConfigDespacho } = require('./config');
const { getAdminClient } = require('../config/supabase');

let despachador = null;
let barrido = null;

/**
 * @param {import('socket.io').Server} io
 * @param {ReturnType<typeof leerConfigDespacho>} [config]
 */
const iniciarDespacho = async (io, config = leerConfigDespacho()) => {
  getAdminClient(); // falla al arrancar si falta SUPABASE_SERVICE_ROLE_KEY
  despachador = crearDespachador({ obtenerDb: getAdminClient, io, conexiones, config });
  await despachador.recuperar();
  barrido = setInterval(() => despachador.barrer(), config.barridoSeg * 1000);
  barrido.unref?.();
  return despachador;
};

const detenerDespacho = () => {
  clearInterval(barrido);
  despachador?.detener();
  despachador = null;
};

const obtenerDespachador = () => despachador;

module.exports = { iniciarDespacho, detenerDespacho, obtenerDespachador };

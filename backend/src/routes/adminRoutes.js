// @ts-check
const express = require('express');
const router = express.Router();
const {
  listarConductores, verConductor, aprobarConductor, rechazarConductor,
} = require('../controllers/adminController');
const { listarLugares, crearLugar, actualizarLugar } = require('../controllers/lugaresController');
const {
  verParametros, cambiarParametros, acreditar, creditosDeConductor, resumen,
} = require('../controllers/creditosController');
const { crearLimitesPorUsuario } = require('../middlewares/limitePorUsuario');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Solo administradores. Además, la BD aplica RLS: sin rol admin no ve ni modifica nada.
router.use(authMiddleware, roleMiddleware(['admin']));

const limite = crearLimitesPorUsuario();

router.get('/conductores', listarConductores);
router.get('/conductores/:id', verConductor);
router.post('/conductores/:id/aprobar', aprobarConductor);
router.post('/conductores/:id/rechazar', rechazarConductor);

// Catálogo de lugares (paso 003, criterio 24): crear, corregir u ocultar. No hay borrado.
router.get('/lugares', listarLugares);
router.post('/lugares', crearLugar);
router.patch('/lugares/:id', actualizarLugar);

// Créditos del conductor (020): parámetros, recargas y ajustes con comprobante, historial y resumen.
router.get('/creditos/parametros', verParametros);
router.patch('/creditos/parametros', limite.acreditar, cambiarParametros);
router.get('/creditos/resumen', resumen);
router.get('/conductores/:id/creditos', creditosDeConductor);
router.post('/conductores/:id/creditos', limite.acreditar, acreditar);

module.exports = router;

const express = require('express');
const router = express.Router();
const { registrarDispositivo, olvidarDispositivo } = require('../controllers/dispositivoController');
const authMiddleware = require('../middlewares/authMiddleware');

// Teléfonos para avisos (paso 004, plan P3). Cualquier usuario con sesión: pasajeros y conductores.
router.post('/', authMiddleware, registrarDispositivo);
router.delete('/:token', authMiddleware, olvidarDispositivo);

module.exports = router;

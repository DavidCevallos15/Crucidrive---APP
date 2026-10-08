const express = require('express');
const router = express.Router();
const { enviarVerificacion, obtenerMiVerificacion } = require('../controllers/conductorController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Solo conductores: enviar o corregir su solicitud de verificación y ver su estado.
router.post('/verificacion', authMiddleware, roleMiddleware(['conductor']), enviarVerificacion);
router.get('/verificacion', authMiddleware, roleMiddleware(['conductor']), obtenerMiVerificacion);

module.exports = router;

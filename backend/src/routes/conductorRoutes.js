const express = require('express');
const router = express.Router();
const { enviarVerificacion, obtenerMiVerificacion, cambiarDisponibilidad } = require('../controllers/conductorController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Solo conductores: enviar o corregir su solicitud de verificación y ver su estado.
router.post('/verificacion', authMiddleware, roleMiddleware(['conductor']), enviarVerificacion);
router.get('/verificacion', authMiddleware, roleMiddleware(['conductor']), obtenerMiVerificacion);

// Ponerse disponible o dejar de estarlo (paso 003). La ubicación va por socket (update_location).
router.patch('/disponibilidad', authMiddleware, roleMiddleware(['conductor']), cambiarDisponibilidad);

module.exports = router;

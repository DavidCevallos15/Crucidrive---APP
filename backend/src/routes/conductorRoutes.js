const express = require('express');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();
const { enviarVerificacion, obtenerMiVerificacion, cambiarDisponibilidad, actualizarUbicacion } = require('../controllers/conductorController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Solo conductores: enviar o corregir su solicitud de verificación y ver su estado.
router.post('/verificacion', authMiddleware, roleMiddleware(['conductor']), enviarVerificacion);
router.get('/verificacion', authMiddleware, roleMiddleware(['conductor']), obtenerMiVerificacion);

// Ponerse disponible o dejar de estarlo (paso 003). La ubicación va por socket (update_location).
router.patch('/disponibilidad', authMiddleware, roleMiddleware(['conductor']), cambiarDisponibilidad);

// Respaldo REST de update_location (paso 004, plan P11). Límite por conductor, no por IP:
// detrás del CGNAT de las operadoras muchos conductores comparten IP. La app envía como mucho
// cada 5 s; 2 envíos cada 5 s dan margen a un reintento.
const limiteUbicacion = rateLimit({
  windowMs: 5000,
  limit: 2,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { status: 'error', message: 'Envías tu ubicación demasiado seguido.' },
});
router.post('/ubicacion', authMiddleware, roleMiddleware(['conductor']), limiteUbicacion, actualizarUbicacion);

module.exports = router;

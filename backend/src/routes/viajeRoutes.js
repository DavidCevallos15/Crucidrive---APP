const express = require('express');
const router = express.Router();
const { solicitarViaje, aceptarViaje, cambiarEstadoViaje } = require('../controllers/viajeController');
const {
  marcarLlegada, iniciarViaje, terminarViaje, cancelarViaje, confirmarLlegada, calificarViaje,
} = require('../controllers/viajeEnCursoController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Crear solicitud de viaje (Acceso: solo Pasajeros)
router.post('/solicitar', authMiddleware, roleMiddleware(['pasajero']), solicitarViaje);

// Aceptar viaje solicitado (Acceso: solo Conductores)
router.post('/aceptar', authMiddleware, roleMiddleware(['conductor']), aceptarViaje);

// Ruta anterior al 005: lleva cada estado a su paso (la BD valida quién y en qué orden).
router.patch('/:id/estado', authMiddleware, cambiarEstadoViaje);

// Viaje en curso (paso 005). La BD comprueba en cada función a quién le toca el paso.
router.post('/:id/llegada', authMiddleware, roleMiddleware(['conductor']), marcarLlegada);
router.post('/:id/iniciar', authMiddleware, roleMiddleware(['conductor']), iniciarViaje);
router.post('/:id/terminar', authMiddleware, terminarViaje);
router.post('/:id/cancelar', authMiddleware, cancelarViaje);
router.post('/:id/confirmar', authMiddleware, roleMiddleware(['pasajero']), confirmarLlegada);
router.post('/:id/calificar', authMiddleware, roleMiddleware(['pasajero']), calificarViaje);

module.exports = router;

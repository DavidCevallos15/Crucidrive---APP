const express = require('express');
const router = express.Router();
const { solicitarViaje, aceptarViaje, cambiarEstadoViaje } = require('../controllers/viajeController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Crear solicitud de viaje (Acceso: solo Pasajeros)
router.post('/solicitar', authMiddleware, roleMiddleware(['pasajero']), solicitarViaje);

// Aceptar viaje solicitado (Acceso: solo Conductores)
router.post('/aceptar', authMiddleware, roleMiddleware(['conductor']), aceptarViaje);

// Cambiar estado de un viaje (en_curso, finalizado, cancelado) (Acceso: Pasajero o Conductor involucrado)
router.patch('/:id/estado', authMiddleware, cambiarEstadoViaje);

module.exports = router;

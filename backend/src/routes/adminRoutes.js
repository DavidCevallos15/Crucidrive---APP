const express = require('express');
const router = express.Router();
const {
  listarConductores, verConductor, aprobarConductor, rechazarConductor,
} = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Solo administradores. Además, la BD aplica RLS: sin rol admin no ve ni modifica nada.
router.use(authMiddleware, roleMiddleware(['admin']));

router.get('/conductores', listarConductores);
router.get('/conductores/:id', verConductor);
router.post('/conductores/:id/aprobar', aprobarConductor);
router.post('/conductores/:id/rechazar', rechazarConductor);

module.exports = router;

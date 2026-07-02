const express = require('express');
const router = express.Router();
const { registerProfile } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Ruta protegida para completar/crear el perfil de usuario tras el registro de la cuenta
router.post('/registro', authMiddleware, registerProfile);

module.exports = router;

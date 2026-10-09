const express = require('express');
const router = express.Router();
const { registerProfile, aceptarConsentimiento } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Ruta protegida para completar/crear el perfil de usuario tras el registro de la cuenta
router.post('/registro', authMiddleware, registerProfile);

// Volver a aceptar el consentimiento cuando cambia de versión (paso 004, criterio 5)
router.post('/consentimiento', authMiddleware, aceptarConsentimiento);

module.exports = router;

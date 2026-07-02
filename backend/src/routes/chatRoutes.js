const express = require('express');
const router = express.Router();
const { getHistorialChat } = require('../controllers/chatController');
const authMiddleware = require('../middlewares/authMiddleware');

// Obtener el historial de mensajes de un chat específico (Acceso: solo miembros del chat)
router.get('/:threadId/mensajes', authMiddleware, getHistorialChat);

module.exports = router;

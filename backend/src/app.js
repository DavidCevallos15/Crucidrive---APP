const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { errorResponse } = require('./utils/response');

const authRoutes = require('./routes/authRoutes');
const viajeRoutes = require('./routes/viajeRoutes');
const chatRoutes = require('./routes/chatRoutes');

const DEFAULT_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

/**
 * Orígenes permitidos para CORS (navegador/PWA). Las apps nativas no envían
 * cabecera Origin, así que esta lista no las afecta.
 * @returns {string[]}
 */
const getAllowedOrigins = () =>
  process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Crea la app Express (sin escuchar puerto) para poder probarla aislada.
 * @returns {import('express').Express}
 */
const createApp = () => {
  const app = express();

  // Detrás de un proxy (Render, Railway…) el IP real llega en X-Forwarded-For.
  // Sin esto el rate limit contaría a todos como un solo cliente.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', toInt(process.env.TRUST_PROXY, 1));
  }

  app.use(helmet());
  app.use(cors({ origin: getAllowedOrigins() }));
  app.use(express.json({ limit: '100kb' }));

  // Las operadoras móviles comparten IP pública entre muchos usuarios (CGNAT):
  // límites holgados y configurables para no bloquear a toda una parroquia.
  const ventanaMs = 15 * 60 * 1000;
  const mensajeLimite = { status: 'error', message: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' };

  app.use('/api', rateLimit({
    windowMs: ventanaMs,
    limit: toInt(process.env.RATE_LIMIT_API, 600),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: mensajeLimite,
  }));

  app.use('/api/auth', rateLimit({
    windowMs: ventanaMs,
    limit: toInt(process.env.RATE_LIMIT_AUTH, 60),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: mensajeLimite,
  }));

  app.use('/api/auth', authRoutes);
  app.use('/api/viajes', viajeRoutes);
  app.use('/api/chats', chatRoutes);

  // Health check: no consulta Supabase ni expone detalles internos.
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'crucidrive-backend', timestamp: new Date().toISOString() });
  });

  app.use((req, res) => {
    errorResponse(res, 404, `Ruta no encontrada: ${req.method} ${req.path}`);
  });

  // JSON malformado, payload demasiado grande u otro error no capturado.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
    const mensaje = status === 400 ? 'Cuerpo de la petición inválido.'
      : status === 413 ? 'Cuerpo de la petición demasiado grande.'
        : 'Error interno del servidor.';
    errorResponse(res, status, mensaje, err.message);
  });

  return app;
};

module.exports = { createApp, getAllowedOrigins };

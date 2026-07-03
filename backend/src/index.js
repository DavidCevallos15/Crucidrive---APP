const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { supabase } = require('./config/supabase');
const { errorResponse } = require('./utils/response');

// Importar enrutadores REST
const authRoutes = require('./routes/authRoutes');
const viajeRoutes = require('./routes/viajeRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Importar inicializador de Sockets
const initSocketHandler = require('./sockets/socketHandler');

// Configurar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Orígenes permitidos para CORS (restringir en producción vía ALLOWED_ORIGINS)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

// Crear servidor HTTP nativo acoplado a Express
const server = http.createServer(app);

// Inicializar el servidor de Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH']
  }
});

// Middlewares globales de seguridad
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});
app.use(globalLimiter);

// Rate limiting estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.' }
});
app.use('/api/auth', authLimiter);

// Registrar rutas REST de la API
app.use('/api/auth', authRoutes);
app.use('/api/viajes', viajeRoutes);
app.use('/api/chats', chatRoutes);

// Endpoint base para verificar el estado de la API y la conexión a Supabase
app.get('/', async (req, res) => {
  try {
    // Verificar la sesión para validar la correcta conexión con la clave anónima de Supabase
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return errorResponse(res, 500, 'Error en la conexión con Supabase', error.message);
    }

    res.json({
      status: 'ok',
      message: 'Servidor Express de CruciDrive activo y conectado a Supabase correctamente.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    errorResponse(res, 500, 'Error interno en el servidor backend', err.message);
  }
});

// Inicializar los eventos y namespaces de Sockets en tiempo real
initSocketHandler(io);

// Iniciar la escucha del servidor HTTP (Express + Socket.io) en el puerto especificado
server.listen(port, () => {
  console.log(`=================================================`);
  console.log(` Servidor de CruciDrive (REST + Sockets) corriendo`);
  console.log(` Puerto: ${port}`);
  console.log(` URL local: http://localhost:${port}`);
  console.log(`=================================================`);
});


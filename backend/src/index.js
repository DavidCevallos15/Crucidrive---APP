const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { supabase } = require('./config/supabase');

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

// Crear servidor HTTP nativo acoplado a Express
const server = http.createServer(app);

// Inicializar el servidor de Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Permitir conexiones desde cualquier origen en desarrollo
    methods: ['GET', 'POST', 'PATCH']
  }
});

// Middlewares globales
app.use(cors());
app.use(express.json());

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
      return res.status(500).json({
        status: 'error',
        message: 'Error en la conexión con Supabase',
        details: error.message
      });
    }

    res.json({
      status: 'ok',
      message: 'Servidor Express de CruciDrive activo y conectado a Supabase correctamente.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Error interno en el servidor backend',
      details: err.message
    });
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


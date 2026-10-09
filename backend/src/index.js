const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const { createApp, getAllowedOrigins } = require('./app');
const initSocketHandler = require('./sockets/socketHandler');
const { leerConfigDespacho } = require('./despacho/config');
const { iniciarDespacho } = require('./despacho');

dotenv.config();

// Parámetros del despacho inválidos: mejor no arrancar (plan R21).
let configDespacho;
try {
  configDespacho = leerConfigDespacho();
} catch (err) {
  console.error(`[CruciDrive] Configuración del despacho inválida: ${err.message}`);
  process.exit(1);
}

const port = process.env.PORT || 3000;
const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PATCH']
  },
  maxHttpBufferSize: 1e5
});

initSocketHandler(io);

// El despacho usa la clave de servicio: sin ella el servidor no arranca (nadie recibiría viajes).
iniciarDespacho(io, configDespacho)
  .then(() => {
    server.listen(port, () => {
      console.log(`[CruciDrive] REST + Socket.io escuchando en el puerto ${port}`);
    });
  })
  .catch((err) => {
    console.error(`[CruciDrive] No se pudo iniciar el despacho: ${err.message}`);
    process.exit(1);
  });

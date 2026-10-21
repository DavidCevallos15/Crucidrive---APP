const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const { createApp, getAllowedOrigins } = require('./app');
const initSocketHandler = require('./sockets/socketHandler');
const { leerConfigDespacho } = require('./despacho/config');
const { leerConfigUbicacion, validarConDespacho } = require('./ubicacion/config');
const { iniciarDespacho, detenerDespacho } = require('./despacho');
const { crearApagado } = require('./apagado');

dotenv.config();

// Parámetros del despacho inválidos: mejor no arrancar (plan R21).
let configDespacho;
try {
  configDespacho = leerConfigDespacho();
  // Frecuencia de ubicación (paso 004, D-13): debe caber en la ventana de frescura del despacho.
  validarConDespacho(leerConfigUbicacion(), configDespacho);
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
// Para que los controladores REST reenvíen por socket (paso 004: ubicación por REST, P11).
app.set('io', io);

// El despacho usa la clave de servicio: sin ella el servidor no arranca (nadie recibiría viajes).
iniciarDespacho(io, configDespacho)
  .then(() => {
    server.listen(port, () => {
      console.log(`[CruciDrive] REST + Socket.io escuchando en el puerto ${port}`);
    });
    // Reinicio o apagado de la VM (systemd manda SIGTERM): cierre ordenado (008).
    const apagar = crearApagado({ server, io, detenerDespacho });
    process.on('SIGTERM', () => apagar('SIGTERM'));
    process.on('SIGINT', () => apagar('SIGINT'));
  })
  .catch((err) => {
    console.error(`[CruciDrive] No se pudo iniciar el despacho: ${err.message}`);
    process.exit(1);
  });

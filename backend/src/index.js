const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const { createApp, getAllowedOrigins } = require('./app');
const initSocketHandler = require('./sockets/socketHandler');

dotenv.config();

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

server.listen(port, () => {
  console.log(`[CruciDrive] REST + Socket.io escuchando en el puerto ${port}`);
});

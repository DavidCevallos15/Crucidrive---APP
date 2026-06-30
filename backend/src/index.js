const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { supabase } = require('./config/supabase');

// Configurar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

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

// Iniciar la escucha del servidor en el puerto especificado
app.listen(port, () => {
  console.log(`=================================================`);
  console.log(` Servidor de CruciDrive corriendo en el puerto: ${port}`);
  console.log(` URL local: http://localhost:${port}`);
  console.log(`=================================================`);
});

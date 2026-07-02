const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[CruciDrive] Faltan las variables de entorno de Supabase (SUPABASE_URL, SUPABASE_ANON_KEY). El backend no se iniciara hasta configurarlas.'
  );
}

// Crear el cliente de Supabase (null si no esta configurado)
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

module.exports = { supabase };

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el archivo .env');
}

const SERVER_AUTH_OPTIONS = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/**
 * Cliente base con la clave anon. Solo se usa para validar tokens
 * (auth.getUser). NUNCA para leer o escribir tablas: no lleva la
 * identidad del usuario y RLS lo bloquearía.
 */
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: SERVER_AUTH_OPTIONS });

/**
 * Crea un cliente que actúa en nombre del usuario: envía su JWT en cada
 * petición, así las políticas RLS ven auth.uid() (spec 001, criterio 7).
 *
 * @param {string} accessToken - JWT de Supabase Auth del usuario.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
const createUserClient = (accessToken) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: SERVER_AUTH_OPTIONS,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

let adminClient = null;

/**
 * Cliente con la clave de servicio (ignora RLS). Solo para tareas del
 * sistema en el servidor (p. ej. despacho, paso 003). Nunca exponerlo al
 * cliente ni usarlo para operaciones que el usuario puede hacer por sí mismo.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
const getAdminClient = () => {
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.');
  }
  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: SERVER_AUTH_OPTIONS });
  }
  return adminClient;
};

module.exports = { supabase, createUserClient, getAdminClient };

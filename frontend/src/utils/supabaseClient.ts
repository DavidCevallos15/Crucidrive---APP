import { createClient } from '@supabase/supabase-js';
import { authStorage } from './authStorage';
import { SUPABASE_CONFIG } from '../constants/config';

/**
 * Cliente de Supabase configurado para React Native.
 *
 * La resolución de plataforma usa Keychain/Keystore en móvil, con migración de
 * sesiones previas, y almacenamiento del navegador en web.
 */
// Sin URL, createClient lanza al importar y la app se cierra sin explicación. Con un valor
// inválido arranca, y el layout raíz muestra qué variables faltan (variablesFaltantes).
const URL_FALTANTE = 'https://configuracion-faltante.invalid';

export const supabase = createClient(
  SUPABASE_CONFIG.url || URL_FALTANTE,
  SUPABASE_CONFIG.anonKey || 'configuracion-faltante',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

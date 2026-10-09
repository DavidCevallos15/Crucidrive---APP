import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_CONFIG } from '../constants/config';

/**
 * Cliente de Supabase configurado para React Native.
 *
 * Usa AsyncStorage como mecanismo de persistencia de sesión
 * en lugar de localStorage (no disponible en mobile).
 */
// Sin URL, createClient lanza al importar y la app se cierra sin explicación. Con un valor
// inválido arranca, y el layout raíz muestra qué variables faltan (variablesFaltantes).
const URL_FALTANTE = 'https://configuracion-faltante.invalid';

export const supabase = createClient(
  SUPABASE_CONFIG.url || URL_FALTANTE,
  SUPABASE_CONFIG.anonKey || 'configuracion-faltante',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

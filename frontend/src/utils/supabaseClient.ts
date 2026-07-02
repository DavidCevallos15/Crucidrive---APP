import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_CONFIG } from '../constants/config';

/**
 * Cliente de Supabase configurado para React Native.
 *
 * Usa AsyncStorage como mecanismo de persistencia de sesión
 * en lugar de localStorage (no disponible en mobile).
 */
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

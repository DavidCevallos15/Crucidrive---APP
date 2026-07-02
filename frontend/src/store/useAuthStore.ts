import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Perfil del usuario tal como se almacena en la tabla 'perfiles' de Supabase.
 */
export interface UserProfile {
  id: string;
  nombre: string;
  telefono: string;
  rol: 'pasajero' | 'conductor' | 'admin';
  estado_operativo?: 'disponible' | 'ocupado' | 'inactivo';
  calificacion?: number;
  avatar_url?: string;
}

/**
 * Estado de autenticación y perfil del usuario.
 */
interface AuthState {
  /** Sesión activa de Supabase */
  session: Session | null;
  /** Datos del usuario de Supabase Auth */
  user: User | null;
  /** Perfil extendido del usuario (tabla 'perfiles') */
  profile: UserProfile | null;
  /** Indica si se está cargando la sesión inicial */
  isLoading: boolean;
  /** Indica si se completó la verificación inicial de sesión */
  isInitialized: boolean;

  // ─── Acciones ──────────────────────────────────────────────
  /** Establece la sesión y el usuario tras el login */
  setSession: (session: Session | null) => void;
  /** Establece el perfil del usuario */
  setProfile: (profile: UserProfile | null) => void;
  /** Marca el store como cargado */
  setLoading: (loading: boolean) => void;
  /** Marca la inicialización como completada */
  setInitialized: (initialized: boolean) => void;
  /** Limpia toda la sesión (logout) */
  clearSession: () => void;
}

/**
 * Store global de autenticación usando Zustand.
 *
 * Gestiona la sesión de Supabase Auth, el perfil del usuario
 * y el estado de carga inicial.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),

  setProfile: (profile) => set({ profile }),

  setLoading: (isLoading) => set({ isLoading }),

  setInitialized: (isInitialized) => set({ isInitialized }),

  clearSession: () =>
    set({
      session: null,
      user: null,
      profile: null,
      isLoading: false,
    }),
}));

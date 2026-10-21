import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { EstadoVerificacion } from '../utils/routing';
import { useRideStore } from './useRideStore';
import { useLocationStore } from './useLocationStore';

function limpiarDatosDeCuenta() {
  useRideStore.setState({ activeRide: null, ultimaSolicitud: null, isRequesting: false });
  useLocationStore.getState().clearNearbyDrivers();
}

/**
 * Perfil del usuario tal como se almacena en la tabla 'perfiles' de Supabase.
 */
export interface UserProfile {
  id: string;
  nombre: string;
  telefono: string;
  rol: 'pasajero' | 'conductor' | 'admin';
  activo?: boolean;
  // Aún no existen como columnas de 'perfiles'; las pantallas de perfil y consola los
  // leen de forma opcional. Se definirán con las calificaciones (después del piloto).
  estado_operativo?: 'disponible' | 'ocupado' | 'inactivo';
  calificacion?: number;
  avatar_url?: string;
}

/**
 * Estado de la verificación de un conductor (solo aplica al rol conductor).
 */
export interface VerificationInfo {
  estado: EstadoVerificacion;
  motivo_rechazo?: string | null;
}

/**
 * Estado de autenticación y perfil del usuario.
 */
interface AuthState {
  /** Cambia al sustituir o cerrar la cuenta, incluso si se vuelve a la misma cuenta. */
  authGeneration: number;
  /** Sesión activa de Supabase */
  session: Session | null;
  /** Datos del usuario de Supabase Auth */
  user: User | null;
  /** Perfil extendido del usuario (tabla 'perfiles'); null si aún no completó su registro */
  profile: UserProfile | null;
  /** true cuando ya se intentó cargar el perfil (distingue "cargando" de "no tiene perfil") */
  profileChecked: boolean;
  /** Verificación del conductor; null si no es conductor o aún no se consulta */
  verification: VerificationInfo | null;
  /** true cuando ya se consultó la verificación del conductor */
  verificationChecked: boolean;
  /** Indica si se está cargando la sesión inicial */
  isLoading: boolean;
  /** Indica si se completó la verificación inicial de sesión */
  isInitialized: boolean;
  isSigningOut: boolean;
  logoutError: string | null;
  beginSignOut: () => boolean;
  endSignOut: (error: string | null) => void;
  /** Cierra el aviso de un cierre de sesión fallido y vuelve a la app con la sesión intacta. */
  descartarErrorSalida: () => void;

  // ─── Acciones ──────────────────────────────────────────────
  /** Establece la sesión y el usuario tras el login */
  setSession: (session: Session | null) => void;
  /** Establece el perfil del usuario y marca que ya se consultó */
  setProfile: (profile: UserProfile | null) => void;
  /** Establece la verificación del conductor y marca que ya se consultó */
  setVerification: (verification: VerificationInfo | null) => void;
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
 * Gestiona la sesión de Supabase Auth, el perfil del usuario,
 * la verificación del conductor y el estado de carga inicial.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  authGeneration: 0,
  session: null,
  user: null,
  profile: null,
  profileChecked: false,
  verification: null,
  verificationChecked: false,
  isLoading: true,
  isInitialized: false,
  isSigningOut: false,
  logoutError: null,

  setSession: (session) => {
    if (get().user?.id !== session?.user?.id) limpiarDatosDeCuenta();
    set((state) => ({
      session,
      user: session?.user ?? null,
      // Si cambia de cuenta, nunca mostrar ni reutilizar permisos del perfil anterior.
      ...(state.user?.id !== session?.user?.id ? {
        authGeneration: state.authGeneration + 1,
        profile: null,
        profileChecked: false,
        verification: null,
        verificationChecked: false,
        logoutError: null,
      } : {}),
    }));
  },

  setProfile: (profile) => set({ profile, profileChecked: true }),

  setVerification: (verification) => set({ verification, verificationChecked: true }),

  setLoading: (isLoading) => set({ isLoading }),

  setInitialized: (isInitialized) => set({ isInitialized }),

  // El guard es global: menú y perfil no pueden lanzar dos salidas simultáneas.
  beginSignOut: () => {
    let iniciado = false;
    set((state) => {
      if (state.isSigningOut) return state;
      iniciado = true;
      return { isSigningOut: true, logoutError: null, isLoading: true };
    });
    return iniciado;
  },
  endSignOut: (logoutError) => set({ isSigningOut: false, isLoading: false, logoutError }),
  descartarErrorSalida: () => set({ logoutError: null }),

  clearSession: () => {
    limpiarDatosDeCuenta();
    set((state) => ({
      authGeneration: state.authGeneration + 1,
      session: null,
      user: null,
      profile: null,
      profileChecked: false,
      verification: null,
      verificationChecked: false,
      isLoading: false,
      logoutError: null,
    }));
  },
}));

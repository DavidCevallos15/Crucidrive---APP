import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { API_CONFIG } from '../constants/config';
import type { UserProfile } from '../store/useAuthStore';

/**
 * Hook para la autenticación con Supabase Auth (Phone OTP).
 *
 * Gestiona el flujo completo: envío de OTP por SMS, verificación del código,
 * obtención del perfil del usuario y cierre de sesión.
 */
export const useSupabaseAuth = () => {
  const {
    session,
    user,
    profile,
    isLoading,
    isInitialized,
    setSession,
    setProfile,
    setLoading,
    setInitialized,
    clearSession,
  } = useAuthStore();

  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // ─── Inicialización: escuchar cambios de sesión ────────────
  useEffect(() => {
    // Obtener sesión actual al montar
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
      } catch (error) {
        console.error('[Auth] Error al inicializar sesión:', error);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initSession();

    // Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);

        if (event === 'SIGNED_IN' && newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          clearSession();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── Obtener perfil del usuario desde la tabla 'perfiles' ──
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, telefono, rol, estado_operativo, calificacion, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[Auth] Perfil no encontrado, puede requerir registro:', error.message);
        return null;
      }

      setProfile(data as UserProfile);
      return data as UserProfile;
    } catch (err) {
      console.error('[Auth] Error al obtener perfil:', err);
      return null;
    }
  }, [setProfile]);

  // ─── Enviar OTP por SMS ────────────────────────────────────
  /**
   * Envía un código OTP al número de teléfono indicado.
   * @param phone - Número de teléfono con prefijo internacional (ej: +593991234567)
   */
  const sendOtp = useCallback(async (phone: string): Promise<boolean> => {
    try {
      setAuthError(null);
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }

      setOtpSent(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al enviar el código SMS.';
      setAuthError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  // ─── Verificar código OTP ─────────────────────────────────
  /**
   * Verifica el código OTP ingresado por el usuario.
   * @param phone - Número de teléfono usado para enviar el OTP
   * @param code - Código de 6 dígitos recibido por SMS
   */
  const verifyOtp = useCallback(async (phone: string, code: string): Promise<boolean> => {
    try {
      setAuthError(null);
      setLoading(true);

      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        setAuthError(error.message);
        return false;
      }

      if (data.session) {
        setSession(data.session);
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al verificar el código.';
      setAuthError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [setSession, setLoading]);

  // ─── Registrar perfil en el backend ───────────────────────
  /**
   * Registra/actualiza el perfil del usuario en el backend.
   * @param profileData - Datos del perfil (nombre, rol)
   */
  const registerProfile = useCallback(async (
    profileData: { nombre: string; rol: 'pasajero' | 'conductor' }
  ): Promise<boolean> => {
    try {
      setAuthError(null);

      const token = session?.access_token;
      if (!token) {
        setAuthError('No hay sesión activa.');
        return false;
      }

      const response = await fetch(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.auth.register}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profileData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        setAuthError(errorData.message || 'Error al registrar el perfil.');
        return false;
      }

      // Recargar el perfil tras el registro
      if (user) {
        await fetchProfile(user.id);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de red al registrar perfil.';
      setAuthError(message);
      return false;
    }
  }, [session, user, fetchProfile]);

  // ─── Cerrar sesión ─────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      clearSession();
    } catch (err) {
      console.error('[Auth] Error al cerrar sesión:', err);
    }
  }, [clearSession]);

  return {
    // Estado
    session,
    user,
    profile,
    isLoading,
    isInitialized,
    otpSent,
    authError,

    // Acciones
    sendOtp,
    verifyOtp,
    registerProfile,
    signOut,
    fetchProfile,
    setAuthError,
    setOtpSent,
  };
};

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import type { UserProfile, VerificationInfo } from '../store/useAuthStore';
import { API_CONFIG } from '../constants/config';
import { authFetch } from '../utils/authFetch';
import { normalizarEmail } from '../utils/validators';
import { mensajeDeAuth } from '../utils/mensajesAuth';
import { registroAvisos } from '../servicios/avisos';
import { detenerSeguimientoFondo } from '../tareas/ubicacionFondo';
import { captureAccountScope } from '../utils/accountScope';
import { closeAccountSession } from '../utils/closeAccountSession';

/** Resultado de una acción de cuenta: ok, o un mensaje listo para mostrar. */
export interface ResultadoAccion {
  ok: boolean;
  error?: string;
  /** Solo al crear cuenta: Supabase pide confirmar el correo antes de iniciar sesión. */
  requiereConfirmarCorreo?: boolean;
}


/**
 * Hook de autenticación con Supabase Auth (correo y contraseña, spec 002).
 *
 * Gestiona sesión, perfil, verificación del conductor y cierre de sesión. El perfil
 * se crea aparte (completeProfile) porque el correo puede requerir confirmación
 * antes de que exista una sesión.
 *
 * @param opciones.bootstrap - true SOLO en el layout raíz: restaura la sesión guardada y
 *   escucha sus cambios. El resto de pantallas usan el hook sin esto (evita suscripciones duplicadas).
 */
export const useSupabaseAuth = ({ bootstrap = false }: { bootstrap?: boolean } = {}) => {
  const {
    session,
    user,
    profile,
    verification,
    profileChecked,
    verificationChecked,
    isLoading,
    isInitialized,
    setSession,
    setProfile,
    setVerification,
    setLoading,
    setInitialized,
    clearSession,
  } = useAuthStore();

  const [authError, setAuthError] = useState<string | null>(null);

  // ─── Perfil: tabla 'perfiles' (columnas reales) ───────────
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (scope.userId !== userId || !scope.isCurrent()) return null;
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, nombre, telefono, rol, activo')
        .eq('id', userId)
        .maybeSingle();

      if (!scope.isCurrent()) return null;

      if (error) {
        console.warn('[Auth] No se pudo leer el perfil:', error.message);
        setProfile(null);
        return null;
      }

      setProfile((data as UserProfile | null) ?? null);
      return (data as UserProfile | null) ?? null;
    } catch (err) {
      if (!scope.isCurrent()) return null;
      console.error('[Auth] Error al obtener perfil:', err);
      setProfile(null);
      return null;
    }
  }, [setProfile]);

  // ─── Verificación del conductor (backend) ─────────────────
  const fetchVerification = useCallback(async (): Promise<VerificationInfo | null> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return null;
    try {
      const response = await authFetch(API_CONFIG.endpoints.driver.verification);
      if (!scope.isCurrent()) return null;
      if (!response.ok) {
        setVerification(null);
        return null;
      }
      const body = await response.json();
      if (!scope.isCurrent()) return null;
      const info = body.data as VerificationInfo;
      setVerification(info);
      return info;
    } catch (err) {
      if (!scope.isCurrent()) return null;
      console.error('[Auth] Error al consultar la verificación:', err);
      setVerification(null);
      return null;
    }
  }, [setVerification]);

  // ─── Inicialización: sesión guardada y cambios de sesión ───
  useEffect(() => {
    if (!bootstrap) return undefined;

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

  // Un conductor con perfil consulta su verificación (decide a qué pantalla va)
  useEffect(() => {
    if (!bootstrap) return;
    if (session && profile?.rol === 'conductor' && !verificationChecked) {
      fetchVerification();
    }
  }, [session, profile, verificationChecked, fetchVerification]);

  // Con perfil, el teléfono se registra para avisos de esta cuenta (paso 004, criterio 11).
  // Sin perfil no: la BD exige que el usuario exista en 'perfiles'.
  useEffect(() => {
    if (!bootstrap) return;
    const usuarioId = session?.user?.id;
    if (usuarioId && profile?.id === usuarioId) {
      registroAvisos.registrar(usuarioId);
    }
  }, [session?.user?.id, profile?.id]);

  // ─── Crear cuenta ─────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string): Promise<ResultadoAccion> => {
    setAuthError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: normalizarEmail(email), password });
      if (error) {
        // Al log (adb logcat en el APK): el usuario solo ve el mensaje traducido.
        console.warn('[Auth] Supabase Auth respondió con error:', error.name, error.status, error.message);
        const mensaje = mensajeDeAuth(error.message);
        setAuthError(mensaje);
        return { ok: false, error: mensaje };
      }
      // Con confirmación de correo activada no hay sesión hasta que el usuario confirma.
      return { ok: true, requiereConfirmarCorreo: !data.session };
    } catch (err) {
      const mensaje = mensajeDeAuth(err instanceof Error ? err.message : 'Error de conexión.');
      setAuthError(mensaje);
      return { ok: false, error: mensaje };
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  // ─── Iniciar sesión ───────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string): Promise<ResultadoAccion> => {
    setAuthError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizarEmail(email), password });
      if (error) {
        // Al log (adb logcat en el APK): el usuario solo ve el mensaje traducido.
        console.warn('[Auth] Supabase Auth respondió con error:', error.name, error.status, error.message);
        const mensaje = mensajeDeAuth(error.message);
        setAuthError(mensaje);
        return { ok: false, error: mensaje };
      }
      return { ok: true };
    } catch (err) {
      const mensaje = mensajeDeAuth(err instanceof Error ? err.message : 'Error de conexión.');
      setAuthError(mensaje);
      return { ok: false, error: mensaje };
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  // ─── Completar el perfil (consentimiento + datos) ─────────
  const completeProfile = useCallback(async (datos: {
    rol: 'pasajero' | 'conductor';
    nombre: string;
    telefono: string;
    placa?: string;
    consentimiento: boolean;
  }): Promise<ResultadoAccion> => {
    setAuthError(null);
    try {
      const response = await authFetch(API_CONFIG.endpoints.auth.register, {
        method: 'POST',
        body: JSON.stringify(datos),
      });

      if (!response.ok) {
        const cuerpo = await response.json().catch(() => null);
        const mensaje = cuerpo?.message ?? 'No se pudo crear tu perfil.';
        setAuthError(mensaje);
        return { ok: false, error: mensaje };
      }

      if (user) {
        await fetchProfile(user.id);
      }
      return { ok: true };
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error de red al crear el perfil.';
      setAuthError(mensaje);
      return { ok: false, error: mensaje };
    }
  }, [user, fetchProfile]);

  // ─── Cerrar sesión ────────────────────────────────────────
  const signOut = useCallback(async () => {
    setAuthError(null);
    setLoading(true);
    try {
      // Intentar ambas limpiezas antes de retirar el JWT. Un fallo de GPS/avisos
      // no debe impedir que se intente revocar la sesión.
      const ok = await closeAccountSession({
        stopTracking: detenerSeguimientoFondo,
        forgetDevice: () => registroAvisos.olvidar(),
        revoke: () => supabase.auth.signOut(),
        clearSession,
      });
      // Supabase conserva su sesión persistida ante errores de red. No fingir
      // un logout local que al reiniciar volvería a abrir la cuenta.
      if (!ok) {
        setAuthError('No se pudo cerrar tu sesión. Revisa tu conexión e inténtalo de nuevo.');
        return;
      }
    } catch (err) {
      console.error('[Auth] Error al cerrar sesión:', err);
      setAuthError('No se pudo cerrar tu sesión. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [clearSession, setLoading]);

  return {
    // Estado
    session,
    user,
    profile,
    verification,
    profileChecked,
    verificationChecked,
    isLoading,
    isInitialized,
    authError,

    // Acciones
    signUp,
    signIn,
    completeProfile,
    signOut,
    fetchProfile,
    fetchVerification,
    setAuthError,
  };
};

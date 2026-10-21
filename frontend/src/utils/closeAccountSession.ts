import { conLimite } from './conLimite';

/**
 * Lo más que se espera a apagar el GPS y a olvidar el teléfono antes de revocar la sesión.
 * Son limpiezas de cortesía: sin red o sin Google Play pueden no responder nunca, y en el
 * campo eso dejaba «Cerrando sesión…» para siempre (20 oct 2026).
 */
export const LIMITE_LIMPIEZA_MS = 4000;
export const LIMITE_REVOCACION_MS = 20_000;

interface LogoutActions {
  stopTracking(): Promise<unknown>;
  forgetDevice(): Promise<unknown>;
  revoke(): Promise<{ error: unknown }>;
  clearSession(): void;
}

/** Solo anunciar salida cuando Auth confirmó la eliminación de sus credenciales. */
export async function closeAccountSession(actions: LogoutActions): Promise<boolean> {
  await Promise.allSettled([
    conLimite(Promise.resolve().then(() => actions.stopTracking()), LIMITE_LIMPIEZA_MS, undefined),
    conLimite(Promise.resolve().then(() => actions.forgetDevice()), LIMITE_LIMPIEZA_MS, undefined),
  ]);
  try {
    const resultado = await conLimite(actions.revoke(), LIMITE_REVOCACION_MS, null);
    if (!resultado || resultado.error) return false;
    actions.clearSession();
    return true;
  } catch {
    return false;
  }
}

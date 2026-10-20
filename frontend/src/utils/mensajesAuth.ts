/**
 * Mensajes de Supabase Auth para el usuario. Puro, sin React, para probarlo.
 */

/** Errores de red: la petición no llegó al servidor (sin señal, DNS, TLS, cliente HTTP). */
const ES_DE_RED = ['fetch failed', 'network request failed', 'failed to fetch', 'unable to resolve host', 'timeout', 'timed out'];

/** Traduce los errores más comunes de Supabase Auth a mensajes claros. */
export const mensajeDeAuth = (mensaje: string): string => {
  const m = mensaje.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Falta confirmar tu correo. Revisa tu bandeja de entrada (y el spam).';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
  if (m.includes('password') && m.includes('characters')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (ES_DE_RED.some((texto) => m.includes(texto))) {
    return 'No se pudo conectar con el servidor de cuentas. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
};

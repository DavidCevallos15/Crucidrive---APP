/**
 * Mensajes de Supabase Auth para el usuario. Puro, sin React, para probarlo.
 */
import { MENSAJE_PASSWORD } from './validators';

/** Errores de red: la petición no llegó al servidor (sin señal, DNS, TLS, cliente HTTP). */
const ES_DE_RED = ['fetch failed', 'network request failed', 'failed to fetch', 'unable to resolve host', 'timeout', 'timed out'];

/** Traduce los errores más comunes de Supabase Auth a mensajes claros. */
export const mensajeDeAuth = (mensaje: string): string => {
  const m = mensaje.toLowerCase();
  // 007, criterio 22: un correo sin cuenta y una contraseña equivocada se responden igual.
  if (m.includes('invalid login credentials') || m.includes('user not found')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Falta confirmar tu correo. Revisa tu bandeja de entrada (y el spam).';
  // 007, criterio 21: «ya registrado» no llega aquí (lo resuelve resultadoDeRegistro). Si llegara,
  // cae en el mensaje genérico: nunca se dice que el correo ya tiene una cuenta.
  // Supabase rechaza contraseñas cortas ("at least N characters") o sin letras y números ("should contain").
  if (m.includes('password') && (m.includes('characters') || m.includes('should contain') || m.includes('weak'))) {
    return MENSAJE_PASSWORD;
  }
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (ES_DE_RED.some((texto) => m.includes(texto))) {
    return 'No se pudo conectar con el servidor de cuentas. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No se pudo completar la acción. Inténtalo de nuevo.';
};

/** Supabase avisa que el correo ya tiene una cuenta (con «Confirm email» apagado o en versiones viejas). */
export const esCorreoYaRegistrado = (mensaje: string): boolean => {
  const m = mensaje.toLowerCase();
  return m.includes('already registered') || m.includes('already been registered');
};

/**
 * Lo que ve quien crea una cuenta, sea el correo nuevo o ya registrado (007, criterio 21).
 * No dice «te enviamos» a secas: si el correo ya tenía cuenta, no sale ningún enlace.
 */
export const avisoCuentaCreada = (email: string): string =>
  `Si el correo ${email.trim()} es válido, te enviamos un enlace para confirmarlo. Después, inicia sesión.`;

export type ResultadoRegistro = { ok: true; requiereConfirmarCorreo: boolean } | { ok: false; error: string };

/**
 * Resultado de `supabase.auth.signUp` para la pantalla (007, criterio 21). Un correo ya registrado
 * se trata como uno nuevo que tiene que confirmar: la pantalla muestra el mismo aviso y pasa a «Entrar».
 */
export const resultadoDeRegistro = (error: { message: string } | null, conSesion: boolean): ResultadoRegistro => {
  if (error) {
    if (esCorreoYaRegistrado(error.message)) return { ok: true, requiereConfirmarCorreo: true };
    return { ok: false, error: mensajeDeAuth(error.message) };
  }
  return { ok: true, requiereConfirmarCorreo: !conSesion };
};

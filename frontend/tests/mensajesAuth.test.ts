import { mensajeDeAuth } from '../src/utils/mensajesAuth';

/**
 * El APK mostraba "No se pudo completar la acción" cuando la petición ni siquiera llegaba a
 * Supabase. Un error de red debe decir que es de conexión, no parecer un error de la cuenta.
 */
describe('mensajes de Supabase Auth', () => {
  test.each([
    ['fetch failed: Unable to resolve host "x.supabase.co"'],
    ['Network request failed'],
    ['Failed to fetch'],
    ['fetch failed: timeout'],
  ])('un error de red (%s) dice que es de conexión', (mensaje) => {
    expect(mensajeDeAuth(mensaje)).toMatch(/No se pudo conectar con el servidor de cuentas/);
  });

  test('los errores de la cuenta se siguen traduciendo igual', () => {
    expect(mensajeDeAuth('Invalid login credentials')).toBe('Correo o contraseña incorrectos.');
    expect(mensajeDeAuth('Email not confirmed')).toMatch(/Falta confirmar tu correo/);
  });

  test('lo desconocido mantiene el mensaje genérico', () => {
    expect(mensajeDeAuth('algo raro')).toBe('No se pudo completar la acción. Inténtalo de nuevo.');
  });
});

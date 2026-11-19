import { avisoCuentaCreada, esCorreoYaRegistrado, mensajeDeAuth, resultadoDeRegistro } from '../src/utils/mensajesAuth';

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

  // 007, criterio 23: Supabase exige 10 con letras y números; el mensaje ya no dice "8".
  test.each([
    ['Password should be at least 10 characters.'],
    ['Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789'],
    ['Password is known to be weak and easy to guess, please choose a different one.'],
  ])('una contraseña rechazada (%s) explica la regla de 10 con letras y números', (mensaje) => {
    expect(mensajeDeAuth(mensaje)).toBe('Usa al menos 10 caracteres, con letras y números.');
  });

  test('lo desconocido mantiene el mensaje genérico', () => {
    expect(mensajeDeAuth('algo raro')).toBe('No se pudo completar la acción. Inténtalo de nuevo.');
  });
});

// 007, criterios 21 y 22: las respuestas de la cuenta no revelan si un correo ya está registrado.
describe('007 · no revelar quién tiene cuenta', () => {
  test('criterio 21: un correo ya registrado y uno nuevo reciben la misma respuesta', () => {
    const nuevo = resultadoDeRegistro(null, false);
    expect(nuevo).toEqual({ ok: true, requiereConfirmarCorreo: true });
    for (const mensaje of ['User already registered', 'A user with this email address has already been registered']) {
      expect(esCorreoYaRegistrado(mensaje)).toBe(true);
      expect(resultadoDeRegistro({ message: mensaje }, false)).toEqual(nuevo);
    }
  });

  test('criterio 21: el aviso no afirma que se envió un correo ni que la cuenta existe', () => {
    const aviso = avisoCuentaCreada('  ana@correo.ec ');
    expect(aviso).toBe('Si el correo ana@correo.ec es válido, te enviamos un enlace para confirmarlo. Después, inicia sesión.');
    expect(aviso).not.toMatch(/ya tiene|existe|registrad/i);
  });

  test('criterio 21: ningún mensaje dice que el correo ya tiene una cuenta', () => {
    for (const mensaje of ['User already registered', 'Email address already been registered']) {
      expect(mensajeDeAuth(mensaje)).not.toMatch(/ya tiene una cuenta/);
    }
  });

  test('con sesión (sin confirmar correo) entra directo; otros errores se traducen', () => {
    expect(resultadoDeRegistro(null, true)).toEqual({ ok: true, requiereConfirmarCorreo: false });
    expect(resultadoDeRegistro({ message: 'Password should be at least 10 characters.' }, false))
      .toEqual({ ok: false, error: 'Usa al menos 10 caracteres, con letras y números.' });
  });

  test('criterio 22: correo inexistente y contraseña equivocada dan el mismo mensaje', () => {
    // Supabase responde «Invalid login credentials» en los dos casos; «user not found» se trata igual.
    expect(mensajeDeAuth('Invalid login credentials')).toBe('Correo o contraseña incorrectos.');
    expect(mensajeDeAuth('User not found')).toBe('Correo o contraseña incorrectos.');
  });
});

import { createClient } from '@supabase/supabase-js';
import { closeAccountSession } from '../src/utils/closeAccountSession';

/** Integra el SDK instalado y almacenamiento en memoria, sin cuentas ni red real. */
it('un fallo conserva la sesión persistida; reintentar la elimina y no vuelve al reiniciar', async () => {
  const datos = new Map<string, string>();
  const storage = {
    getItem: (key: string) => datos.get(key) ?? null,
    setItem: (key: string, value: string) => { datos.set(key, value); },
    removeItem: (key: string) => { datos.delete(key); },
  };
  let fallarSalida = true;
  const red: typeof fetch = async (input) => {
    if (String(input).includes('/logout')) {
      return fallarSalida ? new Response(JSON.stringify({ message: 'Sin red' }), { status: 503 }) : new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ access_token: 'token-prueba', refresh_token: 'refresh-prueba', expires_in: 3600,
      token_type: 'bearer', user: { id: 'usuario-prueba', aud: 'authenticated' } }), { status: 200 });
  };
  const opciones = { auth: { storage, storageKey: 'prueba-salida', autoRefreshToken: false, persistSession: true, detectSessionInUrl: false }, global: { fetch: red } };
  const cliente = createClient('https://prueba.invalid', 'anon-prueba', opciones);
  await cliente.auth.signInWithPassword({ email: 'prueba@example.test', password: 'solo-en-memoria' });
  expect((await cliente.auth.getSession()).data.session).not.toBeNull();
  const clearSession = jest.fn();
  const acciones = { stopTracking: async () => {}, forgetDevice: async () => {}, revoke: () => cliente.auth.signOut(), clearSession };
  await expect(closeAccountSession(acciones)).resolves.toBe(false);
  expect(datos.has('prueba-salida')).toBe(true);
  expect(clearSession).not.toHaveBeenCalled();
  fallarSalida = false;
  await expect(closeAccountSession(acciones)).resolves.toBe(true);
  expect(clearSession).toHaveBeenCalledTimes(1);
  expect(datos.has('prueba-salida')).toBe(false);
  const reiniciado = createClient('https://prueba.invalid', 'anon-prueba', opciones);
  expect((await reiniciado.auth.getSession()).data.session).toBeNull();
});

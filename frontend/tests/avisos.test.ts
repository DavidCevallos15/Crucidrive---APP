import { crearRegistroAvisos, TOKEN_EXPO } from '../src/servicios/registroAvisos';
import type { ApiDispositivos } from '../src/servicios/registroAvisos';

/**
 * Paso 004 · avisos en la app. T9: registro y borrado del token (criterio 11).
 */

const TOKEN = 'ExponentPushToken[telefonoDePrueba01]';

const montar = ({
  token = TOKEN as string | null,
  registrarOk = true,
  olvidarOk = true,
}: { token?: string | null; registrarOk?: boolean; olvidarOk?: boolean } = {}) => {
  const llamadas: string[] = [];
  const avisos: string[] = [];
  const api: ApiDispositivos = {
    registrar: jest.fn(async (t: string) => { llamadas.push(`registrar ${t}`); return registrarOk; }),
    olvidar: jest.fn(async (t: string) => { llamadas.push(`olvidar ${t}`); return olvidarOk; }),
  };
  const obtenerToken = jest.fn(async () => token);
  const registro = crearRegistroAvisos({ obtenerToken, api, avisar: (m) => avisos.push(m) });
  return { registro, api, obtenerToken, llamadas, avisos };
};

describe('T9 · registro del teléfono para avisos (criterio 11)', () => {
  test('al iniciar sesión registra el token de este teléfono', async () => {
    const { registro, llamadas } = montar();
    await expect(registro.registrar('pedro')).resolves.toBe(TOKEN);
    expect(llamadas).toEqual([`registrar ${TOKEN}`]);
    expect(registro.registradoPara()).toBe('pedro');
  });

  test('registrar dos veces con la misma cuenta no repite la llamada', async () => {
    const { registro, llamadas } = montar();
    await registro.registrar('pedro');
    await registro.registrar('pedro');
    expect(llamadas).toHaveLength(1);
  });

  test('si el teléfono pasa a otra cuenta se registra de nuevo (la BD lo reasigna)', async () => {
    const { registro, llamadas } = montar();
    await registro.registrar('pedro');
    await registro.registrar('xavi');
    expect(llamadas).toEqual([`registrar ${TOKEN}`, `registrar ${TOKEN}`]);
    expect(registro.registradoPara()).toBe('xavi');
  });

  test('al cerrar sesión borra el token y vuelve a registrarlo en el siguiente inicio', async () => {
    const { registro, llamadas } = montar();
    await registro.registrar('pedro');
    await registro.olvidar();
    expect(llamadas).toEqual([`registrar ${TOKEN}`, `olvidar ${TOKEN}`]);
    expect(registro.registradoPara()).toBeNull();
    await registro.registrar('pedro');
    expect(llamadas).toHaveLength(3);
  });

  test('cerrar sesión sin token registrado no llama a la API', async () => {
    const { registro, api } = montar();
    await registro.olvidar();
    expect(api.olvidar).not.toHaveBeenCalled();
  });

  test('iniciar y cerrar sesión seguidos no se cruzan: el borrado va después del registro', async () => {
    const { registro, llamadas } = montar();
    const inicio = registro.registrar('pedro');
    const cierre = registro.olvidar();
    await Promise.all([inicio, cierre]);
    expect(llamadas).toEqual([`registrar ${TOKEN}`, `olvidar ${TOKEN}`]);
  });

  test('sin token (web, Expo Go o permiso negado) no llama a la API', async () => {
    const { registro, api } = montar({ token: null });
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    expect(api.registrar).not.toHaveBeenCalled();
    expect(registro.registradoPara()).toBeNull();
  });

  test('un token con formato inesperado no se envía', async () => {
    const { registro, api } = montar({ token: 'token-inventado' });
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    expect(api.registrar).not.toHaveBeenCalled();
  });

  test('si el servidor no lo registra, el siguiente intento vuelve a probar', async () => {
    const { registro, api, avisos } = montar({ registrarOk: false });
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    await registro.registrar('pedro');
    expect(api.registrar).toHaveBeenCalledTimes(2);
    expect(avisos[0]).toMatch(/no registró/);
  });

  test('un error al pedir el token no rompe el inicio de sesión', async () => {
    const { registro, obtenerToken, avisos } = montar();
    obtenerToken.mockRejectedValueOnce(new Error('sin red'));
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    expect(avisos[0]).toMatch(/No se pudo registrar/);
  });

  test('un error al borrar no impide cerrar sesión y deja el registro limpio', async () => {
    const { registro, api, avisos } = montar();
    await registro.registrar('pedro');
    (api.olvidar as jest.Mock).mockRejectedValueOnce(new Error('sin red'));
    await expect(registro.olvidar()).resolves.toBeUndefined();
    expect(registro.registradoPara()).toBeNull();
    expect(avisos[0]).toMatch(/No se pudo quitar/);
  });

  test('el patrón del token coincide con el CHECK de la BD', () => {
    expect(TOKEN_EXPO.test(TOKEN)).toBe(true);
    expect(TOKEN_EXPO.test('ExponentPushToken[corto]')).toBe(false);
    expect(TOKEN_EXPO.test('ExponentPushToken[con espacio 1234]')).toBe(false);
  });
});

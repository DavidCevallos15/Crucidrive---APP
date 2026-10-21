import { closeAccountSession, LIMITE_LIMPIEZA_MS } from '../src/utils/closeAccountSession';
import { crearRegistroAvisos, LIMITE_TAREA_AVISOS_MS } from '../src/servicios/registroAvisos';
import { conLimite } from '../src/utils/conLimite';

/**
 * Campo, 20 oct 2026: «Cerrando sesión…» se quedaba para siempre en el emulador y en el
 * teléfono. Pedir el token de avisos sin Google Play, o un backend que no responde, no
 * terminaban nunca, y el cierre de sesión esperaba detrás de eso.
 */
const nunca = <T,>() => new Promise<T>(() => {});

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('cerrar sesión no se cuelga', () => {
  it('si Auth nunca responde, libera la interfaz sin anunciar una salida inexistente', async () => {
    const clearSession = jest.fn();
    const resultado = closeAccountSession({
      stopTracking: async () => {}, forgetDevice: async () => {},
      revoke: () => nunca(), clearSession,
    });
    let estado: boolean | 'pendiente' = 'pendiente';
    void resultado.then((valor) => { estado = valor; });
    await jest.advanceTimersByTimeAsync(20_000);
    expect(estado).toBe(false);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('si apagar el GPS u olvidar el teléfono no responden, igual revoca la sesión al vencer el límite', async () => {
    const revoke = jest.fn(async () => ({ error: null }));
    const clearSession = jest.fn();
    const r = closeAccountSession({ stopTracking: () => nunca(), forgetDevice: () => nunca(), revoke, clearSession });
    await jest.advanceTimersByTimeAsync(LIMITE_LIMPIEZA_MS);
    await expect(r).resolves.toBe(true);
    expect(revoke).toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalled();
  });

  it('un registro de avisos que nunca termina no deja bloqueado «olvidar» en la cola', async () => {
    const api = { registrar: jest.fn(), olvidar: jest.fn(async () => true) };
    const registro = crearRegistroAvisos({ obtenerToken: () => nunca(), api, avisar: () => {} });
    void registro.registrar('u1');
    const olvidar = registro.olvidar();
    await jest.advanceTimersByTimeAsync(LIMITE_TAREA_AVISOS_MS);
    await expect(olvidar).resolves.toBeUndefined();
  });

  it('una confirmación tardía tras el límite no limpia por segunda vez el estado de otra cuenta', async () => {
    let resolver!: (valor: { error: null }) => void;
    const clearSession = jest.fn();
    const resultado = closeAccountSession({ stopTracking: async () => {}, forgetDevice: async () => {},
      revoke: () => new Promise((resolve) => { resolver = resolve; }), clearSession });
    await jest.advanceTimersByTimeAsync(20_000);
    await expect(resultado).resolves.toBe(false);
    resolver({ error: null });
    await jest.advanceTimersByTimeAsync(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('conLimite devuelve el valor de respaldo al vencer y el resultado si llega antes', async () => {
    const lento = conLimite(nunca<string>(), 1000, 'vencido');
    await jest.advanceTimersByTimeAsync(1000);
    await expect(lento).resolves.toBe('vencido');
    await expect(conLimite(Promise.resolve('ok'), 1000, 'vencido')).resolves.toBe('ok');
  });
});

jest.mock('../src/constants/config', () => ({ API_CONFIG: { baseUrl: 'http://api' } }));
jest.mock('../src/store/useAuthStore', () => ({
  useAuthStore: { getState: () => ({ session: { access_token: 'jwt' } }) },
}));

import { authFetch, LIMITE_PETICION_MS } from '../src/utils/authFetch';

/** Campo, 20 oct 2026: sin límite, una petición a un backend que no responde colgaba la pantalla. */
describe('authFetch con límite de tiempo', () => {
  const fetchOriginal = global.fetch;
  afterEach(() => { global.fetch = fetchOriginal; jest.useRealTimers(); });

  it('cancela la petición al vencer el límite y falla (no espera para siempre)', async () => {
    jest.useFakeTimers();
    let senal: AbortSignal | undefined;
    global.fetch = jest.fn((_url, init?: RequestInit) => new Promise((_ok, falla) => {
      senal = init?.signal ?? undefined;
      senal?.addEventListener('abort', () => falla(new Error('abortada')));
    })) as unknown as typeof fetch;
    const r = authFetch('/api/x', { method: 'POST' });
    const resultado = expect(r).rejects.toThrow('abortada');
    await jest.advanceTimersByTimeAsync(LIMITE_PETICION_MS);
    await resultado;
    expect(senal?.aborted).toBe(true);
  });

  it('una respuesta a tiempo pasa igual, con el JWT del usuario', async () => {
    const respuesta = { ok: true } as Response;
    global.fetch = jest.fn(async () => respuesta) as unknown as typeof fetch;
    await expect(authFetch('/api/x')).resolves.toBe(respuesta);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jwt');
  });
});

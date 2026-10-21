import { crearAuthFetchConLimite, LIMITE_AUTH_RED_MS } from '../src/utils/authFetchConLimite';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('aborta la petición y termina aunque el transporte ignore el aborto', async () => {
  const original = new AbortController();
  const quitar = jest.spyOn(original.signal, 'removeEventListener');
  const red = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(() => new Promise<Response>(() => {}));
  const solicitud = crearAuthFetchConLimite(red)('https://auth.test/logout', { signal: original.signal });
  const fallo = expect(solicitud).rejects.toThrow('Tiempo de espera');
  await jest.advanceTimersByTimeAsync(LIMITE_AUTH_RED_MS);
  await fallo;
  expect(red.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(quitar).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
});

it('conserva cuerpo y cabeceras y libera su timer al recibir respuesta', async () => {
  const respuesta = new Response(null, { status: 204 });
  const red = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(respuesta);
  await expect(crearAuthFetchConLimite(red)('/logout', { method: 'POST', body: 'datos', headers: { prueba: 'ok' } })).resolves.toBe(respuesta);
  expect(red).toHaveBeenCalledWith('/logout', expect.objectContaining({ method: 'POST', body: 'datos', headers: { prueba: 'ok' } }));
  expect(jest.getTimerCount()).toBe(0);
});

it('respeta cancelación de la petición original y propaga error de red sin esperar', async () => {
  const original = new AbortController();
  original.abort();
  const red = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockRejectedValue(new Error('sin red'));
  await expect(crearAuthFetchConLimite(red)('/logout', { signal: original.signal })).rejects.toThrow('sin red');
  expect(red.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

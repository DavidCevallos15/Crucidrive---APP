import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function worker() {
  const handlers: Record<string, (event: any) => void> = {};
  const cache = { addAll: jest.fn(async () => undefined), put: jest.fn(async () => undefined) };
  const caches = { open: jest.fn(async () => cache), match: jest.fn(async () => undefined), keys: jest.fn(async () => [] as string[]), delete: jest.fn(async () => true) };
  const network = jest.fn(async () => new Response('ok'));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), {
    self: { location: { origin: 'https://cruci.test' }, addEventListener: (name: string, fn: any) => { handlers[name] = fn; }, clients: { claim: async () => undefined } },
    caches, fetch: network, URL,
  });
  const request = (pathname: string, extra: Record<string, unknown> = {}) => {
    const event = { request: { method: 'GET', url: `https://cruci.test${pathname}`, headers: new Headers(), mode: 'cors', ...extra }, respondWith: jest.fn(), waitUntil: jest.fn() };
    handlers.fetch(event);
    return event;
  };
  return { handlers, caches, cache, network, request };
}

describe('PWA: límites de caché', () => {
  it.each(['/api/viajes', '/auth/token', '/storage/v1/private/foto.png', '/assets/foto.png?token=secreto', '/perfil-privado.json'])(
    'no intercepta información privada: %s', (url) => {
      const w = worker();
      expect(w.request(url).respondWith).not.toHaveBeenCalled();
      expect(w.caches.match).not.toHaveBeenCalled();
    },
  );
  it('no intercepta recursos con cabecera Authorization', () => {
    const w = worker();
    expect(w.request('/assets/foto.png', { headers: new Headers({ authorization: 'Bearer test' }) }).respondWith).not.toHaveBeenCalled();
  });
  it('permite cachear los iconos públicos', async () => {
    const w = worker();
    const event = w.request('/pwa-512.png');
    await event.respondWith.mock.calls[0][0];
    expect(w.cache.put).toHaveBeenCalled();
  });
  it('respeta Cache-Control no-store incluso para recursos públicos', async () => {
    const w = worker();
    w.network.mockResolvedValue(new Response('privado', { headers: { 'cache-control': 'no-store' } }));
    const event = w.request('/assets/foto.png');
    await event.respondWith.mock.calls[0][0];
    expect(w.cache.put).not.toHaveBeenCalled();
  });
  it('la actualización solo elimina cachés de CruciDrive', async () => {
    const w = worker();
    w.caches.keys.mockResolvedValue(['otra-app', 'crucidrive-static-crucidrive-pwa-v1']);
    const event = { waitUntil: jest.fn() };
    w.handlers.activate(event);
    await event.waitUntil.mock.calls[0][0];
    expect(w.caches.delete).toHaveBeenCalledTimes(1);
    expect(w.caches.delete).toHaveBeenCalledWith('crucidrive-static-crucidrive-pwa-v1');
  });
});

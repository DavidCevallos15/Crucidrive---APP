const { leerTrustProxy } = require('../src/config/trustProxy');
const express = require('express');

describe('trust proxy · configuración explícita', () => {
  test.each([undefined, '', ' ', 'false', '0'])('%p conserva la conexión directa sin confianza', (value) => {
    expect(leerTrustProxy(value)).toBe(false);
  });
  test('mantiene el número exacto de saltos y admite la red local del túnel', () => {
    expect(leerTrustProxy('1')).toBe(1);
    expect(leerTrustProxy('2')).toBe(2);
    expect(leerTrustProxy('loopback')).toEqual(['loopback']);
    expect(leerTrustProxy('127.0.0.1, ::1/128')).toEqual(['127.0.0.1', '::1/128']);
  });
  test.each(['true', 'no', '1proxy', '-1', '0.5', '0.0.0.0/0', '::/0', '127.0.0.1/33', 'loopback,', 'uniquelocal'])('%p no habilita confianza por error', (value) => {
    expect(() => leerTrustProxy(value)).toThrow('TRUST_PROXY inválido');
  });
  test('un cliente directo no puede cambiar de IP mediante X-Forwarded-For', async () => {
    const app = express();
    app.set('trust proxy', leerTrustProxy('false'));
    app.get('/', (req, res) => res.json({ ip: req.ip }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const r = await fetch(`http://127.0.0.1:${server.address().port}`, { headers: { 'X-Forwarded-For': '203.0.113.12' } });
      expect((await r.json()).ip).toBe('127.0.0.1');
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
  test('loopback reconoce al cliente reenviado, pero no confía en redes LAN arbitrarias', () => {
    const app = express();
    app.set('trust proxy', leerTrustProxy('loopback'));
    const confiar = app.get('trust proxy fn');
    expect(confiar('127.0.0.1')).toBe(true);
    expect(confiar('::1')).toBe(true);
    expect(confiar('192.168.1.50')).toBe(false);
    expect(confiar('203.0.113.12')).toBe(false);
  });
});

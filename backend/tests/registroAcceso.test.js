/**
 * Paso 007 · T14: registro de acceso (criterios 19 y 20; plan P11; E3).
 */
const express = require('express');
const { crearRegistroAcceso, lineaAcceso, lineaSocket, ipDeSocket, UA_MAX } = require('../src/middlewares/registroAcceso');

const USUARIO = '11111111-1111-1111-1111-111111111111';

/** App mínima: el registro va primero y la "autenticación" llega después, como en app.js. */
const levantar = async (lineas) => {
  const app = express();
  app.use(crearRegistroAcceso({ escribir: (l) => lineas.push(JSON.parse(l)) }));
  app.use(express.json());
  app.use((req, res, next) => {
    if (req.get('x-usuario')) req.user = { id: req.get('x-usuario') };
    next();
  });
  app.post('/api/auth/register', (req, res) => res.status(201).json({ ok: true }));
  app.get('/api/viajes/:id', (req, res) => res.status(404).json({ ok: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, cerrar: () => new Promise((r) => server.close(r)) };
};

/** La línea se escribe al terminar la respuesta, que puede llegar justo después del fetch. */
const esperarLineas = async (lineas, n) => {
  for (let i = 0; i < 50 && lineas.length < n; i += 1) await new Promise((r) => setTimeout(r, 10));
};

describe('T14 · registro de acceso por petición (criterios 19 y 20)', () => {
  let srv;
  const lineas = [];
  beforeAll(async () => { srv = await levantar(lineas); });
  afterAll(() => srv.cerrar());
  beforeEach(() => { lineas.length = 0; });

  test('criterio 20: con cuerpo { nombre, telefono } y ?lat=, la línea no lleva esos datos', async () => {
    await fetch(`${srv.base}/api/auth/register?lat=-0.8705&lng=-80.5375`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-usuario': USUARIO, 'user-agent': 'CruciDrive/1.0 (Android 14)' },
      body: JSON.stringify({ nombre: 'Ana Pérez', telefono: '0991111111' }),
    });
    await esperarLineas(lineas, 1);
    expect(lineas).toHaveLength(1);
    const texto = JSON.stringify(lineas[0]);
    for (const dato of ['Ana', '0991111111', 'lat', '-0.8705', '-80.5375']) expect(texto).not.toContain(dato);
  });

  test('criterio 19: lleva fecha, usuario, método, ruta sin consulta, estado, duración, IP y user-agent', async () => {
    await fetch(`${srv.base}/api/auth/register?lat=-0.87`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-usuario': USUARIO, 'user-agent': 'CruciDrive/1.0' },
      body: '{}',
    });
    await esperarLineas(lineas, 1);
    const l = lineas[0];
    expect(Object.keys(l)).toEqual(['t', 'uid', 'm', 'ruta', 'st', 'ms', 'ip', 'ua']);
    expect(Number.isNaN(Date.parse(l.t))).toBe(false);
    expect(l).toMatchObject({ uid: USUARIO, m: 'POST', ruta: '/api/auth/register', st: 201, ua: 'CruciDrive/1.0' });
    expect(l.ms).toBeGreaterThanOrEqual(0);
    expect(l.ip).toMatch(/127\.0\.0\.1/);
  });

  test('sin sesión el usuario es «anonimo» y también se registran los errores', async () => {
    await fetch(`${srv.base}/api/viajes/0a1b2c3d-0000-4000-8000-000000000001`);
    await esperarLineas(lineas, 1);
    expect(lineas[0]).toMatchObject({ uid: 'anonimo', m: 'GET', st: 404 });
  });
});

describe('T14 · formato y socket', () => {
  test('el user-agent se corta en 200 caracteres', () => {
    const l = JSON.parse(lineaAcceso({ metodo: 'GET', url: '/', estado: 200, ms: 1.6, ua: 'x'.repeat(500) }));
    expect(l.ua).toHaveLength(UA_MAX);
    expect(l.ms).toBe(2);
  });

  test('el socket escribe el mismo formato al conectar y al desconectar, sin coordenadas', () => {
    const ahora = new Date('2026-11-19T20:00:00Z');
    const l = JSON.parse(lineaSocket({ uid: USUARIO, evento: 'conectar', ip: '190.1.2.3', ua: 'CruciDrive', ahora }));
    expect(l).toEqual({ t: '2026-11-19T20:00:00.000Z', uid: USUARIO, m: 'SOCKET', ruta: 'conectar', ip: '190.1.2.3', ua: 'CruciDrive' });
    expect(JSON.parse(lineaSocket({ evento: 'desconectar' })).uid).toBe('anonimo');
  });

  test('IP del socket: detrás de Caddy, la última de X-Forwarded-For; sin proxy, la conexión', () => {
    const handshake = { address: '127.0.0.1', headers: { 'x-forwarded-for': '6.6.6.6, 190.1.2.3' } };
    expect(ipDeSocket(handshake, true)).toBe('190.1.2.3');
    expect(ipDeSocket(handshake, false)).toBe('127.0.0.1');
    expect(ipDeSocket({ address: '10.0.0.5', headers: {} }, true)).toBe('10.0.0.5');
    expect(ipDeSocket(undefined)).toBe('');
  });

  test('en las pruebas (NODE_ENV=test) el middleware por defecto no escribe', () => {
    const espia = jest.spyOn(process.stdout, 'write');
    const mw = crearRegistroAcceso();
    const next = jest.fn();
    mw({}, { on: jest.fn() }, next);
    expect(next).toHaveBeenCalled();
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  test('app.js monta el registro antes de las rutas', () => {
    const fuente = require('fs').readFileSync(require('path').join(__dirname, '../src/app.js'), 'utf8');
    expect(fuente.indexOf('app.use(crearRegistroAcceso())')).toBeGreaterThan(-1);
    expect(fuente.indexOf('app.use(crearRegistroAcceso())')).toBeLessThan(fuente.indexOf("app.use('/api/auth', authRoutes)"));
  });
});

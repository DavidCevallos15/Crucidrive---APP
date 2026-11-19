/**
 * Paso 007 · T11: límites por usuario (criterios 17 y 18; plan P9; E6).
 * Se monta la app real (createApp) con la autenticación y los controladores simulados: así se
 * prueba que cada ruta tiene su límite, en el orden correcto, y que todo 429 lleva Retry-After.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/config/supabase', () => ({ supabase: {}, createUserClient: jest.fn(), getAdminClient: jest.fn() }));
// El usuario viene de una cabecera de prueba; sin ella, 401 (como el middleware real).
jest.mock('../src/middlewares/authMiddleware', () => (req, res, next) => {
  const id = req.get('x-usuario');
  if (!id) return res.status(401).json({ status: 'error', message: 'Sin sesión.' });
  req.user = { id };
  return next();
});
jest.mock('../src/middlewares/roleMiddleware', () => () => (req, res, next) => next());
// Todo controlador responde 200: aquí solo importan los límites.
const mockControlador = () => new Proxy({}, {
  get: (_, k) => (k === '__esModule' ? false : (req, res) => res.status(200).json({ status: 'success' })),
});
jest.mock('../src/controllers/viajeController', () => mockControlador());
jest.mock('../src/controllers/viajeEnCursoController', () => mockControlador());
jest.mock('../src/controllers/conductorController', () => mockControlador());

const { LIMITES, leerConfigLimites } = require('../src/middlewares/limitePorUsuario');

const VIAJE = '0a1b2c3d-0000-4000-8000-000000000001';

/** Levanta la app en un puerto libre con el entorno dado y devuelve un `pedir` y un `cerrar`. */
const levantar = async (env = {}) => {
  const antes = { ...process.env };
  Object.assign(process.env, env);
  let app;
  try {
    jest.isolateModules(() => { app = require('../src/app').createApp(); });
  } finally {
    process.env = antes;
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const pedir = (metodo, ruta, usuario) => fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(usuario ? { 'x-usuario': usuario } : {}) },
    body: metodo === 'GET' ? undefined : '{}',
  });
  const cerrar = () => new Promise((r) => server.close(r));
  return { pedir, cerrar };
};

/** Repite la petición n veces y devuelve los estados. */
const repetir = async (n, fn) => {
  const estados = [];
  for (let i = 0; i < n; i += 1) estados.push((await fn()).status);
  return estados;
};

describe('T11 · configuración', () => {
  test('por defecto: pedir 10, cancelar 10 y aceptar 30 cada 15 min (E6)', () => {
    expect(leerConfigLimites({})).toEqual({ pedir: 10, cancelar: 10, aceptar: 30 });
    expect(Object.keys(LIMITES)).toEqual(['RATE_LIMIT_USUARIO_PEDIR', 'RATE_LIMIT_USUARIO_CANCELAR', 'RATE_LIMIT_USUARIO_ACEPTAR']);
  });

  test.each([['RATE_LIMIT_USUARIO_PEDIR', '0'], ['RATE_LIMIT_USUARIO_ACEPTAR', 'treinta'], ['RATE_LIMIT_USUARIO_CANCELAR', '1001']])(
    '%s=%s impide arrancar y dice qué valor falla', (nombre, valor) => {
      expect(() => leerConfigLimites({ [nombre]: valor })).toThrow(nombre);
    },
  );
});

describe('T11 · límites por usuario en las rutas del viaje (criterio 17)', () => {
  let srv;
  beforeAll(async () => { srv = await levantar(); });
  afterAll(() => srv.cerrar());

  test('el pedido 11 en 15 min recibe 429 y otro usuario de la misma IP no se ve afectado', async () => {
    const estados = await repetir(11, () => srv.pedir('POST', '/api/viajes/solicitar', 'ana'));
    expect(estados.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(estados[10]).toBe(429);
    expect((await srv.pedir('POST', '/api/viajes/solicitar', 'beto')).status).toBe(200);
  });

  test('cancelar comparte el límite entre POST /:id/cancelar y PATCH /:id/estado', async () => {
    const a = await repetir(6, () => srv.pedir('POST', `/api/viajes/${VIAJE}/cancelar`, 'carla'));
    const b = await repetir(5, () => srv.pedir('PATCH', `/api/viajes/${VIAJE}/estado`, 'carla'));
    expect([...a, ...b].filter((s) => s === 200)).toHaveLength(10);
    expect(b[4]).toBe(429);
    expect((await srv.pedir('POST', `/api/viajes/${VIAJE}/cancelar`, 'dario')).status).toBe(200);
  });

  test('aceptar admite 30 y la 31 recibe 429', async () => {
    const estados = await repetir(31, () => srv.pedir('POST', '/api/viajes/aceptar', 'eva'));
    expect(estados.filter((s) => s === 200)).toHaveLength(30);
    expect(estados[30]).toBe(429);
  });

  test('pedir y aceptar llevan cuentas separadas', async () => {
    await repetir(10, () => srv.pedir('POST', '/api/viajes/solicitar', 'fer'));
    expect((await srv.pedir('POST', '/api/viajes/aceptar', 'fer')).status).toBe(200);
  });

  test('sin sesión responde 401 antes del límite: no se cuenta a nadie', async () => {
    expect((await srv.pedir('POST', '/api/viajes/solicitar')).status).toBe(401);
  });
});

describe('T11 · todo 429 lleva Retry-After y un mensaje sin detalles (criterio 18)', () => {
  const revisar429 = async (r) => {
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    const cuerpo = await r.json();
    expect(cuerpo.status).toBe('error');
    expect(cuerpo.message).toMatch(/Intenta de nuevo/);
    expect(JSON.stringify(cuerpo)).not.toMatch(/stack|details|req\.user|ana/);
  };

  test('por usuario', async () => {
    const srv = await levantar({ RATE_LIMIT_USUARIO_PEDIR: '1' });
    try {
      await srv.pedir('POST', '/api/viajes/solicitar', 'ana');
      await revisar429(await srv.pedir('POST', '/api/viajes/solicitar', 'ana'));
    } finally { await srv.cerrar(); }
  });

  test('por IP (/api)', async () => {
    const srv = await levantar({ RATE_LIMIT_API: '1' });
    try {
      await srv.pedir('POST', '/api/viajes/solicitar', 'ana');
      await revisar429(await srv.pedir('POST', '/api/viajes/solicitar', 'beto'));
    } finally { await srv.cerrar(); }
  });

  test('por IP (/api/auth)', async () => {
    const srv = await levantar({ RATE_LIMIT_AUTH: '1' });
    try {
      await srv.pedir('POST', '/api/auth/register');
      await revisar429(await srv.pedir('POST', '/api/auth/register'));
    } finally { await srv.cerrar(); }
  });

  test('ubicación del conductor (/api/conductores/ubicacion)', async () => {
    const srv = await levantar();
    try {
      const estados = await repetir(3, () => srv.pedir('POST', '/api/conductores/ubicacion', 'carla'));
      expect(estados.slice(0, 2)).toEqual([200, 200]);
      const r = await srv.pedir('POST', '/api/conductores/ubicacion', 'carla');
      expect(r.status).toBe(429);
      expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    } finally { await srv.cerrar(); }
  });
});

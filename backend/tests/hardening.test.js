/**
 * Endurecimiento portado de los PR #1 y #2 sobre la arquitectura del paso 001.
 */
const V1 = '0a1b2c3d-0000-4000-8000-000000000001';

jest.mock('../src/config/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() } },
  createUserClient: jest.fn(),
}));

const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

describe('utils/response · no filtra detalles internos', () => {
  it('errorResponse envía solo status y message', () => {
    const { errorResponse } = require('../src/utils/response');
    const r = res();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    errorResponse(r, 400, 'Mensaje seguro', 'duplicate key value violates unique constraint "perfiles_pkey"');
    expect(r.json).toHaveBeenCalledWith({ status: 'error', message: 'Mensaje seguro' });
  });
});

describe('utils/geo', () => {
  const { toWKT, isValidCoordinate } = require('../src/utils/geo');

  it('acepta coordenadas de Crucita', () => {
    expect(toWKT(-80.5432, -1.0448)).toBe('POINT(-80.5432 -1.0448)');
  });

  it.each([
    [200, 0], [0, 200], ['-1.04', -80.5], [NaN, 0], [Infinity, 0], [null, 0],
  ])('rechaza lat=%p lng=%p', (lat, lng) => {
    expect(isValidCoordinate(lat, lng)).toBe(false);
  });

  it('toWKT nunca interpola texto arbitrario', () => {
    expect(() => toWKT('0) ; DROP TABLE viajes; --', 0)).toThrow('inválidas');
  });
});

describe('controladores · validación de entrada', () => {
  const db = { from: jest.fn() };

  beforeEach(() => db.from.mockClear());

  it('solicitarViaje rechaza coordenadas fuera de rango sin tocar la BD', async () => {
    const { solicitarViaje } = require('../src/controllers/viajeController');
    const r = res();
    await solicitarViaje({ body: { origen: { lat: 200, lng: 0 }, destino: { lat: -1, lng: -80 } }, user: { id: 'u' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('solicitarViaje acepta lat/lng = 0 (antes se rechazaba por ser falsy)', async () => {
    const { solicitarViaje } = require('../src/controllers/viajeController');
    const q = { insert: jest.fn(() => q), select: jest.fn(() => q), single: jest.fn().mockResolvedValue({ data: { id: V1 }, error: null }) };
    db.from.mockReturnValue(q);
    const r = res();
    await solicitarViaje({ body: { origen: { lat: 0, lng: 0 }, destino: { lat: -1, lng: -80 } }, user: { id: 'u' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
  });

  it('aceptarViaje rechaza un viajeId que no es UUID', async () => {
    const { aceptarViaje } = require('../src/controllers/viajeController');
    const r = res();
    await aceptarViaje({ body: { viajeId: "1' OR '1'='1" }, user: { id: 'c' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('cambiarEstadoViaje rechaza un id de ruta que no es UUID', async () => {
    const { cambiarEstadoViaje } = require('../src/controllers/viajeController');
    const r = res();
    await cambiarEstadoViaje({ params: { id: 'abc' }, body: { estado: 'cancelado' }, user: { id: 'c' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it.each([
    [{ nombre: 'A', telefono: '0991234567' }, 'nombre'],
    [{ nombre: '<script>', telefono: '0991234567' }, 'nombre'],
    [{ nombre: 'Ana', telefono: '099-ABC' }, 'teléfono'],
  ])('registerProfile rechaza %p', async (campos, texto) => {
    const { registerProfile } = require('../src/controllers/authController');
    const r = res();
    await registerProfile({ body: { rol: 'pasajero', ...campos }, user: { id: 'u' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message.toLowerCase()).toContain(texto);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('registerProfile rechaza una placa con símbolos', async () => {
    const { registerProfile } = require('../src/controllers/authController');
    const r = res();
    await registerProfile({ body: { rol: 'conductor', nombre: 'Ana', telefono: '0991234567', placa: 'AB$12' }, user: { id: 'u' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('getHistorialChat rechaza un threadId que no es UUID', async () => {
    const { getHistorialChat } = require('../src/controllers/chatController');
    const r = res();
    await getHistorialChat({ params: { threadId: 'x' }, user: { id: 'u' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

describe('app · cabeceras, CORS, 404, JSON y rate limit', () => {
  let server;
  let base;

  const arrancar = async (env = {}) => {
    jest.resetModules();
    jest.doMock('../src/config/supabase', () => ({ supabase: { auth: { getUser: jest.fn() } }, createUserClient: jest.fn() }));
    Object.assign(process.env, { ALLOWED_ORIGINS: 'http://permitido.test', RATE_LIMIT_AUTH: '60' }, env);
    const { createApp } = require('../src/app');
    server = createApp().listen(0);
    await new Promise((ok) => server.once('listening', ok));
    base = `http://127.0.0.1:${server.address().port}`;
  };

  afterEach(async () => {
    if (server) await new Promise((ok) => server.close(ok));
    server = null;
  });

  it('health check responde ok con cabeceras de helmet', async () => {
    await arrancar();
    const r = await fetch(`${base}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-powered-by')).toBeNull();
  });

  it('CORS solo autoriza orígenes de la lista', async () => {
    await arrancar();
    const ok = await fetch(`${base}/`, { headers: { Origin: 'http://permitido.test' } });
    const no = await fetch(`${base}/`, { headers: { Origin: 'http://malicioso.test' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://permitido.test');
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('ruta inexistente devuelve 404 en JSON', async () => {
    await arrancar();
    const r = await fetch(`${base}/api/no-existe`);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ status: 'error', message: 'Ruta no encontrada: GET /api/no-existe' });
  });

  it('JSON malformado devuelve 400 sin detalles internos', async () => {
    await arrancar();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await fetch(`${base}/api/viajes/solicitar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"origen":',
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ status: 'error', message: 'Cuerpo de la petición inválido.' });
  });

  it('rate limit de /api/auth responde 429 al superar el límite', async () => {
    await arrancar({ RATE_LIMIT_AUTH: '2' });
    const pedir = () => fetch(`${base}/api/auth/registro`, { method: 'POST' });
    await pedir();
    await pedir();
    const tercera = await pedir();
    expect(tercera.status).toBe(429);
  });
});

describe('sockets · validación y autenticación', () => {
  const crearEntorno = async ({ perfil, perfilError = null } = {}) => {
    jest.resetModules();
    const db = {
      from: jest.fn(() => {
        const q = { select: jest.fn(() => q), eq: jest.fn(() => q), update: jest.fn(() => q), insert: jest.fn(() => q),
          single: jest.fn().mockResolvedValue({ data: perfil, error: perfilError }), then: (ok) => Promise.resolve({ error: null }).then(ok) };
        return q;
      }),
    };
    jest.doMock('../src/config/supabase', () => ({
      supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } }, error: null }) } },
      createUserClient: jest.fn(() => db),
    }));
    const initSocketHandler = require('../src/sockets/socketHandler');
    let middleware; let onConnection;
    const io = { use: (fn) => { middleware = fn; }, on: (_e, fn) => { onConnection = fn; }, to: jest.fn(() => ({ emit: jest.fn() })) };
    initSocketHandler(io);
    const handlers = {};
    const socket = { id: 's1', handshake: { auth: { token: 't' } }, on: (e, fn) => { handlers[e] = fn; },
      emit: jest.fn(), join: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) };
    const next = jest.fn();
    await middleware(socket, next);
    return { socket, next, handlers, onConnection, db };
  };

  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

  it('rechaza la conexión si el usuario no tiene perfil (no asume "pasajero")', async () => {
    const { next } = await crearEntorno({ perfil: null });
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toContain('Perfil');
  });

  it('update_location rechaza coordenadas inválidas sin escribir en la BD', async () => {
    const { socket, next, handlers, onConnection, db } = await crearEntorno({ perfil: { rol: 'conductor', nombre: 'Carla' } });
    expect(next).toHaveBeenCalledWith();
    onConnection(socket);
    db.from.mockClear();
    await handlers.update_location({ sectorId: 'centro', coords: { lat: 999, lng: 0 } });
    expect(socket.emit).toHaveBeenCalledWith('error_message', 'Coordenadas inválidas.');
    expect(db.from).not.toHaveBeenCalled();
  });

  it('join_sector rechaza ids de sala manipulados', async () => {
    const { socket, handlers, onConnection } = await crearEntorno({ perfil: { rol: 'pasajero', nombre: 'Pedro' } });
    onConnection(socket);
    handlers.join_sector({ sectorId: 'centro:../admin' });
    // Solo queda en su sala personal (paso 003, R12); ninguna sala de sector.
    expect(socket.join.mock.calls.map(([sala]) => sala).every((sala) => sala.startsWith('usuario:'))).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('error_message', expect.stringContaining('sector'));
  });

  it('send_message rechaza mensajes de más de 1000 caracteres', async () => {
    const { socket, handlers, onConnection, db } = await crearEntorno({ perfil: { rol: 'pasajero', nombre: 'Pedro' } });
    onConnection(socket);
    db.from.mockClear();
    await handlers.send_message({ threadId: V1, content: 'a'.repeat(1001) });
    expect(socket.emit).toHaveBeenCalledWith('error_message', expect.stringContaining('1000'));
    expect(db.from).not.toHaveBeenCalled();
  });
});

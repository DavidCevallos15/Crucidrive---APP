/**
 * Paso 004 · avisos con la app cerrada y seguimiento del conductor.
 * T3: servicio de ubicación compartido por el socket y POST /api/conductores/ubicacion (plan P11,
 * P14), parámetros de frecuencia (D-13, P12) y límite del respaldo REST.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/config/supabase', () => ({ supabase: {}, createUserClient: jest.fn(), getAdminClient: jest.fn() }));
jest.mock('../src/despacho', () => ({ obtenerDespachador: jest.fn(() => null) }));

const { leerConfigUbicacion, validarConDespacho } = require('../src/ubicacion/config');
const { guardarUbicacion } = require('../src/ubicacion/servicio');
const { actualizarUbicacion } = require('../src/controllers/conductorController');
const initSocketHandler = require('../src/sockets/socketHandler');

const CONDUCTOR = '22222222-2222-2222-2222-222222222222';
const MALECON = { lat: -0.8699838, lng: -80.53995042 };

/** BD falsa: el update de tricimotos devuelve `respuesta` y registra lo que se pidió. */
const crearDb = (respuesta = { data: [{ conductor_id: CONDUCTOR, estado: 'disponible' }], error: null }) => {
  const llamadas = { update: [], eq: [], select: [] };
  const q = {
    update: jest.fn((v) => { llamadas.update.push(v); return q; }),
    eq: jest.fn((...a) => { llamadas.eq.push(a); return q; }),
    select: jest.fn((c) => { llamadas.select.push(c); return Promise.resolve(respuesta); }),
  };
  return { db: { from: jest.fn(() => q) }, llamadas };
};

const conductor = { id: CONDUCTOR, rol: 'conductor', nombre: 'Carla' };

describe('T3 · frecuencia de ubicación (D-13, plan P12)', () => {
  test('valores por defecto: 5 s abierta, 10 s en movimiento y 30 s detenido', () => {
    expect(leerConfigUbicacion({})).toEqual({ abiertaSeg: 5, fondoMovSeg: 10, fondoQuietoSeg: 30 });
  });

  test('se ajustan por el entorno sin publicar la app', () => {
    expect(leerConfigUbicacion({ UBICACION_FONDO_MOV_SEG: '15', UBICACION_FONDO_QUIETO_SEG: '45' }))
      .toMatchObject({ fondoMovSeg: 15, fondoQuietoSeg: 45 });
  });

  test('un valor inválido detiene el arranque', () => {
    expect(() => leerConfigUbicacion({ UBICACION_ABIERTA_SEG: '0' })).toThrow('UBICACION_ABIERTA_SEG');
    expect(() => leerConfigUbicacion({ UBICACION_FONDO_MOV_SEG: 'diez' })).toThrow('UBICACION_FONDO_MOV_SEG');
    expect(() => leerConfigUbicacion({ UBICACION_FONDO_MOV_SEG: '40', UBICACION_FONDO_QUIETO_SEG: '20' })).toThrow('menor');
  });

  test('criterio 19: detenido debe enviar antes de que el despacho lo dé por perdido (60 s)', () => {
    expect(() => validarConDespacho({ fondoQuietoSeg: 30 }, { ubicacionMaxSeg: 60 })).not.toThrow();
    expect(() => validarConDespacho({ fondoQuietoSeg: 60 }, { ubicacionMaxSeg: 60 })).toThrow('DESPACHO_UBICACION_MAX_SEG');
  });
});

describe('T3 · la app recibe la frecuencia al ponerse disponible (plan P12)', () => {
  test('PATCH /disponibilidad devuelve estado y parámetros de ubicación', async () => {
    const { cambiarDisponibilidad } = require('../src/controllers/conductorController');
    const cola = [
      { data: { estado: 'inactivo' }, error: null },
      { data: [{ estado: 'disponible', disponible_desde: '2026-10-09T12:00:00Z' }], error: null },
    ];
    const q = {
      select: () => q, eq: () => q, update: () => q,
      maybeSingle: () => Promise.resolve(cola.shift()),
      then: (ok, mal) => Promise.resolve(cola.shift()).then(ok, mal),
    };
    const r = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await cambiarDisponibilidad({ body: { disponible: true }, user: { id: CONDUCTOR }, supabase: { from: () => q } }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0].data).toMatchObject({
      estado: 'disponible',
      ubicacion: { abiertaSeg: 5, fondoMovSeg: 10, fondoQuietoSeg: 30 },
    });
  });
});

describe('T3 · servicio de ubicación (plan P14)', () => {
  test('guarda solo la última posición con el JWT del conductor y la reenvía a su sector', async () => {
    const { db, llamadas } = crearDb();
    const emitir = jest.fn();
    const r = await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(r).toEqual({ ok: true, estado: 'disponible' });
    expect(db.from).toHaveBeenCalledWith('tricimotos');
    expect(llamadas.update[0]).toEqual({ ubicacion_actual: `POINT(${MALECON.lng} ${MALECON.lat})`, sector_id: 'malecon' });
    expect(llamadas.eq[0]).toEqual(['conductor_id', CONDUCTOR]);
    // Columnas explícitas: desde la 0014 nadie puede leer ubicacion_actual.
    expect(llamadas.select[0]).not.toMatch(/\*|ubicacion_actual/);
    expect(emitir).toHaveBeenCalledWith('sector:malecon', 'location_updated', {
      conductorId: CONDUCTOR, nombre: 'Carla', coords: MALECON, estado: 'disponible',
    });
  });

  test('un pasajero no puede enviar ubicación de conductor (403 sin tocar la BD)', async () => {
    const { db } = crearDb();
    const r = await guardarUbicacion({ db, usuario: { id: 'p', rol: 'pasajero' }, sectorId: 'malecon', coords: MALECON, emitir: jest.fn() });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(db.from).not.toHaveBeenCalled();
  });

  test.each([
    ['sector manipulado', { sectorId: "malecon'; drop", coords: MALECON }, 'incompletos'],
    ['sin coordenadas', { sectorId: 'malecon', coords: undefined }, 'incompletos'],
    ['coordenadas fuera de rango', { sectorId: 'malecon', coords: { lat: 999, lng: 0 } }, 'inválidas'],
    ['coordenadas que no son números', { sectorId: 'malecon', coords: { lat: 'x', lng: 'y' } }, 'inválidas'],
  ])('%s → 400 sin tocar la BD', async (_n, entrada, mensaje) => {
    const { db } = crearDb();
    const r = await guardarUbicacion({ db, usuario: conductor, emitir: jest.fn(), ...entrada });
    expect(r).toMatchObject({ ok: false, status: 400, mensaje: expect.stringContaining(mensaje) });
    expect(db.from).not.toHaveBeenCalled();
  });

  test('un conductor sin aprobar (la RLS no actualiza filas) recibe 403 y no se reenvía nada', async () => {
    const { db } = crearDb({ data: [], error: null });
    const emitir = jest.fn();
    const r = await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(emitir).not.toHaveBeenCalled();
  });

  test('un error de la BD responde 500 sin detalles internos', async () => {
    const { db } = crearDb({ data: null, error: { message: 'connection reset' } });
    const r = await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir: jest.fn() });
    expect(r).toEqual({ ok: false, status: 500, mensaje: 'Error al guardar la ubicación.' });
  });
});

describe('T3 · el socket y el respaldo REST hacen lo mismo (plan P11)', () => {
  const conectarPorSocket = (db) => {
    let alConectar;
    const io = { use: () => {}, on: (evento, fn) => { if (evento === 'connection') alConectar = fn; } };
    initSocketHandler(io, { conexiones: { agregar: () => {}, quitar: () => {} } });
    const manejadores = {};
    const salas = [];
    const socket = {
      id: 's1',
      user: conductor,
      supabase: db,
      join: () => {},
      emit: jest.fn(),
      to: jest.fn((sala) => { salas.push(sala); return { emit: jest.fn() }; }),
      on: (evento, fn) => { manejadores[evento] = fn; },
    };
    alConectar(socket);
    return { socket, manejadores, salas };
  };

  const pedirPorRest = async (db, body) => {
    const salas = [];
    const io = { to: jest.fn((sala) => { salas.push(sala); return { emit: jest.fn() }; }) };
    const r = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), end: jest.fn() };
    await actualizarUbicacion({ body, user: { id: CONDUCTOR, rol: 'conductor' }, supabase: db, app: { get: () => io } }, r);
    return { r, salas };
  };

  test('una ubicación válida se guarda y se reenvía al sector por ambas vías', async () => {
    const porSocket = crearDb();
    const { manejadores, salas: salasSocket } = conectarPorSocket(porSocket.db);
    await manejadores.update_location({ sectorId: 'malecon', coords: MALECON });

    const porRest = crearDb();
    const { r, salas: salasRest } = await pedirPorRest(porRest.db, { sectorId: 'malecon', coords: MALECON });

    expect(porRest.llamadas.update).toEqual(porSocket.llamadas.update);
    expect(salasSocket).toEqual(['sector:malecon']);
    expect(salasRest).toEqual(['sector:malecon']);
    // REST responde 204 sin cuerpo: cada byte cuenta en segundo plano (criterio 18).
    expect(r.status).toHaveBeenCalledWith(204);
    expect(r.json).not.toHaveBeenCalled();
  });

  test('el mismo error por ambas vías: mensaje por socket, código HTTP por REST', async () => {
    const malas = { sectorId: 'malecon', coords: { lat: 999, lng: 0 } };
    const { socket, manejadores } = conectarPorSocket(crearDb().db);
    await manejadores.update_location(malas);
    expect(socket.emit).toHaveBeenCalledWith('error_message', 'Coordenadas inválidas.');

    const { r } = await pedirPorRest(crearDb().db, malas);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toBe('Coordenadas inválidas.');
  });

  test('si llega "estado" en el envío se ignora (R10 del 003)', async () => {
    const { db, llamadas } = crearDb();
    await pedirPorRest(db, { sectorId: 'malecon', coords: MALECON, estado: 'ocupado' });
    expect(llamadas.update[0]).not.toHaveProperty('estado');
  });
});

describe('T3 · límite del respaldo REST por conductor', () => {
  const express = require('express');
  let servidor;
  let base;

  beforeAll(async () => {
    jest.resetModules();
    jest.doMock('../src/middlewares/authMiddleware', () => (req, _res, next) => {
      req.user = { id: req.headers['x-usuario'] };
      next();
    });
    jest.doMock('../src/middlewares/roleMiddleware', () => () => (req, _res, next) => { req.user.rol = 'conductor'; next(); });
    jest.doMock('../src/controllers/conductorController', () => ({
      enviarVerificacion: jest.fn(), obtenerMiVerificacion: jest.fn(), cambiarDisponibilidad: jest.fn(),
      actualizarUbicacion: (_req, res) => res.status(204).end(),
    }));
    const app = express();
    app.use(express.json());
    app.use('/api/conductores', require('../src/routes/conductorRoutes'));
    await new Promise((ok) => { servidor = app.listen(0, ok); });
    base = `http://127.0.0.1:${servidor.address().port}/api/conductores/ubicacion`;
  });

  afterAll(() => new Promise((ok) => servidor.close(ok)));

  const enviar = (usuario) => fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-usuario': usuario },
    body: JSON.stringify({ sectorId: 'malecon', coords: MALECON }),
  });

  test('2 envíos cada 5 s; el tercero responde 429', async () => {
    expect((await enviar('c1')).status).toBe(204);
    expect((await enviar('c1')).status).toBe(204);
    const tercero = await enviar('c1');
    expect(tercero.status).toBe(429);
    expect((await tercero.json()).message).toContain('demasiado seguido');
  });

  test('el límite es por conductor, no por IP (CGNAT de las operadoras)', async () => {
    expect((await enviar('c2')).status).toBe(204);
  });
});

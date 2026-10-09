/**
 * Paso 004 · avisos con la app cerrada y seguimiento del conductor.
 * T3: servicio de ubicación compartido por el socket y POST /api/conductores/ubicacion (plan P11,
 * P14), parámetros de frecuencia (D-13, P12) y límite del respaldo REST.
 * T4: durante un viaje la posición del conductor va solo a su pasajero (criterios 13, 14 y 15).
 * T7: consentimiento 0.2 antes de ponerse disponible (criterio 5; plan P18).
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

/**
 * BD falsa: el update de tricimotos devuelve `respuesta` y registra lo que se pidió; la consulta
 * del viaje activo del conductor devuelve `viaje`.
 */
const crearDb = (respuesta = { data: [{ conductor_id: CONDUCTOR, estado: 'disponible' }], error: null }, viaje = { data: null, error: null }) => {
  const llamadas = { update: [], eq: [], select: [], viajes: [] };
  const q = {
    update: jest.fn((v) => { llamadas.update.push(v); return q; }),
    eq: jest.fn((...a) => { llamadas.eq.push(a); return q; }),
    select: jest.fn((c) => { llamadas.select.push(c); return Promise.resolve(respuesta); }),
  };
  const qViajes = {
    select: (c) => { llamadas.viajes.push(['select', c]); return qViajes; },
    eq: (...a) => { llamadas.viajes.push(['eq', ...a]); return qViajes; },
    in: (...a) => { llamadas.viajes.push(['in', ...a]); return qViajes; },
    limit: () => qViajes,
    maybeSingle: () => Promise.resolve(viaje),
  };
  return { db: { from: jest.fn((tabla) => (tabla === 'viajes' ? qViajes : q)) }, llamadas };
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
      { data: { id: 1 }, error: null }, // consentimiento vigente (T7)
      { data: [{ estado: 'disponible', disponible_desde: '2026-10-09T12:00:00Z' }], error: null },
    ];
    const q = {
      select: () => q, eq: () => q, limit: () => q, update: () => q,
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

describe('T4 · el pasajero ve a su conductor acercarse (criterios 13, 14 y 15)', () => {
  const PASAJERO = '11111111-1111-1111-1111-111111111111';
  const VIAJE = '0a1b2c3d-0000-4000-8000-000000000001';
  const ocupado = { data: [{ conductor_id: CONDUCTOR, estado: 'ocupado' }], error: null };

  test('con un viaje aceptado, la posición va solo a la sala del pasajero de ese viaje', async () => {
    const { db, llamadas } = crearDb(ocupado, { data: { id: VIAJE, pasajero_id: PASAJERO }, error: null });
    const emitir = jest.fn();
    const r = await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(r).toEqual({ ok: true, estado: 'ocupado' });
    expect(emitir).toHaveBeenCalledTimes(1);
    const [sala, evento, datos] = emitir.mock.calls[0];
    expect(sala).toBe(`usuario:${PASAJERO}`);
    expect(evento).toBe('conductor_ubicacion');
    expect(datos).toEqual({ viajeId: VIAJE, lat: MALECON.lat, lng: MALECON.lng, en: expect.any(String) });
    // El viaje se busca con el JWT del conductor y solo entre los activos.
    expect(llamadas.viajes).toEqual(expect.arrayContaining([
      ['eq', 'conductor_id', CONDUCTOR],
      ['in', 'estado', ['aceptado', 'en_curso']],
    ]));
  });

  test('criterio 14: un conductor ocupado ya no se reenvía al sector (nadie más lo sigue)', async () => {
    const { db } = crearDb(ocupado, { data: { id: VIAJE, pasajero_id: PASAJERO }, error: null });
    const emitir = jest.fn();
    await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(emitir.mock.calls.map(([sala]) => sala)).not.toContain('sector:malecon');
  });

  test('criterio 15: sin viaje activo (terminó o se canceló) no se envía a nadie', async () => {
    const { db } = crearDb(ocupado, { data: null, error: null });
    const emitir = jest.fn();
    await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(emitir).not.toHaveBeenCalled();
  });

  test('un conductor no disponible (inactivo) no se reenvía a nadie', async () => {
    const { db } = crearDb({ data: [{ conductor_id: CONDUCTOR, estado: 'inactivo' }], error: null });
    const emitir = jest.fn();
    const r = await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(r).toEqual({ ok: true, estado: 'inactivo' });
    expect(emitir).not.toHaveBeenCalled();
  });

  test('si falla la lectura del viaje, la ubicación igual queda guardada y no se filtra a nadie', async () => {
    const { db } = crearDb(ocupado, { data: null, error: { message: 'timeout' } });
    const emitir = jest.fn();
    const r = await guardarUbicacion({ db, usuario: conductor, sectorId: 'malecon', coords: MALECON, emitir });
    expect(r.ok).toBe(true);
    expect(emitir).not.toHaveBeenCalled();
  });

  test('por REST (segundo plano) también llega al pasajero', async () => {
    const { db } = crearDb(ocupado, { data: { id: VIAJE, pasajero_id: PASAJERO }, error: null });
    const salas = [];
    const io = { to: jest.fn((sala) => { salas.push(sala); return { emit: jest.fn() }; }) };
    const r = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), end: jest.fn() };
    await actualizarUbicacion({ body: { sectorId: 'malecon', coords: MALECON }, user: { id: CONDUCTOR, rol: 'conductor' }, supabase: db, app: { get: () => io } }, r);
    expect(salas).toEqual([`usuario:${PASAJERO}`]);
  });
});

describe('T7 · consentimiento 0.2 para estar disponible (criterio 5; plan P18)', () => {
  const { cambiarDisponibilidad } = require('../src/controllers/conductorController');
  const { aceptarConsentimiento } = require('../src/controllers/authController');
  const { CONSENT_VERSION } = require('../src/config/consent');

  /** BD falsa en secuencia; registra los filtros de la consulta de consentimientos. */
  const pedir = async (body, respuestas) => {
    const cola = [...respuestas];
    const filtros = [];
    const updates = [];
    const q = {
      select: () => q,
      eq: (k, v) => { filtros.push([k, v]); return q; },
      limit: () => q,
      update: (v) => { updates.push(v); return q; },
      maybeSingle: () => Promise.resolve(cola.shift() || { data: null, error: null }),
      then: (ok, mal) => Promise.resolve(cola.shift() || { data: null, error: null }).then(ok, mal),
    };
    const r = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await cambiarDisponibilidad({ body, user: { id: CONDUCTOR }, supabase: { from: () => q } }, r);
    return { r, filtros, updates };
  };

  test('la versión vigente es la 0.2', () => {
    expect(CONSENT_VERSION).toBe('0.2');
  });

  test('sin haber aceptado la 0.2, ponerse disponible responde 428 y no toca la tricimoto', async () => {
    const { r, filtros, updates } = await pedir({ disponible: true }, [
      { data: { estado: 'inactivo' }, error: null },
      { data: null, error: null },
    ]);
    expect(r.status).toHaveBeenCalledWith(428);
    expect(r.json.mock.calls[0][0].message).toContain('0.2');
    expect(filtros).toEqual(expect.arrayContaining([['user_id', CONDUCTOR], ['version', '0.2']]));
    expect(updates).toEqual([]);
  });

  test('con la 0.2 aceptada se pone disponible', async () => {
    const { r, updates } = await pedir({ disponible: true }, [
      { data: { estado: 'inactivo' }, error: null },
      { data: { id: 7 }, error: null },
      { data: [{ estado: 'disponible', disponible_desde: null }], error: null },
    ]);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(updates).toEqual([{ estado: 'disponible' }]);
  });

  test('dejar de estar disponible no exige el consentimiento nuevo', async () => {
    const { r, filtros } = await pedir({ disponible: false }, [
      { data: { estado: 'disponible' }, error: null },
      { data: [], error: null },
      { data: [{ estado: 'inactivo', disponible_desde: null }], error: null },
    ]);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(filtros).not.toContainEqual(['version', '0.2']);
  });

  test('volver a aceptar guarda la versión del servidor, no la que mande la app', async () => {
    const insertados = [];
    const db = { from: () => ({ insert: (filas) => { insertados.push(...filas); return Promise.resolve({ error: null }); } }) };
    const r = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await aceptarConsentimiento({ body: { consentimiento: true, version: '9.9' }, user: { id: CONDUCTOR }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(insertados).toEqual([{ user_id: CONDUCTOR, version: '0.2' }]);
  });

  test('sin "consentimiento: true" no registra nada', async () => {
    const db = { from: jest.fn() };
    const r = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await aceptarConsentimiento({ body: { consentimiento: 'si' }, user: { id: CONDUCTOR }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });
});

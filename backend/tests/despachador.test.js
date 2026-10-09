/**
 * Paso 003 · despacho en el backend.
 * T7: parámetros (R21), registro de conexiones (R6), sala por usuario y hora del servidor (R12, R14)
 * y update_location sin "estado" (R10).
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/config/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() } },
  createUserClient: jest.fn(),
  getAdminClient: jest.fn(),
}));

const { leerConfigDespacho } = require('../src/despacho/config');
const { RegistroConexiones } = require('../src/despacho/conexiones');
const initSocketHandler = require('../src/sockets/socketHandler');

/** Servidor y socket falsos: guardan los manejadores y lo que se emite. */
const crearIoFalso = () => {
  const io = { middlewares: [], alConectar: null, emitidos: [] };
  io.use = (fn) => io.middlewares.push(fn);
  io.on = (evento, fn) => { if (evento === 'connection') io.alConectar = fn; };
  io.to = (sala) => ({ emit: (evento, datos) => io.emitidos.push({ sala, evento, datos }) });
  return io;
};

const crearSocketFalso = (user, db) => {
  const socket = {
    id: `sock-${Math.random().toString(36).slice(2)}`,
    user,
    supabase: db,
    salas: [],
    emitidos: [],
    alSector: [],
    manejadores: {},
  };
  socket.join = (sala) => socket.salas.push(sala);
  socket.emit = (evento, datos) => socket.emitidos.push({ evento, datos });
  socket.on = (evento, fn) => { socket.manejadores[evento] = fn; };
  socket.to = (sala) => ({ emit: (evento, datos) => socket.alSector.push({ sala, evento, datos }) });
  return socket;
};

/** Cliente de Supabase falso para tricimotos.update().eq().select(). */
const crearDbTricimotos = (resultado) => {
  const llamadas = { update: null, select: null };
  const db = {
    from: jest.fn(() => ({
      update: (valores) => {
        llamadas.update = valores;
        return {
          eq: () => ({
            select: (cols) => { llamadas.select = cols; return Promise.resolve(resultado); },
          }),
        };
      },
    })),
  };
  return { db, llamadas };
};

const CONDUCTOR = { id: '22222222-2222-2222-2222-222222222222', email: 'c@x', rol: 'conductor', nombre: 'Carla' };

const conectar = (user, db, conexiones = new RegistroConexiones()) => {
  const io = crearIoFalso();
  initSocketHandler(io, { conexiones });
  const socket = crearSocketFalso(user, db);
  io.alConectar(socket);
  return { io, socket, conexiones };
};

describe('T7 · parámetros del despacho (R21)', () => {
  test('sin variables usa los valores de D-11', () => {
    expect(leerConfigDespacho({})).toEqual({
      secuenciales: 3, ofertaSeg: 15, maxSeg: 120, ubicacionMaxSeg: 60, barridoSeg: 15,
    });
  });

  test('lee valores válidos del entorno', () => {
    expect(leerConfigDespacho({ DESPACHO_SECUENCIALES: '2', DESPACHO_OFERTA_SEG: '20' }))
      .toMatchObject({ secuenciales: 2, ofertaSeg: 20 });
  });

  test.each([
    ['DESPACHO_OFERTA_SEG', 'quince'],
    ['DESPACHO_OFERTA_SEG', '2'],
    ['DESPACHO_SECUENCIALES', '0'],
    ['DESPACHO_MAX_SEG', '1.5'],
    ['DESPACHO_UBICACION_MAX_SEG', '9999'],
  ])('un valor inválido (%s=%s) impide arrancar', (nombre, valor) => {
    expect(() => leerConfigDespacho({ [nombre]: valor })).toThrow(nombre);
  });

  test('la fase secuencial debe dejar tiempo para el aviso abierto', () => {
    expect(() => leerConfigDespacho({ DESPACHO_SECUENCIALES: '8', DESPACHO_OFERTA_SEG: '15' })).toThrow('DESPACHO_MAX_SEG');
  });
});

describe('T7 · registro de conexiones (R6)', () => {
  test('un usuario sigue conectado mientras le quede algún socket', () => {
    const r = new RegistroConexiones();
    r.agregar('u1', 'a');
    r.agregar('u1', 'b');
    r.quitar('u1', 'a');
    expect(r.estaConectado('u1')).toBe(true);
    r.quitar('u1', 'b');
    expect(r.estaConectado('u1')).toBe(false);
    expect(() => r.quitar('nadie', 'x')).not.toThrow();
  });
});

describe('T7 · conexión por socket (R12, R14)', () => {
  test('al conectar entra a su sala personal, queda registrado y recibe la hora del servidor', () => {
    const antes = Date.now();
    const { socket, conexiones } = conectar(CONDUCTOR, {});
    expect(socket.salas).toContain(`usuario:${CONDUCTOR.id}`);
    expect(conexiones.estaConectado(CONDUCTOR.id)).toBe(true);
    const hora = socket.emitidos.find((e) => e.evento === 'hora_servidor');
    expect(hora.datos.ahora).toBeGreaterThanOrEqual(antes);
  });

  test('al desconectarse deja de contar como conectado', () => {
    const { socket, conexiones } = conectar(CONDUCTOR, {});
    socket.manejadores.disconnect();
    expect(conexiones.estaConectado(CONDUCTOR.id)).toBe(false);
  });
});

describe('T7 · update_location solo cambia ubicación y sector (R10)', () => {
  test('ignora el "estado" que envía la app y avisa al sector con el estado real de la BD', async () => {
    const { db, llamadas } = crearDbTricimotos({ data: [{ conductor_id: CONDUCTOR.id, estado: 'ocupado' }], error: null });
    const { socket } = conectar(CONDUCTOR, db);
    await socket.manejadores.update_location({ sectorId: 'malecon', coords: { lat: -0.87, lng: -80.54 }, estado: 'disponible' });
    expect(llamadas.update).toEqual({ ubicacion_actual: 'POINT(-80.54 -0.87)', sector_id: 'malecon' });
    expect(llamadas.update).not.toHaveProperty('estado');
    expect(socket.alSector).toEqual([{
      sala: 'sector:malecon',
      evento: 'location_updated',
      datos: { conductorId: CONDUCTOR.id, nombre: 'Carla', coords: { lat: -0.87, lng: -80.54 }, estado: 'ocupado' },
    }]);
  });

  test('un conductor sin aprobar recibe el aviso y no se difunde nada', async () => {
    const { db } = crearDbTricimotos({ data: [], error: null });
    const { socket } = conectar(CONDUCTOR, db);
    await socket.manejadores.update_location({ sectorId: 'malecon', coords: { lat: -0.87, lng: -80.54 } });
    expect(socket.emitidos.map((e) => e.datos)).toContain('Tu cuenta de conductor aún no está aprobada.');
    expect(socket.alSector).toHaveLength(0);
  });

  test('un pasajero no puede enviar ubicación', async () => {
    const { db } = crearDbTricimotos({ data: [], error: null });
    const { socket } = conectar({ ...CONDUCTOR, rol: 'pasajero' }, db);
    await socket.manejadores.update_location({ sectorId: 'malecon', coords: { lat: -0.87, lng: -80.54 } });
    expect(db.from).not.toHaveBeenCalled();
  });
});

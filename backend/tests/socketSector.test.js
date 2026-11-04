/**
 * Paso 007 · T3, T4 y T6: join_sector con una sola sala, solo sectores del catálogo, tope de
 * cambios por minuto y logs sin nombre (criterios 1, 2 y 6; plan P1 y P5).
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

const mockGetUser = jest.fn();
jest.mock('../src/config/supabase', () => ({
  supabase: { auth: { getUser: (...a) => mockGetUser(...a) } },
  createUserClient: jest.fn(),
  getAdminClient: jest.fn(),
}));

const { createUserClient } = require('../src/config/supabase');
const initSocketHandler = require('../src/sockets/socketHandler');
const { crearCatalogoSectores } = require('../src/sockets/sectores');
const { RegistroConexiones } = require('../src/despacho/conexiones');

const PEDRO = { id: '11111111-1111-1111-1111-111111111111', email: 'p@x', rol: 'pasajero' };
const SECTORES = ['la_boca', 'las_gilces', 'los_arenales', 'malecon', 'la_loma'];

/** BD falsa: solo responde el catálogo de sectores activos y cuenta las lecturas. */
const crearDbSectores = (ids = SECTORES) => {
  const db = { lecturas: 0 };
  db.from = jest.fn((tabla) => {
    if (tabla !== 'sectores') throw new Error(`tabla inesperada: ${tabla}`);
    return {
      select: () => ({
        eq: (col, valor) => {
          db.lecturas += 1;
          expect([col, valor]).toEqual(['activo', true]);
          return Promise.resolve({ data: ids.map((id) => ({ id })), error: null });
        },
      }),
    };
  });
  return db;
};

const crearSocket = (db) => {
  const socket = { id: 'sock-1', user: PEDRO, supabase: db, salas: new Set(), emitidos: [], manejadores: {} };
  socket.join = (sala) => socket.salas.add(sala);
  socket.leave = (sala) => socket.salas.delete(sala);
  socket.emit = (evento, datos) => socket.emitidos.push({ evento, datos });
  socket.on = (evento, fn) => { socket.manejadores[evento] = fn; };
  socket.to = () => ({ emit: () => {} });
  return socket;
};

const conectar = ({ db = crearDbSectores(), config = { cambiosSectorPorMin: 6 }, sectores = crearCatalogoSectores() } = {}) => {
  let alConectar;
  const io = { use: () => {}, on: (_e, fn) => { alConectar = fn; }, to: () => ({ emit: () => {} }) };
  initSocketHandler(io, { conexiones: new RegistroConexiones(), config, sectores });
  const socket = crearSocket(db);
  alConectar(socket);
  return { socket, db };
};

const salasDeSector = (socket) => [...socket.salas].filter((s) => s.startsWith('sector:'));

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('T4 · una sola sala de sector (criterio 1)', () => {
  test('unirse a otro sector saca del anterior', async () => {
    const { socket } = conectar();
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    expect(salasDeSector(socket)).toEqual(['sector:malecon']);
    await socket.manejadores.join_sector({ sectorId: 'la_loma' });
    expect(salasDeSector(socket)).toEqual(['sector:la_loma']);
    // La sala personal no se toca.
    expect(socket.salas.has(`usuario:${PEDRO.id}`)).toBe(true);
  });

  test('no se puede escuchar todos los sectores a la vez', async () => {
    const { socket } = conectar();
    for (const sectorId of SECTORES) await socket.manejadores.join_sector({ sectorId });
    expect(salasDeSector(socket)).toHaveLength(1);
  });

  test('repetir el mismo sector no gasta el tope', async () => {
    const { socket } = conectar({ config: { cambiosSectorPorMin: 1 } });
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    expect(socket.emitidos.filter((e) => e.evento === 'error_message')).toHaveLength(0);
  });

  test('el cambio 7 en un minuto se ignora y no cambia el sector', async () => {
    const { socket } = conectar();
    const recorrido = ['malecon', 'la_loma', 'la_boca', 'las_gilces', 'los_arenales', 'malecon'];
    for (const sectorId of recorrido) await socket.manejadores.join_sector({ sectorId });
    expect(salasDeSector(socket)).toEqual(['sector:malecon']);
    await socket.manejadores.join_sector({ sectorId: 'la_loma' });
    expect(salasDeSector(socket)).toEqual(['sector:malecon']);
    expect(socket.emitidos.at(-1)).toEqual({ evento: 'error_message', datos: expect.stringContaining('demasiado seguido') });
  });

  test('pasado un minuto se puede volver a cambiar', async () => {
    const reloj = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const { socket } = conectar({ config: { cambiosSectorPorMin: 1 } });
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    await socket.manejadores.join_sector({ sectorId: 'la_loma' });
    expect(salasDeSector(socket)).toEqual(['sector:malecon']);
    reloj.mockReturnValue(1_000_000 + 60_000);
    await socket.manejadores.join_sector({ sectorId: 'la_loma' });
    expect(salasDeSector(socket)).toEqual(['sector:la_loma']);
  });
});

describe('T3 · solo sectores del catálogo (criterio 2)', () => {
  test('un sector que no existe se rechaza con un mensaje genérico y no se une a nada', async () => {
    const { socket } = conectar();
    await socket.manejadores.join_sector({ sectorId: 'centro' });
    expect(salasDeSector(socket)).toEqual([]);
    expect(socket.emitidos.at(-1)).toEqual({ evento: 'error_message', datos: 'El identificador del sector (sectorId) no es válido.' });
  });

  test('un intento con un sector inexistente también gasta el tope', async () => {
    const { socket } = conectar({ config: { cambiosSectorPorMin: 1 } });
    await socket.manejadores.join_sector({ sectorId: 'centro' });
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    expect(salasDeSector(socket)).toEqual([]);
  });

  test('si el catálogo no se puede leer, no se une a nada y no expone el error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const db = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'permission denied for table sectores' } }) }) }) };
    const { socket } = conectar({ db });
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    expect(salasDeSector(socket)).toEqual([]);
    expect(socket.emitidos.at(-1).datos).not.toContain('permission');
  });

  test('el catálogo se lee una vez y se vuelve a leer pasados 10 min', async () => {
    const db = crearDbSectores();
    const catalogo = crearCatalogoSectores();
    expect(await catalogo.existe(db, 'malecon', 0)).toBe(true);
    expect(await catalogo.existe(db, 'la_loma', 60_000)).toBe(true);
    expect(db.lecturas).toBe(1);
    expect(await catalogo.existe(db, 'malecon', 10 * 60 * 1000)).toBe(true);
    expect(db.lecturas).toBe(2);
  });

  test('un sector inactivo no está en el catálogo', async () => {
    const catalogo = crearCatalogoSectores();
    expect(await catalogo.existe(crearDbSectores(['malecon']), 'la_loma', 0)).toBe(false);
  });
});

describe('T6 · logs del socket sin nombre (criterio 6)', () => {
  test('al conectar, unirse a un sector y salir no se registra el nombre', async () => {
    const db = {
      from: jest.fn((tabla) => (tabla === 'perfiles'
        ? { select: (cols) => ({ eq: () => ({ single: () => Promise.resolve({ data: { rol: 'pasajero', nombre: 'Pedro Alcívar', cols }, error: null }) }) }) }
        : crearDbSectores().from(tabla))),
    };
    createUserClient.mockReturnValue(db);
    mockGetUser.mockResolvedValue({ data: { user: { id: PEDRO.id, email: PEDRO.email } }, error: null });

    let middleware; let alConectar;
    const io = { use: (fn) => { middleware = fn; }, on: (_e, fn) => { alConectar = fn; }, to: () => ({ emit: () => {} }) };
    initSocketHandler(io, { conexiones: new RegistroConexiones(), config: { cambiosSectorPorMin: 6 }, sectores: crearCatalogoSectores() });
    const socket = crearSocket(null);
    socket.handshake = { auth: { token: 't' } };
    delete socket.user;
    await middleware(socket, () => {});
    expect(socket.user).toEqual({ id: PEDRO.id, email: PEDRO.email, rol: 'pasajero' });

    alConectar(socket);
    await socket.manejadores.join_sector({ sectorId: 'malecon' });
    socket.manejadores.disconnect();

    const lineas = console.log.mock.calls.map((args) => args.join(' '));
    expect(lineas.length).toBeGreaterThanOrEqual(3);
    for (const linea of lineas) {
      expect(linea).not.toMatch(/Pedro|Alcívar/);
      expect(linea).toContain(PEDRO.id);
    }
  });
});

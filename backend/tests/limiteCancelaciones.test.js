/**
 * Paso 007 · T10: tope de cancelaciones del pasajero (criterios 12 y 13; plan P8; E2).
 * Con 5 cancelaciones propias en 60 min no puede pedir durante 30 min, contados desde la última.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/config/supabase', () => ({ supabase: {}, createUserClient: jest.fn(), getAdminClient: jest.fn() }));

const mockDespachador = { iniciar: jest.fn() };
jest.mock('../src/despacho', () => ({ obtenerDespachador: jest.fn(() => mockDespachador) }));

const {
  LIMITES, leerConfigCancelaciones, evaluarCancelaciones, revisarCancelaciones,
} = require('../src/viaje/limiteCancelaciones');
const { solicitarViaje } = require('../src/controllers/viajeController');

const PASAJERO = '11111111-1111-1111-1111-111111111111';
const VIAJE = '0a1b2c3d-0000-4000-8000-000000000001';
const MIN = 60 * 1000;
const AHORA = Date.parse('2026-11-19T20:00:00Z');
const CONFIG = { max: 5, ventanaMin: 60, bloqueoMin: 30 };
const hace = (min, base = AHORA) => new Date(base - min * MIN).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('T10 · configuración (criterio 13)', () => {
  test('por defecto: 5 en 60 min dejan 30 min sin pedir (E2)', () => {
    expect(leerConfigCancelaciones({})).toEqual({ max: 5, ventanaMin: 60, bloqueoMin: 30 });
    expect(Object.keys(LIMITES)).toEqual(['CANCELACIONES_MAX', 'CANCELACIONES_VENTANA_MIN', 'CANCELACIONES_BLOQUEO_MIN']);
  });

  test('lee valores válidos del entorno', () => {
    expect(leerConfigCancelaciones({ CANCELACIONES_MAX: '3', CANCELACIONES_VENTANA_MIN: '120', CANCELACIONES_BLOQUEO_MIN: '15' }))
      .toEqual({ max: 3, ventanaMin: 120, bloqueoMin: 15 });
  });

  test.each([
    ['CANCELACIONES_MAX', '0'],
    ['CANCELACIONES_MAX', '51'],
    ['CANCELACIONES_MAX', 'cinco'],
    ['CANCELACIONES_VENTANA_MIN', '4'],
    ['CANCELACIONES_VENTANA_MIN', '1441'],
    ['CANCELACIONES_BLOQUEO_MIN', '2.5'],
  ])('%s=%s detiene el arranque y dice qué valor falla', (nombre, valor) => {
    expect(() => leerConfigCancelaciones({ [nombre]: valor })).toThrow(nombre);
  });

  test('el controlador lee la configuración al cargar: un valor inválido impide arrancar', () => {
    const antes = process.env.CANCELACIONES_MAX;
    process.env.CANCELACIONES_MAX = '0';
    try {
      jest.isolateModules(() => {
        expect(() => require('../src/controllers/viajeController')).toThrow('CANCELACIONES_MAX');
      });
    } finally {
      if (antes === undefined) delete process.env.CANCELACIONES_MAX;
      else process.env.CANCELACIONES_MAX = antes;
    }
  });
});

describe('T10 · evaluación (función pura)', () => {
  test('con 4 en la ventana no bloquea', () => {
    expect(evaluarCancelaciones([hace(1), hace(5), hace(10), hace(20)], AHORA, CONFIG))
      .toEqual({ llevas: 4, bloqueadoHasta: null });
  });

  test('con 5 bloquea 30 min desde la última', () => {
    const r = evaluarCancelaciones([hace(2), hace(5), hace(10), hace(20), hace(40)], AHORA, CONFIG);
    expect(r).toEqual({ llevas: 5, bloqueadoHasta: AHORA - 2 * MIN + 30 * MIN });
  });

  test('las de fuera de la ventana no cuentan', () => {
    expect(evaluarCancelaciones([hace(2), hace(5), hace(10), hace(20), hace(61)], AHORA, CONFIG).bloqueadoHasta).toBeNull();
  });

  test('pasado el bloqueo vuelve a poder pedir', () => {
    expect(evaluarCancelaciones([hace(31), hace(35), hace(40), hace(45), hace(50)], AHORA, CONFIG).bloqueadoHasta).toBeNull();
  });

  test('fechas inválidas o vacías no cuentan', () => {
    expect(evaluarCancelaciones([null, undefined, 'no-es-fecha'], AHORA, CONFIG)).toEqual({ llevas: 0, bloqueadoHasta: null });
  });
});

/** Consulta falsa: registra los filtros y resuelve con `data` al final de la cadena (gte). */
const crearDbCancelaciones = (data) => {
  const q = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    gte: jest.fn(() => Promise.resolve({ data, error: null })),
  };
  return { db: { from: jest.fn(() => q) }, q };
};

describe('T10 · lectura (criterio 12)', () => {
  test('solo cuenta los viajes del pasajero cancelados por él, dentro de la ventana', async () => {
    const { db, q } = crearDbCancelaciones([{ finalizado_en: hace(1) }]);
    expect(await revisarCancelaciones(db, PASAJERO, CONFIG, AHORA)).toEqual({ llevas: 1, bloqueadoHasta: null });
    expect(db.from).toHaveBeenCalledWith('viajes');
    expect(q.eq).toHaveBeenCalledWith('pasajero_id', PASAJERO);
    expect(q.eq).toHaveBeenCalledWith('estado', 'cancelado');
    // Las cancelaciones del conductor no cuentan.
    expect(q.eq).toHaveBeenCalledWith('cancelado_por', 'pasajero');
    expect(q.gte).toHaveBeenCalledWith('finalizado_en', hace(60));
  });

  test('si la lectura falla no bloquea (y queda en el log)', async () => {
    const db = { from: jest.fn(() => { throw new Error('BD caída'); }) };
    await expect(revisarCancelaciones(db, PASAJERO, CONFIG, AHORA)).resolves.toEqual({ llevas: 0, bloqueadoHasta: null });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('T10 · solicitarViaje con el tope (criterios 12 y 14)', () => {
  const body = { origen: { lat: -0.87, lng: -80.54 }, destino: { lat: -0.88, lng: -80.53 }, pasajeros: 1 };
  const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis() });

  /** La consulta de la sanción (finalizado_por) no trae nada; la de cancelaciones trae `cancelados`. */
  const crearDb = (cancelados) => {
    const consulta = () => {
      const filtros = {};
      const q = {
        select: jest.fn(() => q),
        eq: jest.fn((k, v) => { filtros[k] = v; return q; }),
        gte: jest.fn(() => Promise.resolve({ data: filtros.estado === 'cancelado' ? cancelados : [], error: null })),
        insert: jest.fn(() => q),
        single: jest.fn(() => Promise.resolve({ data: { id: VIAJE, pasajero_id: PASAJERO, estado: 'solicitado' }, error: null })),
      };
      return q;
    };
    return { from: jest.fn(consulta) };
  };
  const recientes = (n) => Array.from({ length: n }, (_, i) => ({ finalizado_en: new Date(Date.now() - (i + 1) * MIN).toISOString() }));

  test('con 5 cancelaciones en 60 min responde 429 con Retry-After y la hora, sin crear el viaje ni ofertas', async () => {
    const db = crearDb(recientes(5));
    const r = res();
    await solicitarViaje({ body, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(429);
    expect(r.json.mock.calls[0][0].message).toMatch(/Cancelaste varios pedidos seguidos\. Podrás pedir de nuevo a las \d{2}:\d{2}\./);
    const [cabecera, segundos] = r.set.mock.calls.find(([k]) => k === 'Retry-After');
    expect(cabecera).toBe('Retry-After');
    // Última hace 1 min y 30 de bloqueo: unos 29 min.
    expect(Number(segundos)).toBeGreaterThan(28 * 60);
    expect(Number(segundos)).toBeLessThanOrEqual(29 * 60);
    expect(db.from.mock.results.some((x) => x.value.insert.mock.calls.length > 0)).toBe(false);
    expect(mockDespachador.iniciar).not.toHaveBeenCalled();
  });

  test('con 4 pide con normalidad', async () => {
    const db = crearDb(recientes(4));
    const r = res();
    await solicitarViaje({ body, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(mockDespachador.iniciar).toHaveBeenCalled();
  });
});

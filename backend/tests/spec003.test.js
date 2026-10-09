/**
 * Paso 003 · criterios que viven en los controladores REST.
 * T9: solicitar con lugares y un viaje activo por pasajero (13, 19), aceptar con la RPC atómica (8, 9, 10)
 * y cancelar mientras busca (12). El despachador se simula: su lógica está en despachador.test.js.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/config/supabase', () => ({ supabase: {}, createUserClient: jest.fn(), getAdminClient: jest.fn() }));

const mockDespachador = { iniciar: jest.fn(), aceptado: jest.fn(), cancelar: jest.fn() };
jest.mock('../src/despacho', () => ({ obtenerDespachador: jest.fn(() => mockDespachador) }));

const { solicitarViaje, aceptarViaje, cambiarEstadoViaje } = require('../src/controllers/viajeController');
const { obtenerDespachador } = require('../src/despacho');

const VIAJE = '0a1b2c3d-0000-4000-8000-000000000001';
const LUGAR = '0c1d2e3f-0000-4000-8000-000000000001';
const PASAJERO = '11111111-1111-1111-1111-111111111111';
const CONDUCTOR = '22222222-2222-2222-2222-222222222222';

const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

/**
 * Cliente de Supabase falso: from(tabla) devuelve, en orden, las respuestas dadas para esa tabla,
 * y registra lo que se insertó o actualizó.
 */
const crearDb = ({ respuestas = {}, rpc } = {}) => {
  const llamadas = [];
  const colas = Object.fromEntries(Object.entries(respuestas).map(([t, r]) => [t, [...r]]));
  const db = {
    from: jest.fn((tabla) => {
      const q = {
        insert: jest.fn((filas) => { llamadas.push({ tabla, op: 'insert', filas }); return q; }),
        update: jest.fn((valores) => { llamadas.push({ tabla, op: 'update', valores }); return q; }),
        select: jest.fn(() => q),
        eq: jest.fn(() => q),
        single: jest.fn(() => Promise.resolve((colas[tabla] || []).shift() || { data: null, error: { message: 'sin filas' } })),
      };
      return q;
    }),
    rpc: jest.fn(rpc || (() => Promise.resolve({ data: [], error: null }))),
  };
  return { db, llamadas };
};

beforeEach(() => jest.clearAllMocks());

describe('T9 · solicitar viaje', () => {
  const viajeCreado = { id: VIAJE, pasajero_id: PASAJERO, estado: 'solicitado', creado_en: '2026-10-09T12:00:00Z' };

  test('criterio 19: con un lugar de destino no hace falta enviar coordenadas ni sector', async () => {
    const { db, llamadas } = crearDb({ respuestas: { viajes: [{ data: viajeCreado, error: null }] } });
    const r = res();
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 }, lugarDestinoId: LUGAR, pasajeros: 2 }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    const [fila] = llamadas.find((l) => l.op === 'insert').filas;
    expect(fila).toMatchObject({ lugar_destino_id: LUGAR, destino: null, sector_destino_id: null, pasajeros: 2 });
    expect(fila).not.toHaveProperty('tarifa');
  });

  test('sin lugar ni coordenadas de destino responde 400', async () => {
    const { db } = crearDb();
    const r = res();
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 } }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  test('un identificador de lugar manipulado responde 400 sin tocar la BD', async () => {
    const { db } = crearDb();
    const r = res();
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 }, lugarDestinoId: "x' or 1=1" }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  test('un lugar oculto o inexistente responde 400 con un mensaje claro', async () => {
    const { db } = crearDb({ respuestas: { viajes: [{ data: null, error: { code: '23514', message: 'lugar_no_disponible' } }] } });
    const r = res();
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 }, lugarDestinoId: LUGAR }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].message).toContain('ya no está disponible');
  });

  test('criterio 13: con otro viaje activo responde 409 y no arranca el despacho', async () => {
    const { db } = crearDb({ respuestas: { viajes: [{ data: null, error: { code: '23505', message: 'uq_viajes_activo_por_pasajero' } }] } });
    const r = res();
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 }, destino: { lat: -0.85, lng: -80.53 } }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0].message).toContain('viaje activo');
    expect(mockDespachador.iniciar).not.toHaveBeenCalled();
  });

  test('al crear la solicitud arranca el despacho con el viaje creado', async () => {
    const { db } = crearDb({ respuestas: { viajes: [{ data: viajeCreado, error: null }] } });
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 }, destino: { lat: -0.85, lng: -80.53 } }, user: { id: PASAJERO }, supabase: db }, res());
    expect(mockDespachador.iniciar).toHaveBeenCalledWith(viajeCreado);
  });

  test('sin despachador arrancado (p. ej. en pruebas) la solicitud igual se crea', async () => {
    obtenerDespachador.mockReturnValueOnce(null);
    const { db } = crearDb({ respuestas: { viajes: [{ data: viajeCreado, error: null }] } });
    const r = res();
    await solicitarViaje({ body: { origen: { lat: -0.87, lng: -80.54 }, destino: { lat: -0.85, lng: -80.53 } }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
  });
});

describe('T9 · aceptar viaje (criterios 8, 9 y 10)', () => {
  const req = (db) => ({ body: { viajeId: VIAJE }, user: { id: CONDUCTOR }, supabase: db });

  test.each([
    ['viaje_no_disponible', 409, 'ya fue tomado'],
    ['oferta_no_vigente', 409, 'venció'],
    ['conductor_no_aprobado', 403, 'no está aprobada'],
  ])('si la BD responde %s, devuelve %i con un mensaje claro y no avisa a nadie', async (codigo, status, texto) => {
    const { db } = crearDb({ rpc: () => Promise.resolve({ data: null, error: { message: codigo } }) });
    const r = res();
    await aceptarViaje(req(db), r);
    expect(r.status).toHaveBeenCalledWith(status);
    expect(r.json.mock.calls[0][0].message).toContain(texto);
    expect(r.json.mock.calls[0][0]).not.toHaveProperty('details');
    expect(mockDespachador.aceptado).not.toHaveBeenCalled();
  });

  test('acepta con la RPC, responde con el chat y avisa al pasajero con nombre, placa y teléfono', async () => {
    const viaje = { id: VIAJE, estado: 'aceptado', pasajero_id: PASAJERO, conductor_id: CONDUCTOR };
    const { db, llamadas } = crearDb({
      rpc: () => Promise.resolve({ data: [{ viaje_id: VIAJE, thread_id: 'hilo-1' }], error: null }),
      respuestas: {
        viajes: [{ data: viaje, error: null }],
        perfiles: [{ data: { nombre: 'Carla', telefono: '0992222222' }, error: null }],
        tricimotos: [{ data: { placa: 'ABC-123' }, error: null }],
      },
    });
    const r = res();
    await aceptarViaje(req(db), r);

    expect(db.rpc).toHaveBeenCalledWith('aceptar_viaje', { p_viaje: VIAJE });
    expect(llamadas).toEqual([]); // nada de updates ni inserts a mano
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0].data).toEqual({ viaje, chat: { threadId: 'hilo-1' } });
    expect(mockDespachador.aceptado).toHaveBeenCalledWith(viaje, {
      conductor: { id: CONDUCTOR, nombre: 'Carla', telefono: '0992222222', placa: 'ABC-123' },
      chat: { threadId: 'hilo-1' },
    });
  });
});

describe('T9 · cancelar mientras busca (criterio 12)', () => {
  test('cancelar una solicitud avisa al despachador para retirar las ofertas', async () => {
    // Primero la lectura del viaje (findViajeById) y luego la respuesta del update.
    const { db } = crearDb({ respuestas: { viajes: [
      { data: { id: VIAJE, estado: 'solicitado', pasajero_id: PASAJERO }, error: null },
      { data: { id: VIAJE, estado: 'cancelado' }, error: null },
    ] } });
    const r = res();
    await cambiarEstadoViaje({ params: { id: VIAJE }, body: { estado: 'cancelado' }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(mockDespachador.cancelar).toHaveBeenCalledWith(VIAJE);
  });

  test('un viaje ya cerrado sin conductor no se puede cancelar', async () => {
    const { db } = crearDb({ respuestas: { viajes: [{ data: { id: VIAJE, estado: 'sin_conductor', pasajero_id: PASAJERO }, error: null }] } });
    const r = res();
    await cambiarEstadoViaje({ params: { id: VIAJE }, body: { estado: 'cancelado' }, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(mockDespachador.cancelar).not.toHaveBeenCalled();
  });
});

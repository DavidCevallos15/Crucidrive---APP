/**
 * Paso 003 · criterios que viven en los controladores REST.
 * T9: solicitar con lugares y un viaje activo por pasajero (13, 19), aceptar con la RPC atómica (8, 9, 10)
 * y cancelar mientras busca (12). T10: disponibilidad (1) y rechazo por socket (6). El despachador se simula: su lógica está en despachador.test.js.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/config/supabase', () => ({ supabase: {}, createUserClient: jest.fn(), getAdminClient: jest.fn() }));

const mockDespachador = { iniciar: jest.fn(), aceptado: jest.fn(), cancelar: jest.fn(), alResponder: jest.fn() };
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

// ─── T10 · disponibilidad y rechazo ──────────────────────────────────────────
const { cambiarDisponibilidad } = require('../src/controllers/conductorController');
const initSocketHandler = require('../src/sockets/socketHandler');

/**
 * BD falsa para tricimotos y ofertas_viaje: cada consulta (lectura del estado, ofertas abiertas
 * y update) toma la siguiente respuesta de la lista, sin importar cómo termine la cadena.
 */
const crearDbSecuencial = (respuestas) => {
  const cola = [...respuestas];
  const updates = [];
  const siguiente = () => Promise.resolve(cola.shift() || { data: null, error: null });
  const db = {
    from: jest.fn(() => {
      const q = {
        select: () => q,
        eq: () => q,
        update: (valores) => { updates.push(valores); return q; },
        maybeSingle: siguiente,
        single: siguiente,
        then: (ok, mal) => siguiente().then(ok, mal),
      };
      return q;
    }),
  };
  return { db, updates };
};

describe('T10 · PATCH /api/conductores/disponibilidad (criterio 1)', () => {
  const pedir = async (body, respuestas) => {
    const { db, updates } = crearDbSecuencial(respuestas);
    const r = res();
    await cambiarDisponibilidad({ body, user: { id: CONDUCTOR }, supabase: db }, r);
    return { r, updates, db };
  };

  test('exige un booleano', async () => {
    const { r, db } = await pedir({ disponible: 'si' }, []);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  test('un conductor disponible pasa a "disponible" en la BD', async () => {
    const { r, updates } = await pedir({ disponible: true }, [
      { data: { estado: 'inactivo' }, error: null },
      { data: [{ estado: 'disponible', disponible_desde: '2026-10-09T12:00:00Z' }], error: null },
    ]);
    expect(updates).toEqual([{ estado: 'disponible' }]);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json.mock.calls[0][0].data.estado).toBe('disponible');
  });

  test('al dejar de estar disponible con una oferta abierta, el despachador pasa al siguiente', async () => {
    const { r, updates } = await pedir({ disponible: false }, [
      { data: { estado: 'disponible' }, error: null },
      { data: [{ viaje_id: VIAJE }], error: null },
      { data: [{ estado: 'inactivo', disponible_desde: null }], error: null },
    ]);
    expect(updates).toEqual([{ estado: 'inactivo' }]);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(mockDespachador.alResponder).toHaveBeenCalledWith(VIAJE);
  });

  test('un conductor sin aprobar recibe 403 (la RLS no actualiza ninguna fila)', async () => {
    const { r } = await pedir({ disponible: true }, [
      { data: { estado: 'inactivo' }, error: null },
      { data: [], error: null },
    ]);
    expect(r.status).toHaveBeenCalledWith(403);
  });

  test('con un viaje en curso (tricimoto ocupada) responde 409 y no toca nada', async () => {
    const { r, updates } = await pedir({ disponible: false }, [{ data: { estado: 'ocupado' }, error: null }]);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(updates).toEqual([]);
  });

  test('sin tricimoto registrada responde 404', async () => {
    const { r } = await pedir({ disponible: true }, [{ data: null, error: null }]);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});

describe('T10 · socket rechazar_oferta (criterio 6)', () => {
  const conectarConductor = (rpc, rol = 'conductor') => {
    let alConectar;
    const io = { use: () => {}, on: (evento, fn) => { if (evento === 'connection') alConectar = fn; } };
    initSocketHandler(io, { conexiones: { agregar: () => {}, quitar: () => {} } });
    const manejadores = {};
    const socket = {
      id: 's1',
      user: { id: CONDUCTOR, rol, nombre: 'Carla' },
      supabase: { rpc: jest.fn(rpc) },
      join: () => {},
      emit: jest.fn(),
      on: (evento, fn) => { manejadores[evento] = fn; },
    };
    alConectar(socket);
    return { socket, manejadores };
  };

  test('rechaza con el JWT del conductor y el despachador pasa al siguiente', async () => {
    const { socket, manejadores } = conectarConductor(() => Promise.resolve({ data: true, error: null }));
    await manejadores.rechazar_oferta({ viajeId: VIAJE });
    expect(socket.supabase.rpc).toHaveBeenCalledWith('rechazar_oferta', { p_viaje: VIAJE });
    expect(mockDespachador.alResponder).toHaveBeenCalledWith(VIAJE);
  });

  test('si la oferta ya no estaba pendiente, no mueve el despacho', async () => {
    const { manejadores } = conectarConductor(() => Promise.resolve({ data: false, error: null }));
    await manejadores.rechazar_oferta({ viajeId: VIAJE });
    expect(mockDespachador.alResponder).not.toHaveBeenCalled();
  });

  test('un pasajero no puede rechazar ofertas', async () => {
    const { socket, manejadores } = conectarConductor(() => Promise.resolve({ data: true, error: null }), 'pasajero');
    await manejadores.rechazar_oferta({ viajeId: VIAJE });
    expect(socket.supabase.rpc).not.toHaveBeenCalled();
  });

  test('un viajeId manipulado se rechaza sin llamar a la BD', async () => {
    const { socket, manejadores } = conectarConductor(() => Promise.resolve({ data: true, error: null }));
    await manejadores.rechazar_oferta({ viajeId: "x' or 1=1" });
    expect(socket.supabase.rpc).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error_message', expect.stringContaining('no es válido'));
  });
});

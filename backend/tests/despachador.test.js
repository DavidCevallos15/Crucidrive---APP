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
  // Con el conductor ocupado ya no se avisa al sector (paso 004, criterio 14): ver spec004.test.js.
  test('ignora el "estado" que envía la app y avisa al sector con el estado real de la BD', async () => {
    const { db, llamadas } = crearDbTricimotos({ data: [{ conductor_id: CONDUCTOR.id, estado: 'disponible' }], error: null });
    const { socket } = conectar(CONDUCTOR, db);
    await socket.manejadores.update_location({ sectorId: 'malecon', coords: { lat: -0.87, lng: -80.54 }, estado: 'ocupado' });
    expect(llamadas.update).toEqual({ ubicacion_actual: 'POINT(-80.54 -0.87)', sector_id: 'malecon' });
    expect(llamadas.update).not.toHaveProperty('estado');
    expect(socket.alSector).toEqual([{
      sala: 'sector:malecon',
      evento: 'location_updated',
      datos: { conductorId: CONDUCTOR.id, nombre: 'Carla', coords: { lat: -0.87, lng: -80.54 }, estado: 'disponible' },
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

// ─── T8 · despachador ────────────────────────────────────────────────────────
const { crearDespachador } = require('../src/despacho/despachador');
const { crearBdDespachoFalsa } = require('./helpers/bdDespachoFalsa');

const PASAJERO = '11111111-1111-1111-1111-111111111111';
const VIAJE = 'a0000000-0000-0000-0000-000000000001';
const [A, B, C, D] = ['c-a', 'c-b', 'c-c', 'c-d'];
const CONFIG = { secuenciales: 3, ofertaSeg: 15, maxSeg: 120, ubicacionMaxSeg: 60, barridoSeg: 15 };

const montar = ({ candidatos = [A, B, C, D], conectados = candidatos, avisos = null } = {}) => {
  const bd = crearBdDespachoFalsa();
  bd.agregarViaje({
    id: VIAJE, pasajero_id: PASAJERO, pasajeros: 2, tarifa: '1.00',
    sector_origen_id: 'malecon', sector_destino_id: 'los_arenales',
    origen_descripcion: null, destino_descripcion: 'Muelle de Crucita',
  });
  bd.fijarCandidatos(VIAJE, candidatos.map((id, i) => ({ conductor_id: id, distancia_m: (i + 1) * 100 })));
  const io = crearIoFalso();
  const conectadosSet = new Set(conectados);
  const despachador = crearDespachador({
    obtenerDb: () => bd.db,
    io,
    conexiones: { estaConectado: (id) => conectadosSet.has(id) },
    config: CONFIG,
    avisos,
  });
  const eventos = (evento) => io.emitidos.filter((e) => e.evento === evento);
  const ofertasA = (conductor) => eventos('oferta_viaje').filter((e) => e.sala === `usuario:${conductor}`);
  return { bd, io, despachador, eventos, ofertasA };
};

describe('T8 · despachador (D-11)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-09T12:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  test('criterio 4: ofrece primero al más cercano, solo a él y con 15 s', async () => {
    const { despachador, ofertasA, eventos } = montar();
    await despachador.iniciar(VIAJE);
    expect(eventos('oferta_viaje')).toHaveLength(1);
    const [oferta] = ofertasA(A);
    expect(oferta.datos).toMatchObject({ viajeId: VIAJE, fase: 'secuencial', distanciaM: 100, pasajeros: 2, tarifa: 1 });
    expect(oferta.datos.venceEn).toBe(Date.now() + 15000);
    despachador.detener();
  });

  test('criterio 6: a los 15 s sin respuesta retira la oferta y pasa al siguiente', async () => {
    const { despachador, ofertasA, eventos } = montar();
    await despachador.iniciar(VIAJE);
    await jest.advanceTimersByTimeAsync(15100);
    expect(eventos('oferta_retirada').map((e) => e.sala)).toEqual([`usuario:${A}`]);
    expect(ofertasA(B)).toHaveLength(1);
    despachador.detener();
  });

  test('criterio 6: un rechazo pasa al siguiente al instante, sin esperar el vencimiento', async () => {
    const { bd, despachador, ofertasA } = montar();
    await despachador.iniciar(VIAJE);
    bd.rechazar(VIAJE, A);
    await despachador.alResponder(VIAJE);
    expect(ofertasA(B)).toHaveLength(1);
    despachador.detener();
  });

  test('D-11: tras 3 ofertas secuenciales, aviso abierto a los demás hasta los 2 minutos; nadie repite', async () => {
    const { despachador, ofertasA } = montar();
    await despachador.iniciar(VIAJE);
    await jest.advanceTimersByTimeAsync(15100); // vence A, pasa a B
    await jest.advanceTimersByTimeAsync(15100); // vence B, pasa a C
    await jest.advanceTimersByTimeAsync(15100); // vence C, aviso abierto
    expect(ofertasA(D)).toHaveLength(1);
    expect(ofertasA(D)[0].datos.fase).toBe('abierta');
    expect(ofertasA(D)[0].datos.venceEn).toBe(new Date('2026-10-09T12:02:00Z').getTime());
    for (const c of [A, B, C]) expect(ofertasA(c)).toHaveLength(1);
    despachador.detener();
  });

  test('criterio 11: a los 2 minutos sin aceptación, "sin conductor" al pasajero y se retira el aviso abierto', async () => {
    const { despachador, eventos, bd } = montar({ candidatos: [A], conectados: [A, B] });
    await despachador.iniciar(VIAJE);
    // B se conecta más tarde y entra en el aviso abierto.
    bd.fijarCandidatos(VIAJE, [{ conductor_id: A, distancia_m: 100 }, { conductor_id: B, distancia_m: 900 }]);
    await jest.advanceTimersByTimeAsync(15100);
    expect(eventos('oferta_viaje').map((e) => e.sala)).toEqual([`usuario:${A}`, `usuario:${B}`]);
    await jest.advanceTimersByTimeAsync(120000);
    expect(eventos('viaje_sin_conductor')).toEqual([{ sala: `usuario:${PASAJERO}`, evento: 'viaje_sin_conductor', datos: { viajeId: VIAJE } }]);
    expect(eventos('oferta_retirada').map((e) => e.sala)).toContain(`usuario:${B}`);
    expect(bd.viajes.get(VIAJE).estado).toBe('sin_conductor');
    expect(despachador.estaBuscando(VIAJE)).toBe(false);
  });

  test('criterio 11: sin candidatos se cierra al instante', async () => {
    const { despachador, eventos } = montar({ candidatos: [] });
    await despachador.iniciar(VIAJE);
    expect(eventos('viaje_sin_conductor')).toHaveLength(1);
    expect(eventos('oferta_viaje')).toHaveLength(0);
  });

  test('criterio 11: si todos rechazan antes de tiempo, también se cierra al instante', async () => {
    const { bd, despachador, eventos } = montar({ candidatos: [A] });
    await despachador.iniciar(VIAJE);
    bd.rechazar(VIAJE, A);
    await despachador.alResponder(VIAJE);
    expect(eventos('viaje_sin_conductor')).toHaveLength(1);
  });

  test('R6: no ofrece a un conductor sin la app abierta', async () => {
    const { despachador, ofertasA } = montar({ conectados: [B, C, D] });
    await despachador.iniciar(VIAJE);
    expect(ofertasA(A)).toHaveLength(0);
    expect(ofertasA(B)).toHaveLength(1);
    despachador.detener();
  });

  test('criterio 7: si el más cercano acaba de recibir otra oferta, pasa al siguiente', async () => {
    const { bd, despachador, ofertasA } = montar();
    bd.ocupadoEnOtraOferta(A);
    await despachador.iniciar(VIAJE);
    expect(ofertasA(A)).toHaveLength(0);
    expect(ofertasA(B)).toHaveLength(1);
    despachador.detener();
  });

  test('criterio 12: al cancelar el pasajero, la oferta desaparece y no se envían más', async () => {
    const { bd, despachador, eventos } = montar();
    await despachador.iniciar(VIAJE);
    bd.cancelarViaje(VIAJE);
    await despachador.cancelar(VIAJE);
    expect(eventos('oferta_retirada').map((e) => e.sala)).toEqual([`usuario:${A}`]);
    await jest.advanceTimersByTimeAsync(60000);
    expect(eventos('oferta_viaje')).toHaveLength(1);
  });

  test('criterio 10: al aceptar, el pasajero recibe los datos del conductor y los demás pierden la oferta', async () => {
    const { bd, despachador, eventos } = montar({ candidatos: [A, B, C, D, 'c-e'] });
    await despachador.iniciar(VIAJE);
    await jest.advanceTimersByTimeAsync(45300); // aviso abierto: D y E pendientes
    bd.aceptar(VIAJE, D);
    const conductor = { nombre: 'Diego', placa: 'DEF-456', telefono: '0994444444' };
    await despachador.aceptado({ id: VIAJE, pasajero_id: PASAJERO }, { conductor });
    expect(eventos('viaje_aceptado')).toEqual([{ sala: `usuario:${PASAJERO}`, evento: 'viaje_aceptado', datos: { viajeId: VIAJE, conductor } }]);
    expect(eventos('oferta_retirada').map((e) => e.sala)).toContain('usuario:c-e');
    expect(despachador.estaBuscando(VIAJE)).toBe(false);
    await jest.advanceTimersByTimeAsync(120000);
    expect(eventos('viaje_sin_conductor')).toHaveLength(0);
  });

  test('criterio 14: al arrancar retoma lo pendiente y cierra lo que pasó de los 2 minutos', async () => {
    const bd = crearBdDespachoFalsa();
    const hace = (seg) => new Date(Date.now() - seg * 1000).toISOString();
    bd.agregarViaje({ id: VIAJE, pasajero_id: PASAJERO, pasajeros: 1, tarifa: '0.50', creado_en: hace(30) });
    bd.agregarViaje({ id: 'viejo', pasajero_id: 'p-viejo', pasajeros: 1, tarifa: '0.50', creado_en: hace(300) });
    bd.fijarCandidatos(VIAJE, [{ conductor_id: A, distancia_m: 100 }, { conductor_id: B, distancia_m: 200 }]);
    // Antes de caer, el servidor había ofrecido el viaje a A y esa oferta ya venció.
    bd.ofertas.push({ viaje_id: VIAJE, conductor_id: A, fase: 'secuencial', vence_en: hace(10), resultado: 'pendiente', distancia_m: 100 });
    const io = crearIoFalso();
    const despachador = crearDespachador({ obtenerDb: () => bd.db, io, conexiones: { estaConectado: () => true }, config: CONFIG });
    await despachador.recuperar();
    const salas = (evento) => io.emitidos.filter((e) => e.evento === evento).map((e) => e.sala);
    expect(salas('viaje_sin_conductor')).toEqual(['usuario:p-viejo']);
    expect(salas('oferta_retirada')).toEqual([`usuario:${A}`]);
    expect(salas('oferta_viaje')).toEqual([`usuario:${B}`]);
    expect(bd.viajes.get('viejo').estado).toBe('sin_conductor');
    despachador.detener();
  });

  test('un error de la BD no tumba el proceso', async () => {
    const io = crearIoFalso();
    const db = { rpc: jest.fn(async () => ({ data: null, error: { message: 'caída' } })), from: jest.fn() };
    const errores = jest.spyOn(console, 'error').mockImplementation(() => {});
    const despachador = crearDespachador({ obtenerDb: () => db, io, conexiones: { estaConectado: () => true }, config: CONFIG });
    const viaje = { id: VIAJE, estado: 'solicitado', creado_en: new Date().toISOString(), pasajero_id: PASAJERO };
    await expect(despachador.iniciar(viaje)).resolves.toBeUndefined();
    await expect(despachador.barrer()).resolves.toBeUndefined();
    expect(errores).toHaveBeenCalled();
    errores.mockRestore();
    despachador.detener();
  });
});

// ─── Paso 004 · T6: avisos con la app cerrada en el despacho ──────────────────
/** Avisos falsos: `conToken` son los conductores con teléfono registrado. */
const crearAvisosFalsos = ({ conToken = [], fallar = false } = {}) => {
  const conTokenSet = new Set(conToken);
  const accion = () => jest.fn(() => (fallar ? Promise.reject(new Error('Expo caído')) : Promise.resolve()));
  return {
    conToken: jest.fn(async (ids) => {
      if (fallar) throw new Error('BD caída');
      return new Set(ids.filter((id) => conTokenSet.has(id)));
    }),
    oferta: accion(),
    retirada: accion(),
    aceptado: accion(),
    sinConductor: accion(),
  };
};

describe('T6 · despacho con avisos (paso 004, criterios 6, 8, 10 y 12; plan P5 y P6)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-09T12:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  test('P5: un conductor sin socket pero con teléfono para avisos es candidato y recibe la oferta', async () => {
    const avisos = crearAvisosFalsos({ conToken: [A] });
    const { despachador, ofertasA } = montar({ conectados: [], avisos });
    await despachador.iniciar(VIAJE);
    expect(ofertasA(A)).toHaveLength(1);
    expect(avisos.oferta).toHaveBeenCalledWith(A, ofertasA(A)[0].datos);
    despachador.detener();
  });

  test('P5: sin socket ni teléfono no es candidato; se pasa al siguiente que sí llega', async () => {
    const avisos = crearAvisosFalsos({ conToken: [B] });
    const { despachador, ofertasA } = montar({ conectados: [], avisos });
    await despachador.iniciar(VIAJE);
    expect(ofertasA(A)).toHaveLength(0);
    expect(ofertasA(B)).toHaveLength(1);
    despachador.detener();
  });

  test('P6: con socket también va el aviso (la app lo descarta si está abierta)', async () => {
    const avisos = crearAvisosFalsos();
    const { despachador, ofertasA } = montar({ avisos });
    await despachador.iniciar(VIAJE);
    expect(avisos.oferta).toHaveBeenCalledTimes(1);
    expect(avisos.oferta).toHaveBeenCalledWith(A, ofertasA(A)[0].datos);
    // Con todos conectados ni siquiera se consulta quién tiene teléfono.
    expect(avisos.conToken).not.toHaveBeenCalled();
    despachador.detener();
  });

  test('criterio 8: al vencer, aviso de retirada al conductor', async () => {
    const avisos = crearAvisosFalsos();
    const { despachador } = montar({ avisos });
    await despachador.iniciar(VIAJE);
    await jest.advanceTimersByTimeAsync(15100);
    expect(avisos.retirada).toHaveBeenCalledWith(A, VIAJE);
    despachador.detener();
  });

  test('criterio 10: sin conductor, aviso al pasajero', async () => {
    const avisos = crearAvisosFalsos();
    const { despachador } = montar({ candidatos: [], avisos });
    await despachador.iniciar(VIAJE);
    expect(avisos.sinConductor).toHaveBeenCalledWith(PASAJERO, VIAJE);
  });

  test('criterios 8 y 10: al aceptar, aviso al pasajero y retirada a los que la perdieron', async () => {
    const E = 'c-e';
    const avisos = crearAvisosFalsos();
    const { bd, despachador } = montar({ candidatos: [A, B, C, D, E], avisos });
    await despachador.iniciar(VIAJE);
    await jest.advanceTimersByTimeAsync(45300); // aviso abierto a D y E
    bd.aceptar(VIAJE, D);
    const conductor = { id: D, nombre: 'Diego', placa: 'DEF-456', telefono: '0994444444' };
    await despachador.aceptado({ id: VIAJE, pasajero_id: PASAJERO }, { conductor });
    expect(avisos.aceptado).toHaveBeenCalledWith(PASAJERO, VIAJE, conductor);
    // E perdió la carrera: su aviso se retira. D, que aceptó, no recibe retirada.
    expect(avisos.retirada).toHaveBeenCalledWith(E, VIAJE);
    expect(avisos.retirada).not.toHaveBeenCalledWith(D, VIAJE);
  });

  test('criterio 12 del 003: cancelar retira también el aviso de la oferta abierta', async () => {
    const avisos = crearAvisosFalsos();
    const { bd, despachador } = montar({ avisos });
    await despachador.iniciar(VIAJE);
    bd.cancelarViaje(VIAJE);
    await despachador.cancelar(VIAJE);
    expect(avisos.retirada).toHaveBeenCalledWith(A, VIAJE);
  });

  test('criterio 12: si los avisos fallan, el despacho sigue igual por el socket', async () => {
    const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
    const avisos = crearAvisosFalsos({ conToken: [B], fallar: true });
    const { despachador, ofertasA, eventos } = montar({ conectados: [A], avisos });
    await despachador.iniciar(VIAJE);
    expect(ofertasA(A)).toHaveLength(1);
    expect(avisos.oferta).toHaveBeenCalled(); // falló, pero el socket ya llevó la oferta
    await jest.advanceTimersByTimeAsync(15100);
    // B no tiene socket y la lectura de teléfonos falló: no es candidato. Nadie más llega,
    // así que el despacho termina normalmente, como en el 003.
    expect(ofertasA(B)).toHaveLength(0);
    expect(eventos('oferta_retirada').map((e) => e.sala)).toEqual([`usuario:${A}`]);
    expect(eventos('viaje_sin_conductor')).toHaveLength(1);
    espia.mockRestore();
  });

  test('sin módulo de avisos (pruebas del 003) se comporta como antes', async () => {
    const { despachador, ofertasA } = montar({ conectados: [B] });
    await despachador.iniciar(VIAJE);
    expect(ofertasA(A)).toHaveLength(0);
    expect(ofertasA(B)).toHaveLength(1);
    despachador.detener();
  });
});

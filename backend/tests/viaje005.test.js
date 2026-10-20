/**
 * Paso 005 · viaje en curso en el backend (tareas T2 a T4b).
 * T2: validación de motivo, estrellas y comentario (mismos patrones que los CHECK de 0017).
 * T3: endpoints de P6 sobre las funciones de la BD, con códigos 400, 403, 409 y 200 sin detalles internos.
 * T4: avisos a la otra parte (P7) y reseñas en los datos del conductor (P8).
 * T4b: sanción por finalizar el pasajero (P5b; criterios 5b y 5c).
 * Las reglas de quién puede cada paso viven en la BD y se prueban en supabase/tests/rls_007.sql.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/config/supabase', () => ({ supabase: {}, createUserClient: jest.fn(), getAdminClient: jest.fn() }));

const mockDespachador = { iniciar: jest.fn(), cancelar: jest.fn(), avisarViaje: jest.fn() };
jest.mock('../src/despacho', () => ({ obtenerDespachador: jest.fn(() => mockDespachador) }));

const { isMotivoCancelacion, isEstrellas, errorComentario, COMENTARIO_MAX } = require('../src/utils/validation');
const { leerConfigSancion, evaluarSancion, revisarSancion, horaLocal } = require('../src/viaje/sancion');
const viajeEnCurso = require('../src/controllers/viajeEnCursoController');
const { solicitarViaje } = require('../src/controllers/viajeController');
const { avisoEstadoViaje, TEXTOS_VIAJE } = require('../src/avisos/mensajes');
const { crearDespachador } = jest.requireActual('../src/despacho/despachador');

const VIAJE = '0a1b2c3d-0000-4000-8000-000000000001';
const PASAJERO = '11111111-1111-1111-1111-111111111111';
const CONDUCTOR = '22222222-2222-2222-2222-222222222222';
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const CONFIG = { max: 3, ventanaDias: 30, bloqueoHoras: 24 };

const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const cuerpo = (r) => r.json.mock.calls[0][0];

/**
 * Cliente falso: `rpc` responde lo indicado por función y `from('viajes')` devuelve `viaje`
 * (lectura del viaje después del paso) o `finalizados` (consulta de la sanción).
 */
const crearDb = ({ errores = {}, datos = {}, viaje = null, finalizados = [] } = {}) => {
  const consulta = (tabla) => {
    const q = {
      select: jest.fn(() => q),
      eq: jest.fn(() => q),
      gte: jest.fn(() => Promise.resolve({ data: finalizados, error: null })),
      insert: jest.fn(() => q),
      single: jest.fn(() => Promise.resolve(tabla === 'viajes' && viaje
        ? { data: viaje, error: null }
        : { data: null, error: { message: 'sin filas' } })),
    };
    return q;
  };
  return {
    from: jest.fn(consulta),
    rpc: jest.fn((funcion) => Promise.resolve(errores[funcion]
      ? { data: null, error: errores[funcion] }
      : { data: datos[funcion] ?? null, error: null })),
  };
};

const pedir = ({ db, body = {}, user = { id: CONDUCTOR }, id = VIAJE }) => ({ params: { id }, body, user, supabase: db });
const errorBd = (mensaje, code = 'P0001') => ({ code, message: mensaje });
const viajeEn = (estado, extra = {}) => ({ id: VIAJE, pasajero_id: PASAJERO, conductor_id: CONDUCTOR, estado, tipo_servicio: 'viaje', ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  // errorResponse registra el detalle interno: se silencia para que no ensucie la salida.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

// ─── T2 · validación ─────────────────────────────────────────────────────────
describe('T2 · validación (criterios 8, 15 y 19)', () => {
  test('motivos de cancelación: solo los cuatro del CHECK', () => {
    for (const m of ['ya_no_lo_necesito', 'tarda_demasiado', 'no_encuentro_al_pasajero', 'otro']) {
      expect(isMotivoCancelacion(m)).toBe(true);
    }
    for (const m of ['', 'OTRO', 'me_cae_mal', null, undefined, 3]) expect(isMotivoCancelacion(m)).toBe(false);
  });

  test('estrellas: entero de 1 a 5', () => {
    for (const e of [1, 2, 3, 4, 5]) expect(isEstrellas(e)).toBe(true);
    for (const e of [0, 6, 4.5, '5', null, undefined, NaN]) expect(isEstrellas(e)).toBe(false);
  });

  test('comentario: vacío o ausente es válido (es opcional)', () => {
    expect(errorComentario(undefined)).toBeNull();
    expect(errorComentario(null)).toBeNull();
    expect(errorComentario('   ')).toBeNull();
    expect(errorComentario('Muy amable, manejó con cuidado.')).toBeNull();
  });

  test('comentario: rechaza enlaces, teléfonos (aunque vayan separados) y textos largos', () => {
    expect(errorComentario('mira http://x.com')).toMatch(/enlaces/);
    expect(errorComentario('en WWW.ejemplo.ec')).toMatch(/enlaces/);
    expect(errorComentario('llámame 0991234567')).toMatch(/teléfono/);
    expect(errorComentario('al 099 123 4567')).toMatch(/teléfono/);
    expect(errorComentario('al 099-123-45.67')).toMatch(/teléfono/);
    expect(errorComentario('a'.repeat(COMENTARIO_MAX + 1))).toMatch(String(COMENTARIO_MAX));
    expect(errorComentario({ texto: 'hola' })).toMatch(/no es válido/);
  });

  test('comentario: números cortos (una calle, una hora) sí se permiten', () => {
    expect(errorComentario('Llegó a las 18:30 a la calle 12')).toBeNull();
  });
});

// ─── T4b · sanción (funciones puras) ─────────────────────────────────────────
describe('T4b · sanción por finalizar el pasajero (criterio 5c)', () => {
  const AHORA = Date.parse('2026-10-20T15:00:00Z');
  const haceHoras = (h) => new Date(AHORA - h * HORA).toISOString();

  test('parámetros por defecto: 3 en 30 días, 24 h de bloqueo', () => {
    expect(leerConfigSancion({})).toEqual(CONFIG);
  });

  test('parámetros válidos del entorno', () => {
    expect(leerConfigSancion({ SANCION_FINALIZAR_MAX: '5', SANCION_VENTANA_DIAS: '7', SANCION_BLOQUEO_HORAS: '48' }))
      .toEqual({ max: 5, ventanaDias: 7, bloqueoHoras: 48 });
  });

  test.each([
    ['SANCION_FINALIZAR_MAX', '0'],
    ['SANCION_FINALIZAR_MAX', '2.5'],
    ['SANCION_VENTANA_DIAS', '91'],
    ['SANCION_BLOQUEO_HORAS', 'mucho'],
    ['SANCION_BLOQUEO_HORAS', '169'],
  ])('un valor inválido detiene el arranque: %s=%s', (nombre, valor) => {
    expect(() => leerConfigSancion({ [nombre]: valor })).toThrow(nombre);
  });

  test('2 finalizaciones propias no bloquean', () => {
    expect(evaluarSancion([haceHoras(1), haceHoras(5)], AHORA, CONFIG)).toEqual({ llevas: 2, bloqueadoHasta: null });
  });

  test('3 bloquean 24 h contadas desde la última', () => {
    const r = evaluarSancion([haceHoras(2), haceHoras(30), haceHoras(100)], AHORA, CONFIG);
    expect(r.llevas).toBe(3);
    expect(r.bloqueadoHasta).toBe(AHORA - 2 * HORA + 24 * HORA);
  });

  test('a las 24 h de la última se libera', () => {
    const fechas = [haceHoras(24), haceHoras(30), haceHoras(100)];
    expect(evaluarSancion(fechas, AHORA, CONFIG).bloqueadoHasta).toBeNull();
    expect(evaluarSancion(fechas, AHORA - 1, CONFIG).bloqueadoHasta).toBe(AHORA);
  });

  test('lo que quedó fuera de la ventana no cuenta', () => {
    const r = evaluarSancion([haceHoras(1), haceHoras(2), new Date(AHORA - 31 * DIA).toISOString()], AHORA, CONFIG);
    expect(r).toEqual({ llevas: 2, bloqueadoHasta: null });
  });

  test('lee solo las del pasajero, finalizadas por él y dentro de la ventana', async () => {
    const db = crearDb({ finalizados: [{ finalizado_en: haceHoras(1) }] });
    const r = await revisarSancion(db, PASAJERO, CONFIG, AHORA);
    expect(r).toEqual({ llevas: 1, bloqueadoHasta: null });
    const q = db.from.mock.results[0].value;
    expect(db.from).toHaveBeenCalledWith('viajes');
    expect(q.eq).toHaveBeenCalledWith('pasajero_id', PASAJERO);
    expect(q.eq).toHaveBeenCalledWith('finalizado_por', 'pasajero');
    expect(q.gte).toHaveBeenCalledWith('finalizado_en', new Date(AHORA - 30 * DIA).toISOString());
  });

  test('si la lectura falla no bloquea (y queda en el log)', async () => {
    const db = { from: jest.fn(() => { throw new Error('BD caída'); }) };
    await expect(revisarSancion(db, PASAJERO, CONFIG, AHORA)).resolves.toEqual({ llevas: 0, bloqueadoHasta: null });
    expect(console.error).toHaveBeenCalled();
  });

  test('la hora del aviso es la de Ecuador continental', () => {
    expect(horaLocal(Date.parse('2026-10-20T23:30:00Z'))).toBe('18:30');
  });
});

describe('T4b · solicitarViaje con sanción', () => {
  const body = { origen: { lat: -0.87, lng: -80.54 }, destino: { lat: -0.88, lng: -80.53 }, pasajeros: 1 };
  const reciente = (h) => ({ finalizado_en: new Date(Date.now() - h * HORA).toISOString() });

  test('con 3 en la ventana y la última hace menos de 24 h responde 429 con la hora y no crea el viaje', async () => {
    const db = crearDb({ finalizados: [reciente(1), reciente(3), reciente(5)] });
    const r = res();
    await solicitarViaje({ body, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(429);
    expect(cuerpo(r).message).toMatch(/Podrás pedir de nuevo a las \d{2}:\d{2}\./);
    expect(db.from.mock.results.some((x) => x.value.insert.mock.calls.length > 0)).toBe(false);
    expect(mockDespachador.iniciar).not.toHaveBeenCalled();
  });

  test('con 2 en la ventana pide con normalidad', async () => {
    const db = crearDb({ finalizados: [reciente(1), reciente(3)], viaje: { id: VIAJE, pasajero_id: PASAJERO, estado: 'solicitado' } });
    const r = res();
    await solicitarViaje({ body, user: { id: PASAJERO }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
  });
});

// ─── T3 y T4 · endpoints ─────────────────────────────────────────────────────
describe('T3 · errores de las funciones de la BD (sin detalles internos)', () => {
  test.each([
    ['marcarLlegada', 'marcar_llegada', errorBd('no_es_tu_viaje', '42501'), 403],
    ['iniciarViaje', 'iniciar_viaje', errorBd('estado_no_permite'), 409],
    ['terminarViaje', 'terminar_viaje', errorBd('estado_no_permite'), 409],
    ['cancelarViaje', 'cancelar_viaje', errorBd('motivo_requerido'), 400],
    ['calificarViaje', 'calificar_viaje', errorBd('ya_calificado'), 409],
    ['calificarViaje', 'calificar_viaje', errorBd('no_calificable'), 409],
    ['calificarViaje', 'calificar_viaje', errorBd('new row violates check constraint', '23514'), 400],
    ['confirmarLlegada', 'confirmar_llegada', errorBd('algo raro de la BD', 'XX000'), 500],
  ])('%s: %s con %j → %i', async (handler, funcion, error, status) => {
    const db = crearDb({ errores: { [funcion]: error } });
    const body = { estrellas: 5, llego: true };
    const r = res();
    await viajeEnCurso[handler](pedir({ db, body }), r);
    expect(r.status).toHaveBeenCalledWith(status);
    expect(cuerpo(r).status).toBe('error');
    expect(JSON.stringify(cuerpo(r))).not.toContain(error.message);
    expect(mockDespachador.avisarViaje).not.toHaveBeenCalled();
  });

  test('un id que no es uuid no llega a la BD', async () => {
    const db = crearDb();
    const r = res();
    await viajeEnCurso.marcarLlegada(pedir({ db, id: '123' }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  test('si el paso se hizo pero falla la lectura posterior, responde 200 con el id', async () => {
    const db = crearDb(); // sin viaje: la lectura falla
    const r = res();
    await viajeEnCurso.iniciarViaje(pedir({ db }), r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(cuerpo(r).data).toEqual({ id: VIAJE });
  });
});

describe('T3 y T4 · conductor: llegada, inicio y final (criterios 3, 4 y 5)', () => {
  test('«Llegué» llama a marcar_llegada y avisa al pasajero', async () => {
    const db = crearDb({ viaje: viajeEn('aceptado', { llegado_en: '2026-10-20T15:00:00Z' }) });
    const r = res();
    await viajeEnCurso.marcarLlegada(pedir({ db }), r);
    expect(db.rpc).toHaveBeenCalledWith('marcar_llegada', { p_viaje: VIAJE });
    expect(r.status).toHaveBeenCalledWith(200);
    expect(mockDespachador.avisarViaje).toHaveBeenCalledWith(PASAJERO, { viajeId: VIAJE, cambio: 'llegada', encomienda: false });
  });

  test('«Paquete recogido» en encomienda avisa con encomienda: true', async () => {
    const db = crearDb({ viaje: viajeEn('en_curso', { tipo_servicio: 'encomienda' }) });
    await viajeEnCurso.iniciarViaje(pedir({ db }), res());
    expect(db.rpc).toHaveBeenCalledWith('iniciar_viaje', { p_viaje: VIAJE });
    expect(mockDespachador.avisarViaje).toHaveBeenCalledWith(PASAJERO, { viajeId: VIAJE, cambio: 'en_curso', encomienda: true });
  });

  test('«Llegamos» del conductor avisa al pasajero para confirmar y calificar, sin sanción', async () => {
    const db = crearDb({ viaje: viajeEn('finalizado', { finalizado_por: 'conductor' }) });
    const r = res();
    await viajeEnCurso.terminarViaje(pedir({ db }), r);
    expect(db.rpc).toHaveBeenCalledWith('terminar_viaje', { p_viaje: VIAJE });
    expect(cuerpo(r).data).not.toHaveProperty('sancion');
    expect(mockDespachador.avisarViaje).toHaveBeenCalledWith(PASAJERO, { viajeId: VIAJE, cambio: 'finalizado', encomienda: false });
  });
});

describe('T4b · el pasajero finaliza (criterio 5b)', () => {
  test('responde cuántas lleva y el tope, y avisa al conductor que quedó libre', async () => {
    const db = crearDb({
      viaje: viajeEn('finalizado', { finalizado_por: 'pasajero' }),
      finalizados: [{ finalizado_en: new Date().toISOString() }, { finalizado_en: new Date(Date.now() - DIA).toISOString() }],
    });
    const r = res();
    await viajeEnCurso.terminarViaje(pedir({ db, user: { id: PASAJERO } }), r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(cuerpo(r).data.sancion).toEqual({ llevas: 2, max: 3, ventanaDias: 30, bloqueoHoras: 24 });
    expect(mockDespachador.avisarViaje).toHaveBeenCalledWith(CONDUCTOR, { viajeId: VIAJE, cambio: 'finalizado_por_pasajero', encomienda: false });
    expect(mockDespachador.avisarViaje).toHaveBeenCalledTimes(1);
  });
});

describe('T3 y T4 · cancelar con motivo (criterio 8)', () => {
  test('un motivo fuera de la lista no llega a la BD', async () => {
    const db = crearDb();
    const r = res();
    await viajeEnCurso.cancelarViaje(pedir({ db, body: { motivo: 'me_aburri' } }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  test('el pasajero cancela un viaje aceptado: se avisa al conductor', async () => {
    const db = crearDb({ viaje: viajeEn('cancelado', { cancelado_por: 'pasajero', motivo_cancelacion: 'tarda_demasiado' }) });
    await viajeEnCurso.cancelarViaje(pedir({ db, user: { id: PASAJERO }, body: { motivo: 'tarda_demasiado' } }), res());
    expect(db.rpc).toHaveBeenCalledWith('cancelar_viaje', { p_viaje: VIAJE, p_motivo: 'tarda_demasiado' });
    expect(mockDespachador.avisarViaje).toHaveBeenCalledWith(CONDUCTOR, { viajeId: VIAJE, cambio: 'cancelado_por_pasajero', encomienda: false });
    expect(mockDespachador.cancelar).not.toHaveBeenCalled();
  });

  test('el conductor cancela: se avisa al pasajero', async () => {
    const db = crearDb({ viaje: viajeEn('cancelado', { cancelado_por: 'conductor', motivo_cancelacion: 'no_encuentro_al_pasajero' }) });
    await viajeEnCurso.cancelarViaje(pedir({ db, body: { motivo: 'no_encuentro_al_pasajero' } }), res());
    expect(mockDespachador.avisarViaje).toHaveBeenCalledWith(PASAJERO, { viajeId: VIAJE, cambio: 'cancelado_por_conductor', encomienda: false });
  });

  test('mientras busca (sin conductor) retira las ofertas, como en el 003', async () => {
    const db = crearDb({ viaje: viajeEn('cancelado', { conductor_id: null, cancelado_por: 'pasajero' }) });
    await viajeEnCurso.cancelarViaje(pedir({ db, user: { id: PASAJERO } }), res());
    expect(db.rpc).toHaveBeenCalledWith('cancelar_viaje', { p_viaje: VIAJE, p_motivo: null });
    expect(mockDespachador.cancelar).toHaveBeenCalledWith(VIAJE);
    expect(mockDespachador.avisarViaje).not.toHaveBeenCalled();
  });
});

describe('T3 · confirmar y calificar (criterios 5a, 15, 16 y 19)', () => {
  test.each([undefined, 'si', 1, null])('confirmar exige llego booleano (%p)', async (llego) => {
    const db = crearDb();
    const r = res();
    await viajeEnCurso.confirmarLlegada(pedir({ db, user: { id: PASAJERO }, body: { llego } }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  test('«No llegué» se registra', async () => {
    const db = crearDb({ viaje: viajeEn('finalizado', { confirmacion_pasajero: 'no_llego' }) });
    const r = res();
    await viajeEnCurso.confirmarLlegada(pedir({ db, user: { id: PASAJERO }, body: { llego: false } }), r);
    expect(db.rpc).toHaveBeenCalledWith('confirmar_llegada', { p_viaje: VIAJE, p_llego: false });
    expect(r.status).toHaveBeenCalledWith(200);
  });

  test.each([0, 6, 3.5, '5', undefined])('calificar exige de 1 a 5 estrellas (%p)', async (estrellas) => {
    const db = crearDb();
    const r = res();
    await viajeEnCurso.calificarViaje(pedir({ db, user: { id: PASAJERO }, body: { estrellas } }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  test('un comentario con teléfono no llega a la BD', async () => {
    const db = crearDb();
    const r = res();
    await viajeEnCurso.calificarViaje(pedir({ db, user: { id: PASAJERO }, body: { estrellas: 5, comentario: 'escríbeme 0991234567' } }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  test('califica con el comentario recortado; vacío se guarda como null', async () => {
    const db = crearDb({ viaje: viajeEn('finalizado') });
    const r = res();
    await viajeEnCurso.calificarViaje(pedir({ db, user: { id: PASAJERO }, body: { estrellas: 4, comentario: '  Muy amable  ' } }), r);
    expect(db.rpc).toHaveBeenCalledWith('calificar_viaje', { p_viaje: VIAJE, p_estrellas: 4, p_comentario: 'Muy amable' });
    expect(cuerpo(r).data).toEqual({ id: VIAJE });

    await viajeEnCurso.calificarViaje(pedir({ db, user: { id: PASAJERO }, body: { estrellas: 5, comentario: '  ' } }), res());
    expect(db.rpc).toHaveBeenLastCalledWith('calificar_viaje', { p_viaje: VIAJE, p_estrellas: 5, p_comentario: null });
  });
});

describe('T4 · reseñas (criterios 17 y 18)', () => {
  test('el conductor ve sus reseñas sin autor, con promedio numérico', async () => {
    const resenas = [{ estrellas: 5, comentario: 'Puntual', fecha: '2026-10-20' }];
    const db = crearDb({ datos: { mis_resenas: resenas, resumen_conductor: [{ promedio: '4.67', total: 3 }] } });
    const r = res();
    await viajeEnCurso.misResenas({ user: { id: CONDUCTOR }, supabase: db }, r);
    expect(db.rpc).toHaveBeenCalledWith('resumen_conductor', { p_conductor: CONDUCTOR });
    expect(cuerpo(r).data).toEqual({ promedio: 4.67, total: 3, resenas });
  });

  test('sin reseñas: promedio null y total 0 (la app muestra «Nuevo»)', async () => {
    const db = crearDb({ datos: { mis_resenas: [], resumen_conductor: [{ promedio: null, total: 0 }] } });
    const r = res();
    await viajeEnCurso.misResenas({ user: { id: CONDUCTOR }, supabase: db }, r);
    expect(cuerpo(r).data).toEqual({ promedio: null, total: 0, resenas: [] });
  });

  test('si falla la lectura responde 500 sin detalles', async () => {
    const db = crearDb({ errores: { mis_resenas: errorBd('permission denied for table calificaciones', '42501') } });
    const r = res();
    await viajeEnCurso.misResenas({ user: { id: CONDUCTOR }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(cuerpo(r))).not.toContain('calificaciones');
  });

  test('el resumen para el pasajero no detiene la aceptación si falla', async () => {
    const db = crearDb({ errores: { resumen_conductor: errorBd('boom') } });
    await expect(viajeEnCurso.resumenDelConductor(db, CONDUCTOR)).resolves.toEqual({ promedio: null, total: 0 });
  });
});

// ─── T4 · avisos ─────────────────────────────────────────────────────────────
describe('T4 · avisos del viaje en curso (plan P7)', () => {
  const TOKEN = 'ExponentPushToken[abcdefghij0123456789]';

  test.each(Object.keys(TEXTOS_VIAJE))('%s: texto de viaje y de encomienda, sin nombre ni teléfono', (cambio) => {
    for (const encomienda of [false, true]) {
      const [aviso] = avisoEstadoViaje({ viajeId: VIAJE, cambio, encomienda }, [TOKEN]);
      expect(aviso).toMatchObject({ to: TOKEN, channelId: 'viaje', data: { tipo: 'viaje_estado', viajeId: VIAJE, cambio } });
      expect(aviso.title.length).toBeGreaterThan(0);
      // Sin datos personales: ni teléfonos en el texto, ni el id del pasajero o del conductor.
      expect(`${aviso.title} ${aviso.body}`).not.toMatch(/\d{7,}/);
      expect(JSON.stringify(aviso)).not.toContain(PASAJERO);
      expect(JSON.stringify(aviso)).not.toContain(CONDUCTOR);
    }
  });

  test('los textos de encomienda hablan del paquete', () => {
    expect(avisoEstadoViaje({ viajeId: VIAJE, cambio: 'en_curso', encomienda: true }, [TOKEN])[0].title).toBe('Recogimos tu paquete');
    expect(avisoEstadoViaje({ viajeId: VIAJE, cambio: 'finalizado', encomienda: true }, [TOKEN])[0].title).toBe('Tu paquete fue entregado');
    expect(avisoEstadoViaje({ viajeId: VIAJE, cambio: 'llegada' }, [TOKEN])[0].title).toBe('Tu tricimoto llegó');
  });

  test('un cambio desconocido no envía nada', () => {
    expect(avisoEstadoViaje({ viajeId: VIAJE, cambio: 'inventado' }, [TOKEN])).toEqual([]);
  });

  test('el despachador lo envía por socket y con la app cerrada; si el aviso falla, no lanza', async () => {
    const emitidos = [];
    const io = { to: (sala) => ({ emit: (evento, datos) => emitidos.push({ sala, evento, datos }) }) };
    const avisos = { estadoViaje: jest.fn(() => Promise.reject(new Error('Expo caído'))) };
    const despachador = crearDespachador({ obtenerDb: () => null, io, conexiones: { estaConectado: () => true }, config: {}, avisos });
    const datos = { viajeId: VIAJE, cambio: 'llegada', encomienda: false };

    expect(() => despachador.avisarViaje(PASAJERO, datos)).not.toThrow();
    expect(emitidos).toEqual([{ sala: `usuario:${PASAJERO}`, evento: 'viaje_estado', datos }]);
    expect(avisos.estadoViaje).toHaveBeenCalledWith(PASAJERO, datos);

    despachador.avisarViaje(null, datos); // sin destinatario no hace nada
    expect(emitidos).toHaveLength(1);
    await Promise.resolve();
  });
});

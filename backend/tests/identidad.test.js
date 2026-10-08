/**
 * Paso 002: identidad, consentimiento y aprobación de conductores.
 * Criterios de la spec: 1 (consentimiento), 3 (aprobar/rechazar), 5 (fotos privadas).
 */
const ADMIN = '0a1b2c3d-0000-4000-8000-0000000000a1';
const COND = '0a1b2c3d-0000-4000-8000-0000000000c1';

jest.mock('../src/config/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() } },
  createUserClient: jest.fn(),
}));

const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

/** Consulta encadenable: cada método devuelve la misma consulta y al esperarla resuelve `result`. */
const consulta = (result) => {
  const q = {};
  ['select', 'insert', 'update', 'eq', 'in', 'order', 'single', 'maybeSingle'].forEach((m) => {
    q[m] = jest.fn(() => q);
  });
  q.then = (ok, fail) => Promise.resolve(result).then(ok, fail);
  return q;
};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('validación de cédula ecuatoriana', () => {
  const { isCedulaValida, normalizarCedula, isMotivoValido } = require('../src/utils/validation');

  it('acepta una cédula con dígito verificador correcto', () => {
    expect(isCedulaValida('1710034065')).toBe(true);
  });

  it.each([
    ['dígito verificador incorrecto', '1710034066'],
    ['todo ceros', '0000000000'],
    ['provincia inexistente', '9910034065'],
    ['tercer dígito mayor a 5', '1760034065'],
    ['menos de 10 dígitos', '171003406'],
    ['con letras', '17100340a5'],
  ])('rechaza: %s', (_n, cedula) => {
    expect(isCedulaValida(cedula)).toBe(false);
  });

  it('rechaza lo que no es texto', () => {
    expect(isCedulaValida(1710034065)).toBe(false);
    expect(isCedulaValida(null)).toBe(false);
  });

  it('normaliza espacios y guiones', () => {
    expect(normalizarCedula(' 171003-4065 ')).toBe('1710034065');
  });

  it('el motivo de rechazo tiene entre 3 y 300 caracteres', () => {
    expect(isMotivoValido('ab')).toBe(false);
    expect(isMotivoValido('La foto no se lee')).toBe(true);
    expect(isMotivoValido('a'.repeat(301))).toBe(false);
  });
});

describe('registro con consentimiento (criterio 1)', () => {
  const { registerProfile } = require('../src/controllers/authController');
  const { CONSENT_VERSION } = require('../src/config/consent');

  it('sin consentimiento no toca la BD', async () => {
    const db = { from: jest.fn() };
    const r = res();
    await registerProfile({
      body: { rol: 'pasajero', nombre: 'Maria Lopez', telefono: '0988888888' },
      user: { id: 'u1' },
      supabase: db,
    }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('tratamiento de tus datos') }));
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([false, 'true', 1, null])('consentimiento = %p no cuenta como aceptado', async (valor) => {
    const db = { from: jest.fn() };
    const r = res();
    await registerProfile({
      body: { consentimiento: valor, rol: 'pasajero', nombre: 'Maria Lopez', telefono: '0988888888' },
      user: { id: 'u1' },
      supabase: db,
    }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('guarda el consentimiento con la versión del servidor antes de crear el perfil', async () => {
    const orden = [];
    const db = {
      from: jest.fn((tabla) => {
        orden.push(tabla);
        return consulta({ data: { id: 'u1' }, error: null });
      }),
    };
    const r = res();
    await registerProfile({
      body: { consentimiento: true, version: '9.9', rol: 'pasajero', nombre: 'Maria Lopez', telefono: '0988888888' },
      user: { id: 'u1' },
      supabase: db,
    }, r);
    expect(orden).toEqual(['consentimientos', 'perfiles']);
    const insertConsent = db.from.mock.results[0].value.insert.mock.calls[0][0];
    expect(insertConsent).toEqual([{ user_id: 'u1', version: CONSENT_VERSION }]);
    expect(r.status).toHaveBeenCalledWith(201);
  });

  it('si no se puede guardar el consentimiento no crea el perfil', async () => {
    const db = {
      from: jest.fn((tabla) => consulta(tabla === 'consentimientos'
        ? { data: null, error: { message: 'rls' } }
        : { data: { id: 'u1' }, error: null })),
    };
    const r = res();
    await registerProfile({
      body: { consentimiento: true, rol: 'pasajero', nombre: 'Maria Lopez', telefono: '0988888888' },
      user: { id: 'u1' },
      supabase: db,
    }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).toHaveBeenCalledTimes(1);
  });
});

describe('conductorController · verificación del conductor', () => {
  const { enviarVerificacion, obtenerMiVerificacion } = require('../src/controllers/conductorController');

  const dbCon = ({ archivos = ['conductor.jpg', 'cedula.jpg', 'vehiculo.jpg'], existente = null, guardado } = {}) => {
    const from = jest.fn();
    // 1.ª consulta: estado actual; 2.ª: insert/update
    from.mockReturnValueOnce(consulta({ data: existente, error: null }));
    from.mockReturnValueOnce(consulta(guardado || { data: { conductor_id: COND, estado: 'pendiente' }, error: null }));
    return {
      from,
      storage: { from: jest.fn(() => ({ list: jest.fn().mockResolvedValue({ data: archivos.map((name) => ({ name })), error: null }) })) },
    };
  };

  it('rechaza una cédula inválida sin consultar nada', async () => {
    const db = dbCon();
    const r = res();
    await enviarVerificacion({ body: { cedula: '1710034066' }, user: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.storage.from).not.toHaveBeenCalled();
  });

  it('pide subir las fotos que faltan (criterio 5)', async () => {
    const db = dbCon({ archivos: ['conductor.jpg'] });
    const r = res();
    await enviarVerificacion({ body: { cedula: '1710034065' }, user: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('cedula, vehiculo') }));
    expect(db.from).not.toHaveBeenCalled();
  });

  it('crea la solicitud con rutas dentro de la carpeta del propio conductor', async () => {
    const db = dbCon();
    const r = res();
    await enviarVerificacion({ body: { cedula: ' 171003-4065 ' }, user: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    const insertado = db.from.mock.results[1].value.insert.mock.calls[0][0][0];
    expect(insertado).toEqual({
      conductor_id: COND,
      cedula: '1710034065',
      foto_conductor: `${COND}/conductor.jpg`,
      foto_cedula: `${COND}/cedula.jpg`,
      foto_vehiculo: `${COND}/vehiculo.jpg`,
    });
  });

  it('una solicitud rechazada se reenvía con update', async () => {
    const db = dbCon({ existente: { estado: 'rechazado' } });
    const r = res();
    await enviarVerificacion({ body: { cedula: '1710034065' }, user: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(200);
    expect(db.from.mock.results[1].value.update).toHaveBeenCalled();
    expect(db.from.mock.results[1].value.insert).not.toHaveBeenCalled();
  });

  it('un conductor ya aprobado no puede reenviar', async () => {
    const db = dbCon({ existente: { estado: 'aprobado' } });
    const r = res();
    await enviarVerificacion({ body: { cedula: '1710034065' }, user: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  it('una cédula repetida en otra cuenta responde 409', async () => {
    const db = dbCon({ guardado: { data: null, error: { code: '23505', message: 'duplicate key' } } });
    const r = res();
    await enviarVerificacion({ body: { cedula: '1710034065' }, user: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(409);
  });

  it('sin solicitud enviada, el estado es sin_enviar', async () => {
    const db = { from: jest.fn(() => consulta({ data: null, error: null })) };
    const r = res();
    await obtenerMiVerificacion({ user: { id: COND }, supabase: db }, r);
    expect(r.json).toHaveBeenCalledWith({ status: 'success', data: { estado: 'sin_enviar' } });
  });
});

describe('adminController · revisión de conductores (criterio 3)', () => {
  const ctl = require('../src/controllers/adminController');

  it('lista pendientes por defecto y añade la placa', async () => {
    const solicitudes = consulta({ data: [{ conductor_id: COND, estado: 'pendiente', perfiles: { nombre: 'Carla' } }], error: null });
    const motos = consulta({ data: [{ conductor_id: COND, placa: 'ABC-123' }], error: null });
    const db = { from: jest.fn().mockReturnValueOnce(solicitudes).mockReturnValueOnce(motos) };
    const r = res();
    await ctl.listarConductores({ query: {}, supabase: db }, r);
    expect(solicitudes.eq).toHaveBeenCalledWith('estado', 'pendiente');
    expect(r.json).toHaveBeenCalledWith({ status: 'success', data: [expect.objectContaining({ conductor_id: COND, placa: 'ABC-123' })] });
  });

  it('rechaza un estado desconocido', async () => {
    const r = res();
    await ctl.listarConductores({ query: { estado: 'cualquiera' }, supabase: { from: jest.fn() } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('el detalle devuelve enlaces firmados de 5 minutos', async () => {
    const createSignedUrls = jest.fn().mockResolvedValue({
      data: [{ signedUrl: 'https://x/a' }, { signedUrl: 'https://x/b' }, { signedUrl: 'https://x/c' }],
      error: null,
    });
    const db = {
      from: jest.fn(() => consulta({ data: { conductor_id: COND, cedula: '1710034065', estado: 'pendiente' }, error: null })),
      storage: { from: jest.fn(() => ({ createSignedUrls })) },
    };
    const r = res();
    await ctl.verConductor({ params: { id: COND }, supabase: db }, r);
    expect(createSignedUrls).toHaveBeenCalledWith([`${COND}/conductor.jpg`, `${COND}/cedula.jpg`, `${COND}/vehiculo.jpg`], 300);
    expect(r.json).toHaveBeenCalledWith({
      status: 'success',
      data: expect.objectContaining({ fotos: { conductor: 'https://x/a', cedula: 'https://x/b', vehiculo: 'https://x/c' } }),
    });
  });

  it('el detalle de una solicitud inexistente es 404', async () => {
    const db = { from: jest.fn(() => consulta({ data: null, error: null })), storage: { from: jest.fn() } };
    const r = res();
    await ctl.verConductor({ params: { id: COND }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(db.storage.from).not.toHaveBeenCalled();
  });

  it('aprobar registra quién revisó y solo actúa sobre solicitudes pendientes', async () => {
    const q = consulta({ data: { conductor_id: COND, estado: 'aprobado' }, error: null });
    const db = { from: jest.fn(() => q) };
    const r = res();
    await ctl.aprobarConductor({ params: { id: COND }, user: { id: ADMIN }, supabase: db }, r);
    expect(q.update).toHaveBeenCalledWith({ estado: 'aprobado', revisado_por: ADMIN });
    expect(q.eq).toHaveBeenCalledWith('estado', 'pendiente');
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Conductor aprobado.' }));
  });

  it('aprobar algo que ya no está pendiente es 404', async () => {
    const db = { from: jest.fn(() => consulta({ data: null, error: null })) };
    const r = res();
    await ctl.aprobarConductor({ params: { id: COND }, user: { id: ADMIN }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('rechazar exige un motivo', async () => {
    const db = { from: jest.fn() };
    const r = res();
    await ctl.rechazarConductor({ params: { id: COND }, body: { motivo: ' a ' }, user: { id: ADMIN }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('rechazar guarda el motivo y el revisor', async () => {
    const q = consulta({ data: { conductor_id: COND, estado: 'rechazado' }, error: null });
    const db = { from: jest.fn(() => q) };
    const r = res();
    await ctl.rechazarConductor({ params: { id: COND }, body: { motivo: ' La foto de la cédula no se lee ' }, user: { id: ADMIN }, supabase: db }, r);
    expect(q.update).toHaveBeenCalledWith({ estado: 'rechazado', motivo_rechazo: 'La foto de la cédula no se lee', revisado_por: ADMIN });
  });

  it('rechaza identificadores que no son UUID', async () => {
    const r = res();
    await ctl.aprobarConductor({ params: { id: "1'; drop table" }, user: { id: ADMIN }, supabase: { from: jest.fn() } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

describe('rutas protegidas por rol', () => {
  const rolesDe = (rutaModulo) => {
    jest.resetModules();
    const roleMiddleware = jest.fn((roles) => Object.assign((req, _res, next) => next(), { roles }));
    jest.doMock('../src/middlewares/roleMiddleware', () => roleMiddleware);
    jest.doMock('../src/middlewares/authMiddleware', () => (req, _res, next) => next());
    require(rutaModulo);
    return roleMiddleware.mock.calls.map(([roles]) => roles);
  };

  afterAll(() => {
    jest.dontMock('../src/middlewares/roleMiddleware');
    jest.dontMock('../src/middlewares/authMiddleware');
  });

  it('las rutas de administración exigen rol admin', () => {
    expect(rolesDe('../src/routes/adminRoutes')).toEqual([['admin']]);
  });

  it('las rutas de verificación exigen rol conductor', () => {
    const llamadas = rolesDe('../src/routes/conductorRoutes');
    expect(llamadas.length).toBeGreaterThan(0);
    llamadas.forEach((roles) => expect(roles).toEqual(['conductor']));
  });
});

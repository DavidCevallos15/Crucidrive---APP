/**
 * Pruebas de los criterios de la spec 001 que viven en el backend.
 * Criterio 7: el backend opera con un cliente que lleva el JWT del usuario.
 */

describe('spec 001 · config/supabase', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV, SUPABASE_URL: 'https://demo.supabase.co', SUPABASE_ANON_KEY: 'anon-key' };
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('createUserClient envía el JWT del usuario en la cabecera Authorization', () => {
    const createClient = jest.fn(() => ({}));
    jest.doMock('@supabase/supabase-js', () => ({ createClient }));
    const { createUserClient } = require('../src/config/supabase');

    createUserClient('jwt-del-usuario');

    const [url, key, options] = createClient.mock.calls.at(-1);
    expect(url).toBe('https://demo.supabase.co');
    expect(key).toBe('anon-key');
    expect(options.global.headers.Authorization).toBe('Bearer jwt-del-usuario');
    expect(options.auth.persistSession).toBe(false);
  });

  it('getAdminClient falla si no hay clave de servicio (nunca cae en la clave anon)', () => {
    jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));
    const { getAdminClient } = require('../src/config/supabase');

    expect(() => getAdminClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('falla al arrancar si faltan las variables de Supabase', () => {
    delete process.env.SUPABASE_URL;
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));

    expect(() => require('../src/config/supabase')).toThrow('SUPABASE_URL');
  });
});

describe('spec 001 · authMiddleware adjunta el cliente del usuario', () => {
  beforeEach(() => jest.resetModules());

  it('pone en req.supabase un cliente creado con el token recibido', async () => {
    const createUserClient = jest.fn(() => ({ cliente: 'usuario' }));
    jest.doMock('../src/config/supabase', () => ({
      supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) } },
      createUserClient,
    }));
    const authMiddleware = require('../src/middlewares/authMiddleware');
    const req = { headers: { authorization: 'Bearer token-abc' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(createUserClient).toHaveBeenCalledWith('token-abc');
    expect(req.supabase).toEqual({ cliente: 'usuario' });
    expect(next).toHaveBeenCalled();
  });
});

describe('spec 001 · controladores alineados al esquema', () => {
  const crearDb = (respuestas) => {
    const llamadas = [];
    const db = {
      from: jest.fn((tabla) => {
        const q = {
          insert: jest.fn((filas) => { llamadas.push({ tabla, op: 'insert', filas }); return q; }),
          update: jest.fn((valores) => { llamadas.push({ tabla, op: 'update', valores }); return q; }),
          delete: jest.fn(() => q),
          select: jest.fn(() => q),
          eq: jest.fn(() => q),
          single: jest.fn(() => Promise.resolve(respuestas.shift() || { data: {}, error: null })),
          then: (ok) => Promise.resolve({ error: null }).then(ok),
        };
        return q;
      }),
    };
    return { db, llamadas };
  };
  const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../src/config/supabase', () => ({ supabase: {} }));
  });

  it('registerProfile normaliza la placa a mayúsculas sin espacios', async () => {
    const { registerProfile } = require('../src/controllers/authController');
    const { db, llamadas } = crearDb([{ data: { id: 'u1' }, error: null }, { data: { id: 't1' }, error: null }]);
    const req = { body: { consentimiento: true, rol: 'conductor', nombre: 'Ana', telefono: '0991234567', placa: ' ab-123c ' }, user: { id: 'u1' }, supabase: db };

    await registerProfile(req, res());

    const moto = llamadas.find((l) => l.tabla === 'tricimotos');
    expect(moto.filas[0].placa).toBe('AB-123C');
  });

  it('aceptarViaje registra aceptado_en y crea el hilo con created_by', async () => {
    const { aceptarViaje } = require('../src/controllers/viajeController');
    const { db, llamadas } = crearDb([
      { data: { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'solicitado', pasajero_id: 'p1' }, error: null },
      { data: { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'aceptado' }, error: null },
      { data: { id: '0b1c2d3e-0000-4000-8000-000000000001' }, error: null },
    ]);
    const req = { body: { viajeId: '0a1b2c3d-0000-4000-8000-000000000001' }, user: { id: 'c1' }, supabase: db };

    await aceptarViaje(req, res());

    const upd = llamadas.find((l) => l.tabla === 'viajes' && l.op === 'update');
    expect(upd.valores).toEqual(expect.objectContaining({ estado: 'aceptado', conductor_id: 'c1', aceptado_en: expect.any(String) }));
    expect(upd.valores).not.toHaveProperty('updated_at');
    const hilo = llamadas.find((l) => l.tabla === 'threads');
    expect(hilo.filas[0]).toEqual({ viaje_id: '0a1b2c3d-0000-4000-8000-000000000001', created_by: 'c1' });
  });

  it('cambiarEstadoViaje a finalizado registra finalizado_en y no envía updated_at', async () => {
    const { cambiarEstadoViaje } = require('../src/controllers/viajeController');
    const { db, llamadas } = crearDb([
      { data: { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'en_curso', pasajero_id: 'p1', conductor_id: 'c1' }, error: null },
      { data: { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'finalizado' }, error: null },
    ]);
    const req = { params: { id: '0a1b2c3d-0000-4000-8000-000000000001' }, body: { estado: 'finalizado' }, user: { id: 'c1' }, supabase: db };

    await cambiarEstadoViaje(req, res());

    const upd = llamadas.find((l) => l.op === 'update');
    expect(upd.valores).toEqual({ estado: 'finalizado', finalizado_en: expect.any(String) });
  });
});

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/config/supabase', () => ({ createAuthClient: jest.fn(), getAdminClient: jest.fn() }));
const { createAuthClient, getAdminClient } = require('../src/config/supabase');
const { eliminarCuenta } = require('../src/controllers/cuentaController');

function setup() {
  const checker = { auth: { signInWithPassword: jest.fn(async () => ({ data: { user: { id: 'u' } }, error: null })), signOut: jest.fn(async () => ({ error: null })) } };
  createAuthClient.mockReturnValue(checker);
  const bucket = { list: jest.fn(async () => ({ data: [{ name: 'conductor.jpg' }], error: null })), remove: jest.fn(async () => ({ error: null })) };
  const eq = jest.fn(async () => ({ data: [], error: null }));
  const admin = { storage: { from: jest.fn(() => bucket) }, from: jest.fn(() => ({ delete: () => ({ eq, in: jest.fn(async () => ({ error: null })) }), select: () => ({ eq }) })), rpc: jest.fn(async () => ({ error: null })) };
  getAdminClient.mockReturnValue(admin);
  const limit = jest.fn(async () => ({ data: [], error: null }));
  const req = { body: { password: 'contraseña-de-prueba', confirmacion: 'ELIMINAR' }, user: { id: 'u', email: 'cuenta@example.test' }, supabase: { from: jest.fn(() => ({ select: () => ({ or: () => ({ in: () => ({ limit }) }) }) })) } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  return { checker, bucket, admin, limit, req, res };
}

describe('eliminar la cuenta propia', () => {
  beforeEach(() => jest.clearAllMocks());
  it('requiere confirmación explícita antes de reautenticar', async () => {
    const s = setup(); s.req.body.confirmacion = '';
    await eliminarCuenta(s.req, s.res);
    expect(s.res.status).toHaveBeenCalledWith(400); expect(s.checker.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it('una contraseña incorrecta no permite tocar datos', async () => {
    const s = setup(); s.checker.auth.signInWithPassword.mockResolvedValue({ data: null, error: new Error('incorrecta') });
    await eliminarCuenta(s.req, s.res);
    expect(s.res.status).toHaveBeenCalledWith(401); expect(s.admin.rpc).not.toHaveBeenCalled();
  });
  it('bloquea la eliminación mientras existe un servicio activo', async () => {
    const s = setup(); s.limit.mockResolvedValue({ data: [{ id: 'activo' }], error: null });
    await eliminarCuenta(s.req, s.res);
    expect(s.res.status).toHaveBeenCalledWith(409); expect(s.bucket.remove).not.toHaveBeenCalled();
  });
  it('un error de archivo no termina eliminando el usuario', async () => {
    const s = setup(); s.bucket.remove.mockResolvedValue({ error: new Error('storage') });
    await eliminarCuenta(s.req, s.res);
    expect(s.res.status).toHaveBeenCalledWith(503); expect(s.admin.rpc).not.toHaveBeenCalled();
  });
  it('solo elimina archivos, mensajes y el usuario autenticado, sin aceptar otro id del cliente', async () => {
    const s = setup(); s.req.body.usuarioId = 'otra-persona';
    await eliminarCuenta(s.req, s.res);
    expect(s.res.status).toHaveBeenCalledWith(200);
    expect(s.bucket.remove).toHaveBeenCalledWith(['u/conductor.jpg']);
    expect(s.admin.rpc).toHaveBeenCalledWith('eliminar_cuenta_crucidrive', { p_usuario: 'u' });
  });
});

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);

jest.mock('../src/config/supabase', () => {
  const mockSingle = jest.fn();
  const mockSelect = jest.fn(() => ({ single: mockSingle }));
  const mockInsert = jest.fn(() => ({ select: mockSelect }));
  const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
  const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));
  const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    delete: mockDelete,
  }));

  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
    __mockInsert: mockInsert,
    __mockSelect: mockSelect,
    __mockSingle: mockSingle,
    __mockDelete: mockDelete,
    __mockDeleteEq: mockDeleteEq,
  };
});

const { registerProfile } = require('../src/controllers/authController');
const {
  __mockFrom,
  __mockInsert,
  __mockSelect,
  __mockSingle,
  __mockDelete,
  __mockDeleteEq,
} = require('../src/config/supabase');

describe('authController - registerProfile', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 'user-123' }, supabase: require('../src/config/supabase').supabase,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();

    __mockFrom.mockReturnValue({
      insert: __mockInsert,
      delete: __mockDelete,
    });
    __mockInsert.mockReturnValue({ select: __mockSelect });
    __mockSelect.mockReturnValue({ single: __mockSingle });
    __mockDelete.mockReturnValue({ eq: __mockDeleteEq });
  });

  it('should return 400 if rol is missing', async () => {
    req.body = { nombre: 'Juan', telefono: '0999999999' };

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('Faltan campos requeridos'),
      })
    );
  });

  it('should return 400 if nombre is missing', async () => {
    req.body = { consentimiento: true, rol: 'pasajero', telefono: '0999999999' };

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 if telefono is missing', async () => {
    req.body = { consentimiento: true, rol: 'pasajero', nombre: 'Juan' };

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 400 if rol is invalid', async () => {
    req.body = { consentimiento: true, rol: 'admin', nombre: 'Juan', telefono: '0999999999' };

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('El rol debe ser'),
      })
    );
  });

  it('should return 400 if rol is conductor but placa is missing', async () => {
    req.body = { consentimiento: true, rol: 'conductor', nombre: 'Carlos', telefono: '0999999999' };

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('placa es obligatoria'),
      })
    );
  });

  it('should register a pasajero profile successfully', async () => {
    req.body = { consentimiento: true, rol: 'pasajero', nombre: 'Maria', telefono: '0988888888' };
    const mockPerfil = { id: 'user-123', rol: 'pasajero', nombre: 'Maria', telefono: '0988888888', activo: true };
    __mockSingle.mockResolvedValue({ data: mockPerfil, error: null });

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: {
          perfil: mockPerfil,
          tricimoto: null,
        },
      })
    );
  });

  it('should register a conductor profile with tricimoto', async () => {
    req.body = { consentimiento: true, rol: 'conductor', nombre: 'Carlos', telefono: '0977777777', placa: 'ABC-123' };
    const mockPerfil = { id: 'user-123', rol: 'conductor', nombre: 'Carlos', telefono: '0977777777', activo: true };
    const mockTricimoto = { conductor_id: 'user-123', placa: 'ABC-123', estado: 'inactivo' };

    __mockFrom.mockImplementation((table) => {
      if (table === 'consentimientos') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'perfiles') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockPerfil, error: null }),
            })),
          })),
          delete: __mockDelete,
        };
      }
      if (table === 'tricimotos') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockTricimoto, error: null }),
            })),
          })),
        };
      }
    });

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          perfil: mockPerfil,
          tricimoto: mockTricimoto,
        }),
      })
    );
  });

  it('should return 400 if profile insert fails', async () => {
    req.body = { consentimiento: true, rol: 'pasajero', nombre: 'Ana', telefono: '0966666666' };
    __mockSingle.mockResolvedValue({ data: null, error: { message: 'Duplicate key' } });

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('Error al registrar el perfil'),
      })
    );
  });

  it('should rollback profile and return 400 if tricimoto insert fails', async () => {
    req.body = { consentimiento: true, rol: 'conductor', nombre: 'Pedro', telefono: '0955555555', placa: 'XYZ-789' };
    const mockPerfil = { id: 'user-123', rol: 'conductor', nombre: 'Pedro' };

    __mockFrom.mockImplementation((table) => {
      if (table === 'consentimientos') {
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }
      if (table === 'perfiles') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: mockPerfil, error: null }),
            })),
          })),
          delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
        };
      }
      if (table === 'tricimotos') {
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Placa duplicada' } }),
            })),
          })),
        };
      }
    });

    await registerProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('tricimoto'),
      })
    );
  });
});

const roleMiddleware = require('../src/middlewares/roleMiddleware');

jest.mock('../src/config/supabase', () => {
  const mockSingle = jest.fn();
  const mockEq = jest.fn(() => ({ single: mockSingle }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));

  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
    __mockEq: mockEq,
    __mockSingle: mockSingle,
  };
});

const { __mockFrom, __mockSelect, __mockEq, __mockSingle } = require('../src/config/supabase');

describe('roleMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-123' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();

    // Reset the chain
    __mockFrom.mockReturnValue({ select: __mockSelect });
    __mockSelect.mockReturnValue({ eq: __mockEq });
    __mockEq.mockReturnValue({ single: __mockSingle });
  });

  it('should return 401 if req.user is not present', async () => {
    req.user = null;
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('no autenticado'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if req.user.id is missing', async () => {
    req.user = {};
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if user profile is not found in database', async () => {
    __mockSingle.mockResolvedValue({ data: null, error: null });
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('No se encontró el perfil'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if supabase returns an error', async () => {
    __mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user role is not in allowedRoles', async () => {
    __mockSingle.mockResolvedValue({
      data: { rol: 'pasajero' },
      error: null,
    });
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('Acceso denegado'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and attach role if user has allowed role', async () => {
    __mockSingle.mockResolvedValue({
      data: { rol: 'conductor' },
      error: null,
    });
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(req.user.rol).toBe('conductor');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should accept multiple allowed roles', async () => {
    __mockSingle.mockResolvedValue({
      data: { rol: 'pasajero' },
      error: null,
    });
    const middleware = roleMiddleware(['pasajero', 'conductor']);

    await middleware(req, res, next);

    expect(req.user.rol).toBe('pasajero');
    expect(next).toHaveBeenCalled();
  });

  it('should return 500 on unexpected exception', async () => {
    __mockSingle.mockRejectedValue(new Error('Unexpected'));
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        details: 'Unexpected',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

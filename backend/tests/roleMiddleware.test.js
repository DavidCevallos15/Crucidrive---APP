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

const roleMiddleware = require('../src/middlewares/roleMiddleware');
const { __mockSingle } = require('../src/config/supabase');

describe('roleMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-123' }, supabase: require('../src/config/supabase').supabase };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if req.user is missing', async () => {
    req.user = null;
    const middleware = roleMiddleware(['pasajero']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if req.user.id is missing', async () => {
    req.user = {};
    const middleware = roleMiddleware(['pasajero']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if profile is not found', async () => {
    __mockSingle.mockResolvedValue({ data: null, error: null });
    const middleware = roleMiddleware(['pasajero']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if supabase returns error', async () => {
    __mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const middleware = roleMiddleware(['pasajero']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user role is not in allowedRoles', async () => {
    __mockSingle.mockResolvedValue({ data: { rol: 'pasajero' }, error: null });
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Acceso denegado'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and attach role if user role is allowed', async () => {
    __mockSingle.mockResolvedValue({ data: { rol: 'conductor' }, error: null });
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(req.user.rol).toBe('conductor');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should accept multiple allowed roles', async () => {
    __mockSingle.mockResolvedValue({ data: { rol: 'pasajero' }, error: null });
    const middleware = roleMiddleware(['conductor', 'pasajero']);

    await middleware(req, res, next);

    expect(req.user.rol).toBe('pasajero');
    expect(next).toHaveBeenCalled();
  });

  it('should return 500 on unexpected exception', async () => {
    __mockSingle.mockRejectedValue(new Error('Crash'));
    const middleware = roleMiddleware(['conductor']);

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

jest.mock('../src/config/supabase', () => {
  const mockGetUser = jest.fn();
  return {
    supabase: {
      auth: { getUser: mockGetUser },
    },
    __mockGetUser: mockGetUser,
  };
});

const authMiddleware = require('../src/middlewares/authMiddleware');
const { __mockGetUser } = require('../src/config/supabase');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if authorization header is missing', async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('Bearer'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token does not start with Bearer', async () => {
    req.headers.authorization = 'Basic some-token';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if supabase returns error', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    __mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'Token expired' } });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if no user is returned', async () => {
    req.headers.authorization = 'Bearer some-token';
    __mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user and call next on valid token', async () => {
    req.headers.authorization = 'Bearer valid-token';
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    __mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    await authMiddleware(req, res, next);

    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 500 on unexpected exception', async () => {
    req.headers.authorization = 'Bearer crash-token';
    __mockGetUser.mockRejectedValue(new Error('Connection lost'));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

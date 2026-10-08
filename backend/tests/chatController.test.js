jest.mock('../src/utils/asyncHandler', () => (fn) => fn);

jest.mock('../src/config/supabase', () => {
  const mockOrder = jest.fn();
  const mockEq = jest.fn(() => ({ order: mockOrder }));
  const mockSelect = jest.fn(() => ({ eq: mockEq }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));

  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
    __mockEq: mockEq,
    __mockOrder: mockOrder,
  };
});

jest.mock('../src/utils/supabaseHelpers', () => ({
  checkThreadMembership: jest.fn(),
}));

const { getHistorialChat } = require('../src/controllers/chatController');
const { checkThreadMembership } = require('../src/utils/supabaseHelpers');
const {
  __mockFrom,
  __mockSelect,
  __mockEq,
  __mockOrder,
} = require('../src/config/supabase');

describe('chatController - getHistorialChat', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      user: { id: 'user-123' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  it('should return 400 if threadId is missing', async () => {
    req.params = {};

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('threadId'),
      })
    );
  });

  it('should return 500 if member lookup returns an error', async () => {
    req.params = { threadId: 'thread-1' };
    checkThreadMembership.mockResolvedValue({ member: null, error: { message: 'DB error' } });

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('verificar la afiliación'),
      })
    );
  });

  it('should return 403 if user is not a member of the thread', async () => {
    req.params = { threadId: 'thread-1' };
    checkThreadMembership.mockResolvedValue({ member: null, error: null });

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Acceso denegado'),
      })
    );
  });

  it('should return messages successfully when user is a member', async () => {
    req.params = { threadId: 'thread-1' };
    checkThreadMembership.mockResolvedValue({ member: { id: 'member-1' }, error: null });

    const mockMessages = [
      { id: 'msg-1', content: 'Hola', sender_id: 'user-123', created_at: '2024-01-01T00:00:00Z' },
      { id: 'msg-2', content: 'Buenos días', sender_id: 'user-456', created_at: '2024-01-01T00:01:00Z' },
    ];
    __mockOrder.mockResolvedValue({ data: mockMessages, error: null });

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: mockMessages,
      })
    );
  });

  it('should return 400 if messages query fails', async () => {
    req.params = { threadId: 'thread-1' };
    checkThreadMembership.mockResolvedValue({ member: { id: 'member-1' }, error: null });

    __mockOrder.mockResolvedValue({ data: null, error: { message: 'Query failed' } });

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

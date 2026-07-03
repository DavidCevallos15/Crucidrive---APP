const { getHistorialChat } = require('../src/controllers/chatController');

jest.mock('../src/config/supabase', () => {
  const mockMaybeSingle = jest.fn();
  const mockOrder = jest.fn();
  const mockEqInner = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockEq = jest.fn(() => ({ eq: mockEqInner, single: jest.fn() }));
  const mockSelect = jest.fn(() => ({ eq: mockEq, order: mockOrder }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));

  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
    __mockEq: mockEq,
    __mockEqInner: mockEqInner,
    __mockMaybeSingle: mockMaybeSingle,
    __mockOrder: mockOrder,
  };
});

const {
  __mockFrom,
  __mockSelect,
  __mockEq,
  __mockEqInner,
  __mockMaybeSingle,
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

  it('should return 400 if threadId param is missing', async () => {
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

    __mockFrom.mockReturnValue({ select: __mockSelect });
    __mockSelect.mockReturnValue({ eq: __mockEq });
    __mockEq.mockReturnValue({ eq: __mockEqInner });
    __mockEqInner.mockReturnValue({ maybeSingle: __mockMaybeSingle });
    __mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

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

    __mockFrom.mockReturnValue({ select: __mockSelect });
    __mockSelect.mockReturnValue({ eq: __mockEq });
    __mockEq.mockReturnValue({ eq: __mockEqInner });
    __mockEqInner.mockReturnValue({ maybeSingle: __mockMaybeSingle });
    __mockMaybeSingle.mockResolvedValue({ data: null, error: null });

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
    const mockMessages = [
      { id: 'msg-1', content: 'Hola', sender_id: 'user-123', created_at: '2024-01-01' },
      { id: 'msg-2', content: 'Hola!', sender_id: 'user-456', created_at: '2024-01-01' },
    ];

    let callIdx = 0;
    __mockFrom.mockImplementation((table) => {
      callIdx++;
      if (callIdx === 1) {
        // thread_members lookup
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'member-1' }, error: null }),
              })),
            })),
          })),
        };
      }
      // messages lookup
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({ data: mockMessages, error: null }),
          })),
        })),
      };
    });

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

    let callIdx = 0;
    __mockFrom.mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'member-1' }, error: null }),
              })),
            })),
          })),
        };
      }
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } }),
          })),
        })),
      };
    });

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 500 on unexpected exception', async () => {
    req.params = { threadId: 'thread-1' };
    __mockFrom.mockImplementation(() => { throw new Error('Unexpected'); });

    await getHistorialChat(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: 'Unexpected',
      })
    );
  });
});

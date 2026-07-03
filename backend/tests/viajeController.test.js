const { solicitarViaje, aceptarViaje, cambiarEstadoViaje } = require('../src/controllers/viajeController');

jest.mock('../src/config/supabase', () => {
  const mockSingle = jest.fn();
  const mockSelect = jest.fn(() => ({ single: mockSingle }));
  const mockInsert = jest.fn(() => ({ select: mockSelect }));
  const mockUpdateEq = jest.fn(() => ({ select: mockSelect }));
  const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
  const mockDeleteEq = jest.fn();
  const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));
  const mockSelectChainEq = jest.fn(() => ({ single: mockSingle }));
  const mockSelectChain = jest.fn(() => ({ eq: mockSelectChainEq }));

  const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelectChain,
  }));

  return {
    supabase: { from: mockFrom },
    __mockFrom: mockFrom,
    __mockInsert: mockInsert,
    __mockSelect: mockSelect,
    __mockSingle: mockSingle,
    __mockUpdate: mockUpdate,
    __mockUpdateEq: mockUpdateEq,
    __mockDelete: mockDelete,
    __mockDeleteEq: mockDeleteEq,
    __mockSelectChain: mockSelectChain,
    __mockSelectChainEq: mockSelectChainEq,
  };
});

const {
  __mockFrom,
  __mockInsert,
  __mockSelect,
  __mockSingle,
  __mockUpdate,
  __mockUpdateEq,
  __mockDelete,
  __mockDeleteEq,
  __mockSelectChain,
  __mockSelectChainEq,
} = require('../src/config/supabase');

describe('viajeController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { id: 'user-123' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('solicitarViaje', () => {
    it('should return 400 if origen is missing', async () => {
      req.body = { destino: { lat: -1.05, lng: -80.54 } };

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: expect.stringContaining('coordenadas'),
        })
      );
    });

    it('should return 400 if destino is missing', async () => {
      req.body = { origen: { lat: -1.04, lng: -80.54 } };

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if origen.lat is missing', async () => {
      req.body = {
        origen: { lng: -80.54 },
        destino: { lat: -1.05, lng: -80.55 },
      };

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should create a trip successfully', async () => {
      req.body = {
        origen: { lat: -1.04, lng: -80.54 },
        destino: { lat: -1.05, lng: -80.55 },
      };
      const mockViaje = {
        id: 'viaje-1',
        pasajero_id: 'user-123',
        estado: 'solicitado',
        tarifa: 1.50,
      };

      __mockFrom.mockReturnValue({ insert: __mockInsert });
      __mockInsert.mockReturnValue({ select: __mockSelect });
      __mockSelect.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({ data: mockViaje, error: null });

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockViaje,
        })
      );
    });

    it('should return 400 if supabase insert fails', async () => {
      req.body = {
        origen: { lat: -1.04, lng: -80.54 },
        destino: { lat: -1.05, lng: -80.55 },
      };

      __mockFrom.mockReturnValue({ insert: __mockInsert });
      __mockInsert.mockReturnValue({ select: __mockSelect });
      __mockSelect.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on unexpected exception', async () => {
      req.body = {
        origen: { lat: -1.04, lng: -80.54 },
        destino: { lat: -1.05, lng: -80.55 },
      };

      __mockFrom.mockImplementation(() => { throw new Error('Crash'); });

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ details: 'Crash' })
      );
    });
  });

  describe('aceptarViaje', () => {
    it('should return 400 if viajeId is missing', async () => {
      req.body = {};

      await aceptarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('viajeId'),
        })
      );
    });

    it('should return 404 if viaje is not found', async () => {
      req.body = { viajeId: 'viaje-999' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      await aceptarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if viaje is not in solicitado state', async () => {
      req.body = { viajeId: 'viaje-1' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({
        data: { id: 'viaje-1', estado: 'en_curso', pasajero_id: 'p-1' },
        error: null,
      });

      await aceptarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('no puede ser aceptado'),
        })
      );
    });

    it('should return 500 on unexpected exception', async () => {
      req.body = { viajeId: 'viaje-1' };
      __mockFrom.mockImplementation(() => { throw new Error('DB crash'); });

      await aceptarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('cambiarEstadoViaje', () => {
    it('should return 400 if estado is missing', async () => {
      req.params = { id: 'viaje-1' };
      req.body = {};

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Estado inválido'),
        })
      );
    });

    it('should return 400 if estado is not a valid transition value', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'aceptado' };

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if viaje is not found', async () => {
      req.params = { id: 'viaje-999' };
      req.body = { estado: 'en_curso' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({ data: null, error: null });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if user is not a participant of the trip', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'en_curso' };
      req.user = { id: 'outsider' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({
        data: { id: 'viaje-1', pasajero_id: 'user-a', conductor_id: 'user-b', estado: 'aceptado' },
        error: null,
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if transitioning to en_curso from non-aceptado state', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'en_curso' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({
        data: { id: 'viaje-1', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'solicitado' },
        error: null,
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('aceptado'),
        })
      );
    });

    it('should return 400 if transitioning to finalizado from non-en_curso state', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'finalizado' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({
        data: { id: 'viaje-1', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'aceptado' },
        error: null,
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if trying to cancel a finalizado trip', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'cancelado' };

      __mockFrom.mockReturnValue({ select: __mockSelectChain });
      __mockSelectChain.mockReturnValue({ eq: __mockSelectChainEq });
      __mockSelectChainEq.mockReturnValue({ single: __mockSingle });
      __mockSingle.mockResolvedValue({
        data: { id: 'viaje-1', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'finalizado' },
        error: null,
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('No se puede cancelar'),
        })
      );
    });

    it('should successfully transition to en_curso from aceptado', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'en_curso' };

      const mockViaje = { id: 'viaje-1', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'aceptado' };
      const mockUpdated = { ...mockViaje, estado: 'en_curso' };

      // First call: select to get viaje
      // Second call: update
      let callIdx = 0;
      __mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: mockViaje, error: null }),
              })),
            })),
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
              })),
            })),
          })),
        };
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockUpdated,
        })
      );
    });

    it('should return 500 on unexpected exception', async () => {
      req.params = { id: 'viaje-1' };
      req.body = { estado: 'cancelado' };
      __mockFrom.mockImplementation(() => { throw new Error('Crash'); });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

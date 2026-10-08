jest.mock('../src/utils/asyncHandler', () => (fn) => fn);

jest.mock('../src/config/supabase', () => {
  const mockSingle = jest.fn();
  const mockSelect = jest.fn(() => ({ single: mockSingle }));
  const mockInsert = jest.fn(() => ({ select: mockSelect }));
  const mockUpdateEq = jest.fn(() => ({ select: mockSelect }));
  const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
  const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
  const mockDelete = jest.fn(() => ({ eq: mockDeleteEq }));

  const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
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
  };
});

jest.mock('../src/utils/supabaseHelpers', () => ({
  findViajeById: jest.fn(),
}));

const { solicitarViaje, aceptarViaje, cambiarEstadoViaje } = require('../src/controllers/viajeController');
const { findViajeById } = require('../src/utils/supabaseHelpers');
const {
  __mockFrom,
  __mockInsert,
  __mockSelect,
  __mockSingle,
  __mockUpdate,
  __mockUpdateEq,
} = require('../src/config/supabase');

describe('viajeController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, user: { id: 'user-123' }, supabase: require('../src/config/supabase').supabase };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();

    __mockFrom.mockReturnValue({
      insert: __mockInsert,
      update: __mockUpdate,
    });
    __mockInsert.mockReturnValue({ select: __mockSelect });
    __mockSelect.mockReturnValue({ single: __mockSingle });
    __mockUpdate.mockReturnValue({ eq: __mockUpdateEq });
    __mockUpdateEq.mockReturnValue({ select: __mockSelect });
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

    it('should return 400 if destino.lng is missing', async () => {
      req.body = {
        origen: { lat: -1.04, lng: -80.54 },
        destino: { lat: -1.05 },
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
        id: '0a1b2c3d-0000-4000-8000-000000000001',
        pasajero_id: 'user-123',
        estado: 'solicitado',
        tarifa: 1.50,
      };

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

      __mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
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
      req.body = { viajeId: '0a1b2c3d-0000-4000-8000-000000000999' };
      findViajeById.mockResolvedValue({ viaje: null, error: { message: 'Not found' } });

      await aceptarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if viaje is not in solicitado state', async () => {
      req.body = { viajeId: '0a1b2c3d-0000-4000-8000-000000000001' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'en_curso', pasajero_id: 'p-1' },
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

    it('should accept a viaje successfully and create chat thread', async () => {
      req.body = { viajeId: '0a1b2c3d-0000-4000-8000-000000000001' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'solicitado', pasajero_id: 'p-1' },
        error: null,
      });

      const mockUpdated = { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'aceptado', conductor_id: 'user-123' };
      const mockThread = { id: '0b1c2d3e-0000-4000-8000-000000000001' };

      let callIdx = 0;
      __mockFrom.mockImplementation((table) => {
        callIdx++;
        if (table === 'viajes') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(() => ({
                select: jest.fn(() => ({
                  single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
                })),
              })),
            })),
          };
        }
        if (table === 'threads') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({ data: mockThread, error: null }),
              })),
            })),
          };
        }
        if (table === 'thread_members') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
      });

      await aceptarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            viaje: mockUpdated,
            chat: { threadId: '0b1c2d3e-0000-4000-8000-000000000001' },
          }),
        })
      );
    });
  });

  describe('cambiarEstadoViaje', () => {
    it('should return 400 if estado is missing', async () => {
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
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
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
      req.body = { estado: 'aceptado' };

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if viaje is not found', async () => {
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000999' };
      req.body = { estado: 'en_curso' };
      findViajeById.mockResolvedValue({ viaje: null, error: null });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if user is not a participant of the trip', async () => {
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
      req.body = { estado: 'en_curso' };
      req.user = { id: 'outsider' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', pasajero_id: 'user-a', conductor_id: 'user-b', estado: 'aceptado' },
        error: null,
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 if transitioning to en_curso from non-aceptado state', async () => {
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
      req.body = { estado: 'en_curso' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'solicitado' },
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
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
      req.body = { estado: 'finalizado' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'aceptado' },
        error: null,
      });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if trying to cancel a finalizado trip', async () => {
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
      req.body = { estado: 'cancelado' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'finalizado' },
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
      req.params = { id: '0a1b2c3d-0000-4000-8000-000000000001' };
      req.body = { estado: 'en_curso' };
      findViajeById.mockResolvedValue({
        viaje: { id: '0a1b2c3d-0000-4000-8000-000000000001', pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'aceptado' },
        error: null,
      });

      const mockUpdated = { id: '0a1b2c3d-0000-4000-8000-000000000001', estado: 'en_curso' };
      __mockSingle.mockResolvedValue({ data: mockUpdated, error: null });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: mockUpdated,
        })
      );
    });
  });
});

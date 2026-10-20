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

    it('should create a trip successfully without sending a fare', async () => {
      req.body = {
        origen: { lat: -0.8706, lng: -80.5375 },
        destino: { lat: -0.8728, lng: -80.5428 },
        tarifa: 9.99,
      };
      const mockViaje = {
        id: '0a1b2c3d-0000-4000-8000-000000000001',
        pasajero_id: 'user-123',
        estado: 'solicitado',
        pasajeros: 1,
        tarifa: 0.5,
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
      const [[fila]] = __mockInsert.mock.calls[0];
      expect(fila).not.toHaveProperty('tarifa');
      expect(fila.pasajeros).toBe(1);
    });

    it('should send passengers, sectors and descriptions to the database', async () => {
      req.body = {
        origen: { lat: -0.8706, lng: -80.5375 },
        destino: { lat: -0.835, lng: -80.54 },
        pasajeros: 3,
        sectorOrigenId: 'centro',
        sectorDestinoId: 'la_boca',
        destinoDescripcion: '  Frente   al muelle  ',
      };
      __mockSingle.mockResolvedValue({ data: { id: 'x' }, error: null });

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      const [[fila]] = __mockInsert.mock.calls[0];
      expect(fila).toMatchObject({
        pasajeros: 3,
        sector_origen_id: 'centro',
        sector_destino_id: 'la_boca',
        origen_descripcion: null,
        destino_descripcion: 'Frente al muelle',
      });
    });

    it.each([0, -1, 2.5, '2', 21, null])('should return 400 for passengers = %p', async (pasajeros) => {
      req.body = {
        origen: { lat: -0.8706, lng: -80.5375 },
        destino: { lat: -0.8728, lng: -80.5428 },
        pasajeros,
      };

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('pasajeros') })
      );
      expect(__mockInsert).not.toHaveBeenCalled();
    });

    it('should return 400 for an invalid sector id', async () => {
      req.body = {
        origen: { lat: -0.8706, lng: -80.5375 },
        destino: { lat: -0.8728, lng: -80.5428 },
        sectorDestinoId: 'Centro; drop table',
      };

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(__mockInsert).not.toHaveBeenCalled();
    });

    it('should return 400 for a description longer than 200 characters', async () => {
      req.body = {
        origen: { lat: -0.8706, lng: -80.5375 },
        destino: { lat: -0.8728, lng: -80.5428 },
        destinoDescripcion: 'a'.repeat(201),
      };

      await solicitarViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(__mockInsert).not.toHaveBeenCalled();
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

    // El resto de aceptarViaje (RPC atómica del paso 003) está en tests/spec003.test.js.
  });

  // Desde el 005 el cambio de estado lo valida la BD (funciones de 0017); aquí solo se
  // comprueba que se llama a la función correcta y que sus errores se traducen sin detalles.
  describe('cambiarEstadoViaje', () => {
    const ID = '0a1b2c3d-0000-4000-8000-000000000001';
    let rpc;

    beforeEach(() => {
      rpc = jest.fn().mockResolvedValue({ data: null, error: null });
      req.supabase = { ...req.supabase, rpc };
      req.params = { id: ID };
    });

    it('should return 400 if estado is missing', async () => {
      req.body = {};

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Estado inválido'),
        })
      );
      expect(rpc).not.toHaveBeenCalled();
    });

    it('should return 400 if estado is not a valid transition value', async () => {
      req.body = { estado: 'aceptado' };

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('should return 400 if the id is not a uuid', async () => {
      req.params = { id: 'no-es-uuid' };
      req.body = { estado: 'en_curso' };

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(rpc).not.toHaveBeenCalled();
    });

    it.each([
      ['en_curso', 'iniciar_viaje', { p_viaje: ID }],
      ['finalizado', 'terminar_viaje', { p_viaje: ID }],
      ['cancelado', 'cancelar_viaje', { p_viaje: ID, p_motivo: null }],
    ])('estado %s llama a %s', async (estado, funcion, args) => {
      req.body = { estado };
      findViajeById.mockResolvedValue({ viaje: { id: ID, pasajero_id: 'user-123', conductor_id: 'c-1', estado }, error: null });

      await cambiarEstadoViaje(req, res);

      expect(rpc).toHaveBeenCalledWith(funcion, args);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 without details if the trip is not yours (or does not exist)', async () => {
      req.body = { estado: 'en_curso' };
      rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'no_es_tu_viaje' } });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('no_es_tu_viaje');
    });

    it('should return 409 if the state does not allow the step', async () => {
      req.body = { estado: 'cancelado' };
      rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'estado_no_permite' } });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should return the updated trip on success', async () => {
      req.body = { estado: 'en_curso' };
      const actualizado = { id: ID, pasajero_id: 'user-123', conductor_id: 'c-1', estado: 'en_curso' };
      findViajeById.mockResolvedValue({ viaje: actualizado, error: null });

      await cambiarEstadoViaje(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', data: actualizado })
      );
    });
  });
});

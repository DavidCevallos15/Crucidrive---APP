jest.mock('../src/utils/asyncHandler', () => (fn) => fn);
jest.mock('../src/despacho', () => ({ obtenerDespachador: jest.fn(() => ({ iniciar: jest.fn() })) }));
// La sanción del 005 tiene sus pruebas en viaje005.test.js; aquí el pasajero nunca está bloqueado.
jest.mock('../src/viaje/sancion', () => ({
  ...jest.requireActual('../src/viaje/sancion'),
  revisarSancion: jest.fn(async () => ({ llevas: 0, bloqueadoHasta: null })),
}));
const { solicitarViaje } = require('../src/controllers/viajeController');
const { armarOferta } = require('../src/despacho/oferta');
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const body = () => ({ origen: { lat: -0.86, lng: -80.53 }, destino: { lat: -0.87, lng: -80.54 }, tipoServicio: 'encomienda', encomienda: { descripcion: 'Una caja pequeña', destinatario: 'Ana', autorizado: true } });

describe('encomiendas', () => {
  it('crea solicitud y datos privados por RPC atómica, sin aceptar el precio enviado por el cliente', async () => {
    const db = { rpc: jest.fn(() => ({ single: jest.fn(async () => ({ data: { id: 'v', tipo_servicio: 'encomienda', tarifa: null }, error: null })) })), from: jest.fn() };
    const r = res();
    await solicitarViaje({ body: { ...body(), tarifa: 999 }, user: { id: 'dueño' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(201);
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledWith('solicitar_encomienda', expect.objectContaining({ p_descripcion: 'Una caja pequeña', p_destinatario: 'Ana', p_autorizado: true }));
    expect(db.rpc.mock.calls[0][1].p_solicitud.tarifa).toBeUndefined();
  });
  it.each([
    { tipoServicio: 'carga_pesada' },
    { encomienda: { descripcion: 'Caja', destinatario: 'Ana', autorizado: false } },
    { encomienda: { descripcion: 'x', destinatario: 'Ana', autorizado: true } },
    { pasajeros: 2 },
  ])('rechaza datos inválidos antes de tocar la base: %p', async (extra) => {
    const db = { rpc: jest.fn(), from: jest.fn() }; const r = res();
    await solicitarViaje({ body: { ...body(), ...extra }, user: { id: 'u' }, supabase: db }, r);
    expect(r.status).toHaveBeenCalledWith(400); expect(db.rpc).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
  });
  it('las ofertas muestran precio a convenir y no filtran datos del destinatario', () => {
    const result = armarOferta({ id: 'v', tipo_servicio: 'encomienda', tarifa: null, pasajeros: 1, destinatario: 'Privado', descripcion: 'Privado' }, { fase: 'secuencial', vence_en: '2026-10-20T12:00:00Z', distancia_m: 20 });
    expect(result.tipoServicio).toBe('encomienda'); expect(result.tarifa).toBeNull(); expect(result.destinatario).toBeUndefined(); expect(result.descripcion).toBeUndefined();
  });
});

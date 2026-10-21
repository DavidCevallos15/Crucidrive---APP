const { crearApagado } = require('../src/apagado');

/** 008 · backend de prueba: SIGTERM de systemd al reiniciar la VM. */
describe('cierre ordenado del servidor', () => {
  const crear = (cerrarServidor = (cb) => cb()) => {
    const deps = {
      server: { close: jest.fn(cerrarServidor) },
      io: { close: jest.fn() },
      detenerDespacho: jest.fn(),
      salir: jest.fn(),
      log: jest.fn(),
      limiteMs: 1000,
    };
    return { deps, apagar: crearApagado(deps) };
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('detiene el despacho, cierra los sockets y el servidor, y sale con 0', () => {
    const { deps, apagar } = crear();
    apagar('SIGTERM');
    expect(deps.detenerDespacho).toHaveBeenCalled();
    expect(deps.io.close).toHaveBeenCalled();
    expect(deps.server.close).toHaveBeenCalled();
    expect(deps.salir).toHaveBeenCalledWith(0);
  });

  it('una segunda señal no repite el cierre', () => {
    const { deps, apagar } = crear();
    apagar('SIGTERM');
    apagar('SIGINT');
    expect(deps.detenerDespacho).toHaveBeenCalledTimes(1);
    expect(deps.salir).toHaveBeenCalledTimes(1);
  });

  it('si el servidor no cierra a tiempo, sale igual con 1 (no bloquea el reinicio)', () => {
    const { deps, apagar } = crear(() => {});
    apagar('SIGTERM');
    expect(deps.salir).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(deps.salir).toHaveBeenCalledWith(1);
  });

  it('un error al detener el despacho no impide cerrar el servidor', () => {
    const { deps, apagar } = crear();
    deps.detenerDespacho.mockImplementation(() => { throw new Error('boom'); });
    apagar('SIGTERM');
    expect(deps.server.close).toHaveBeenCalled();
    expect(deps.salir).toHaveBeenCalledWith(0);
  });
});

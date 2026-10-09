const { EventEmitter } = require('node:events');
const {
  conectarSocket, esperar, esperarCondicion, cerrarViajesDePrueba,
} = require('../scripts/smokeHelpers');

describe('Humo: conexión y eventos del despacho', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const socketFalso = (alConectar = () => {}) => {
    const socket = new EventEmitter();
    socket.close = jest.fn();
    socket.connect = jest.fn(() => alConectar(socket));
    return socket;
  };

  test('no pierde hora_servidor aunque llegue inmediatamente al conectar', async () => {
    jest.setSystemTime(1000);
    const socket = socketFalso((s) => {
      s.emit('connect');
      s.emit('hora_servidor', { ahora: 1300 });
    });
    const crearSocket = jest.fn(() => socket);
    await expect(conectarSocket(crearSocket, 'http://localhost', 'token')).resolves.toBe(socket);
    expect(socket.desfaseMs).toBe(300);
    expect(crearSocket).toHaveBeenCalledWith('http://localhost', expect.objectContaining({ autoConnect: false }));
    expect(socket.listenerCount('hora_servidor')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('espera la hora además de connect y mide el desfase cuando llega', async () => {
    jest.setSystemTime(1000);
    const socket = socketFalso((s) => s.emit('connect'));
    let completo = false;
    const conexion = conectarSocket(() => socket, 'http://localhost', 'token');
    conexion.then(() => { completo = true; });
    await Promise.resolve();
    expect(completo).toBe(false);
    jest.setSystemTime(2000);
    socket.emit('hora_servidor', { ahora: 2500 });
    await conexion;
    expect(socket.desfaseMs).toBe(500);
  });

  test('rechaza y cierra el socket si el servidor no envía hora', async () => {
    const socket = socketFalso((s) => s.emit('connect'));
    const conexion = conectarSocket(() => socket, 'http://localhost', 'token', 100);
    const fallo = expect(conexion).rejects.toThrow('hora_servidor');
    await jest.advanceTimersByTimeAsync(100);
    await fallo;
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.listenerCount('connect')).toBe(0);
  });

  test('rechaza una hora inválida y los errores de autenticación', async () => {
    for (const evento of ['hora_servidor', 'connect_error']) {
      const socket = socketFalso((s) => s.emit(evento, evento === 'hora_servidor' ? {} : new Error('Token inválido')));
      await expect(conectarSocket(() => socket, 'http://localhost', 'token')).rejects.toThrow('Socket:');
      expect(socket.close).toHaveBeenCalledTimes(1);
    }
  });

  test('ignora ofertas de otro viaje y elimina el listener al recibir la correcta', async () => {
    const socket = socketFalso();
    const oferta = esperar(socket, 'oferta', (d) => d.viajeId === 'actual');
    socket.emit('oferta', { viajeId: 'otro' });
    expect(socket.listenerCount('oferta')).toBe(1);
    socket.emit('oferta', { viajeId: 'actual' });
    await expect(oferta).resolves.toEqual({ viajeId: 'actual' });
    expect(socket.listenerCount('oferta')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('una oferta ausente vence y no deja listeners', async () => {
    const socket = socketFalso();
    const oferta = esperar(socket, 'oferta', undefined, 100);
    await jest.advanceTimersByTimeAsync(100);
    await expect(oferta).resolves.toBeNull();
    expect(socket.listenerCount('oferta')).toBe(0);
  });

  test('espera la condición real aunque tarde más que el retardo anterior', async () => {
    const consultar = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
    const listo = esperarCondicion(consultar, 'GPS pendiente');
    await jest.advanceTimersByTimeAsync(400);
    await expect(listo).resolves.toBe(true);
    expect(consultar).toHaveBeenCalledTimes(3);
  });

  test('falla si el GPS no se guarda y propaga errores de lectura', async () => {
    const pendiente = esperarCondicion(async () => false, 'GPS pendiente', 200);
    const fallo = expect(pendiente).rejects.toThrow('GPS pendiente');
    await jest.advanceTimersByTimeAsync(200);
    await fallo;
    await expect(esperarCondicion(async () => { throw new Error('BD inaccesible'); }, 'GPS pendiente'))
      .rejects.toThrow('BD inaccesible');
  });
});

describe('Humo: limpieza comprobada y limitada a la prueba', () => {
  const viaje = (extra = {}) => ({
    id: 'viaje', estado: 'aceptado', pasajero_id: 'pas', conductor_id: 'con',
    destino_descripcion: 'Prueba de humo', ...extra,
  });
  const usuario = (id, activos = [], lectura = { data: { estado: 'cancelado' }, error: null }) => {
    const q = {
      select: jest.fn(() => q), or: jest.fn(() => q), eq: jest.fn(() => q),
      in: jest.fn(async () => ({ data: activos, error: null })), single: jest.fn(async () => lectura),
    };
    return { id, token: `token-${id}`, sb: { from: jest.fn(() => q) }, q };
  };

  test('deduplica el viaje visible por ambos roles y lo cancela una sola vez', async () => {
    const pas = usuario('pas', [viaje()]);
    const con = usuario('con', [viaje()]);
    const http = jest.fn().mockResolvedValue({ status: 200 });
    await expect(cerrarViajesDePrueba(pas, con, http)).resolves.toBe(1);
    expect(http).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledWith('token-pas', 'PATCH', '/api/viajes/viaje/estado', { estado: 'cancelado' });
  });

  test('finaliza un viaje de prueba en curso', async () => {
    const http = jest.fn().mockResolvedValue({ status: 200 });
    await cerrarViajesDePrueba(usuario('pas', [viaje({ estado: 'en_curso' })]), usuario('con'), http);
    expect(http).toHaveBeenCalledWith('token-pas', 'PATCH', '/api/viajes/viaje/estado', { estado: 'finalizado' });
  });

  test.each([
    { destino_descripcion: 'Un viaje real' },
    { pasajero_id: 'otro' },
    { conductor_id: 'otro' },
  ])('no modifica ningún viaje cuando uno es ajeno al guion: %j', async (extra) => {
    const http = jest.fn();
    await expect(cerrarViajesDePrueba(usuario('pas', [viaje(), viaje(extra)]), usuario('con'), http))
      .rejects.toThrow('ajeno al guion');
    expect(http).not.toHaveBeenCalled();
  });

  test('no reporta éxito si el PATCH falla y el viaje sigue activo', async () => {
    const pas = usuario('pas', [viaje()], { data: { estado: 'aceptado' }, error: null });
    const http = jest.fn().mockResolvedValue({ status: 500 });
    await expect(cerrarViajesDePrueba(pas, usuario('con'), http)).rejects.toThrow('HTTP 500');
  });

  test('tolera que la BD lo cierre como sin_conductor antes de cancelar', async () => {
    const pas = usuario('pas', [viaje({ conductor_id: null })], { data: { estado: 'sin_conductor' }, error: null });
    await expect(cerrarViajesDePrueba(pas, usuario('con'), async () => ({ status: 400 }))).resolves.toBe(1);
  });

  test('un error al leer los viajes impide la limpieza', async () => {
    const pas = usuario('pas');
    pas.q.in.mockResolvedValue({ data: null, error: { message: 'Sin red' } });
    const http = jest.fn();
    await expect(cerrarViajesDePrueba(pas, usuario('con'), http)).rejects.toThrow('consultar');
    expect(http).not.toHaveBeenCalled();
  });
});

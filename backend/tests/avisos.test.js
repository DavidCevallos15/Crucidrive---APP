/**
 * Paso 004 · T5: avisos con la app cerrada por el servicio de Expo (D-12; plan P1 a P4, P7).
 * Criterios 6 (sin datos del pasajero), 11 (tokens de teléfonos que ya no son del usuario) y
 * 12 (si Expo falla, nada se detiene).
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/utils/asyncHandler', () => (fn) => fn);

const { crearClienteExpo, URL_EXPO } = require('../src/avisos/expo');
const { avisoOferta, avisoRetirada, avisoAceptado, avisoSinConductor } = require('../src/avisos/mensajes');
const { crearAvisos } = require('../src/avisos');
const { registrarDispositivo, olvidarDispositivo } = require('../src/controllers/dispositivoController');
const { armarOferta } = require('../src/despacho/oferta');

const TOKEN = 'ExponentPushToken[abcdefghij0123456789]';
const OTRO = 'ExponentPushToken[zyxwvutsrq9876543210]';
const NOMBRES = { los_arenales: 'Los Arenales', la_boca: 'La Boca' };
const nombreSector = (id) => NOMBRES[id];

const respuestaExpo = (data, ok = true, status = 200) => ({ ok, status, json: () => Promise.resolve({ data }) });

// Oferta real del despachador (mismo armado que el socket) con datos de un viaje.
const VIAJE = {
  id: '0a1b2c3d-0000-4000-8000-000000000001',
  pasajero_id: '11111111-1111-1111-1111-111111111111',
  pasajeros: 3,
  tarifa: '1.50',
  sector_origen_id: 'los_arenales',
  sector_destino_id: 'la_boca',
  origen_descripcion: 'Muelle de Crucita',
  destino_descripcion: null,
};
const AHORA = 1_000_000;
const OFERTA = armarOferta(VIAJE, { fase: 'secuencial', vence_en: new Date(AHORA + 15_000).toISOString(), distancia_m: 420 });

describe('T5 · cliente de Expo (plan P1, P2 y P4)', () => {
  test('envía por POST a la API de Expo, en lotes de 100', async () => {
    const fetchImpl = jest.fn((_url, { body }) => Promise.resolve(respuestaExpo(JSON.parse(body).map(() => ({ status: 'ok' })))));
    const cliente = crearClienteExpo({ fetchImpl, token: undefined });
    const mensajes = Array.from({ length: 250 }, (_, i) => ({ to: `t${i}` }));
    const r = await cliente.enviar(mensajes);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0][0]).toBe(URL_EXPO);
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toHaveLength(50);
    expect(r).toEqual({ enviados: 250, invalidos: [], fallidos: 0 });
  });

  test('con EXPO_ACCESS_TOKEN va en Authorization (seguridad reforzada, P2); sin él, no', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(respuestaExpo([{ status: 'ok' }])));
    await crearClienteExpo({ fetchImpl, token: 'secreto' }).enviar([{ to: TOKEN }]);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer secreto');
    await crearClienteExpo({ fetchImpl, token: undefined }).enviar([{ to: TOKEN }]);
    expect(fetchImpl.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
  });

  test('tiene límite de tiempo: un Expo lento no deja la petición colgada', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(respuestaExpo([{ status: 'ok' }])));
    await crearClienteExpo({ fetchImpl }).enviar([{ to: TOKEN }]);
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  test('criterio 11: DeviceNotRegistered devuelve el token para borrarlo', async () => {
    const fetchImpl = jest.fn(() => Promise.resolve(respuestaExpo([
      { status: 'ok' },
      { status: 'error', message: 'no registrado', details: { error: 'DeviceNotRegistered' } },
    ])));
    const r = await crearClienteExpo({ fetchImpl }).enviar([{ to: TOKEN }, { to: OTRO }]);
    expect(r).toEqual({ enviados: 1, invalidos: [OTRO], fallidos: 1 });
  });

  test('criterio 12: un HTTP 500 o un fallo de red no lanza', async () => {
    const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
    const caido = crearClienteExpo({ fetchImpl: () => Promise.resolve(respuestaExpo(null, false, 500)) });
    await expect(caido.enviar([{ to: TOKEN }])).resolves.toEqual({ enviados: 0, invalidos: [], fallidos: 1 });
    const sinRed = crearClienteExpo({ fetchImpl: () => Promise.reject(new Error('ECONNRESET')) });
    await expect(sinRed.enviar([{ to: TOKEN }])).resolves.toMatchObject({ fallidos: 1 });
    espia.mockRestore();
  });
});

describe('T5 · lo que dice cada aviso (criterio 6; plan P7 y P9)', () => {
  test('la oferta dice personas, total, origen y destino', () => {
    const [m] = avisoOferta(OFERTA, [TOKEN], nombreSector, AHORA);
    expect(m.to).toBe(TOKEN);
    expect(m.title).toBe('Nuevo viaje · $1.50');
    expect(m.body).toBe('3 personas · Muelle de Crucita · Los Arenales → La Boca');
    expect(m.data).toEqual({ tipo: 'oferta', viajeId: VIAJE.id, venceEn: AHORA + 15_000 });
  });

  test('criterio 6: no lleva teléfono, nombre ni coordenadas del pasajero', () => {
    const [m] = avisoOferta(OFERTA, [TOKEN], nombreSector, AHORA);
    const texto = JSON.stringify(m);
    expect(texto).not.toMatch(/telefono|pasajero_id|nombre|lat|lng|coords/);
    expect(texto).not.toContain(VIAJE.pasajero_id);
  });

  test('caduca cuando vence la oferta y sale con prioridad alta por el canal de ofertas', () => {
    const [m] = avisoOferta(OFERTA, [TOKEN], nombreSector, AHORA + 5_000);
    expect(m).toMatchObject({ ttl: 10, priority: 'high', channelId: 'ofertas', sound: 'default' });
    const [vencida] = avisoOferta(OFERTA, [TOKEN], nombreSector, AHORA + 60_000);
    expect(vencida.ttl).toBe(1);
  });

  test('un aviso por teléfono del conductor', () => {
    expect(avisoOferta(OFERTA, [TOKEN, OTRO], nombreSector, AHORA).map((m) => m.to)).toEqual([TOKEN, OTRO]);
  });

  test('la retirada es un aviso de datos, sin texto (P8)', () => {
    const [m] = avisoRetirada(VIAJE.id, [TOKEN]);
    expect(m).not.toHaveProperty('title');
    expect(m).not.toHaveProperty('body');
    expect(m.data).toEqual({ tipo: 'oferta_retirada', viajeId: VIAJE.id });
  });

  test('criterio 10: al pasajero, aceptado con nombre y placa, o sin conductor', () => {
    const [a] = avisoAceptado(VIAJE.id, { nombre: 'Carla', placa: 'SMK-001', telefono: '0991234567' }, [TOKEN]);
    expect(a).toMatchObject({ title: 'Tu tricimoto va en camino', body: 'Carla · placa SMK-001', channelId: 'viaje' });
    expect(JSON.stringify(a)).not.toContain('0991234567');
    const [s] = avisoSinConductor(VIAJE.id, [TOKEN]);
    expect(s).toMatchObject({ title: 'No hay tricimotos disponibles ahora', data: { tipo: 'viaje_sin_conductor', viajeId: VIAJE.id } });
  });
});

/** BD falsa con la clave de servicio: tokens por usuario, sectores y borrado de tokens. */
const crearDb = ({ tokens = [], sectores = [{ id: 'los_arenales', nombre: 'Los Arenales' }, { id: 'la_boca', nombre: 'La Boca' }] } = {}) => {
  const borrados = [];
  const lecturas = { sectores: 0 };
  const db = {
    from: (tabla) => {
      if (tabla === 'sectores') {
        return { select: () => { lecturas.sectores += 1; return Promise.resolve({ data: sectores, error: null }); } };
      }
      return {
        select: () => ({ in: (_c, ids) => Promise.resolve({ data: tokens.filter((t) => ids.includes(t.usuario_id)), error: null }) }),
        delete: () => ({ in: (_c, lista) => { borrados.push(...lista); return Promise.resolve({ error: null }); } }),
      };
    },
  };
  return { obtenerDb: () => db, borrados, lecturas };
};

describe('T5 · envío a los teléfonos de un usuario (criterios 11 y 12)', () => {
  const CONDUCTOR = '22222222-2222-2222-2222-222222222222';

  test('envía la oferta a todos los teléfonos del conductor con los nombres de los sectores de la BD', async () => {
    const { obtenerDb, lecturas } = crearDb({ tokens: [{ token: TOKEN, usuario_id: CONDUCTOR }, { token: OTRO, usuario_id: 'otro' }] });
    const cliente = { enviar: jest.fn(() => Promise.resolve({ enviados: 1, invalidos: [], fallidos: 0 })) };
    const avisos = crearAvisos({ obtenerDb, cliente, activos: true });
    await avisos.oferta(CONDUCTOR, OFERTA);
    await avisos.oferta(CONDUCTOR, OFERTA);
    const enviados = cliente.enviar.mock.calls[0][0];
    expect(enviados.map((m) => m.to)).toEqual([TOKEN]);
    expect(enviados[0].body).toContain('Los Arenales');
    expect(lecturas.sectores).toBe(1); // se leen una vez
  });

  test('criterio 11: los tokens que Expo da por desinstalados se borran', async () => {
    const { obtenerDb, borrados } = crearDb({ tokens: [{ token: TOKEN, usuario_id: CONDUCTOR }] });
    const cliente = { enviar: () => Promise.resolve({ enviados: 0, invalidos: [TOKEN], fallidos: 1 }) };
    await crearAvisos({ obtenerDb, cliente, activos: true }).retirada(CONDUCTOR, VIAJE.id);
    expect(borrados).toEqual([TOKEN]);
  });

  test('sin teléfonos registrados no llama a Expo', async () => {
    const { obtenerDb } = crearDb();
    const cliente = { enviar: jest.fn() };
    await crearAvisos({ obtenerDb, cliente, activos: true }).sinConductor('nadie', VIAJE.id);
    expect(cliente.enviar).not.toHaveBeenCalled();
  });

  test('criterio 12: si Expo o la BD fallan, el aviso no lanza', async () => {
    const espia = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { obtenerDb } = crearDb({ tokens: [{ token: TOKEN, usuario_id: CONDUCTOR }] });
    const caido = { enviar: () => Promise.reject(new Error('Expo caído')) };
    await expect(crearAvisos({ obtenerDb, cliente: caido, activos: true }).aceptado(CONDUCTOR, VIAJE.id, {})).resolves.toBeUndefined();
    const bdCaida = () => ({ from: () => ({ select: () => ({ in: () => Promise.resolve({ data: null, error: { message: 'timeout' } }) }) }) });
    await expect(crearAvisos({ obtenerDb: bdCaida, cliente: caido, activos: true }).oferta(CONDUCTOR, OFERTA)).resolves.toBeUndefined();
    espia.mockRestore();
  });

  test('AVISOS_ACTIVOS=false no envía nada ni cuenta a nadie como candidato por token', async () => {
    const { obtenerDb } = crearDb({ tokens: [{ token: TOKEN, usuario_id: CONDUCTOR }] });
    const cliente = { enviar: jest.fn() };
    const avisos = crearAvisos({ obtenerDb, cliente, activos: false });
    await avisos.oferta(CONDUCTOR, OFERTA);
    expect(cliente.enviar).not.toHaveBeenCalled();
    expect(await avisos.conToken([CONDUCTOR])).toEqual(new Set());
  });

  test('conToken dice quiénes tienen teléfono para avisos (candidatos sin socket, P5)', async () => {
    const { obtenerDb } = crearDb({ tokens: [{ token: TOKEN, usuario_id: CONDUCTOR }] });
    const avisos = crearAvisos({ obtenerDb, cliente: { enviar: jest.fn() }, activos: true });
    expect(await avisos.conToken([CONDUCTOR, 'sin-telefono'])).toEqual(new Set([CONDUCTOR]));
  });
});

describe('T5 · registrar y olvidar el teléfono (criterio 11; plan P3)', () => {
  const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), end: jest.fn() });

  test('registra con el JWT del usuario y responde 204', async () => {
    const rpc = jest.fn(() => Promise.resolve({ error: null }));
    const r = res();
    await registrarDispositivo({ body: { token: TOKEN }, supabase: { rpc } }, r);
    expect(rpc).toHaveBeenCalledWith('registrar_dispositivo', { p_token: TOKEN });
    expect(r.status).toHaveBeenCalledWith(204);
  });

  test.each([undefined, 'token-inventado', 'ExponentPushToken[corto]', `ExponentPushToken[${'a'.repeat(201)}]`, 42])(
    'un token con formato inválido (%p) responde 400 sin tocar la BD',
    async (token) => {
      const rpc = jest.fn();
      const r = res();
      await registrarDispositivo({ body: { token }, supabase: { rpc } }, r);
      expect(r.status).toHaveBeenCalledWith(400);
      expect(rpc).not.toHaveBeenCalled();
    }
  );

  test('al cerrar sesión olvida el teléfono', async () => {
    const rpc = jest.fn(() => Promise.resolve({ data: true, error: null }));
    const r = res();
    await olvidarDispositivo({ params: { token: TOKEN }, supabase: { rpc } }, r);
    expect(rpc).toHaveBeenCalledWith('olvidar_dispositivo', { p_token: TOKEN });
    expect(r.status).toHaveBeenCalledWith(204);
  });

  test('un error de la BD responde 400 sin detalles internos', async () => {
    const rpc = jest.fn(() => Promise.resolve({ error: { message: 'violates check constraint' } }));
    const r = res();
    await registrarDispositivo({ body: { token: TOKEN }, supabase: { rpc } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(JSON.stringify(r.json.mock.calls[0][0])).not.toContain('constraint');
  });
});

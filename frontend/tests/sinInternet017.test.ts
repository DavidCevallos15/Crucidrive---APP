// Paso 017, parte A: pedir sin depender del mapa (criterios 1 a 3). Las acciones del hook se
// ejercitan con el mismo arnés que viajePasajero005: sin render ni efectos, con stores y promesas.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: jest.fn((initial: any) => [typeof initial === 'function' ? initial() : initial, jest.fn()]),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useDebugValue: () => {},
}));
jest.mock('../src/utils/supabaseClient', () => ({ supabase: {} }));
jest.mock('../src/utils/authFetch', () => ({ authFetch: jest.fn() }));
jest.mock('../src/constants/config', () => ({ API_CONFIG: { endpoints: { rides: { request: '/solicitar' } } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) },
}));
jest.mock('../src/utils/viaje', () => ({
  ...jest.requireActual('../src/utils/viaje'),
  sincronizarViaje: jest.fn(),
}));

import { SECTORS } from '../src/constants/sectors';
import { useViajePasajero } from '../src/hooks/useViajePasajero';
import { useAuthStore } from '../src/store/useAuthStore';
import { useRideStore, type ActiveRide } from '../src/store/useRideStore';
import { authFetch } from '../src/utils/authFetch';
import {
  GRACIA_SIN_INTERNET_MS,
  TEXTO_NO_SE_PUDO_ENVIAR,
  TEXTO_SIN_INTERNET,
  estaSinInternet,
} from '../src/utils/conexion';
import {
  contornoMar,
  crearProyeccion,
  dentroDeCaja,
  ladoEtiqueta,
  lineaSectores,
  type CajaPlano,
} from '../src/utils/planoSectores';
import {
  armarCuerpoSolicitud,
  resolverOrigen,
  sectorDeDestino,
  sectorDeOrigen,
  type Solicitud,
} from '../src/utils/solicitud';
import { sincronizarViaje } from '../src/utils/viaje';

// ─── Criterio 2: cuándo hay «sin internet» (P1) ──────────────────────────────
describe('017 · estaSinInternet', () => {
  const base = { conSesion: true, conectado: false, desconectadoDesde: 1_000, ahora: 1_000 };

  test('no avisa durante la gracia: el socket todavía puede estar conectando', () => {
    expect(estaSinInternet({ ...base, ahora: 1_000 + GRACIA_SIN_INTERNET_MS - 1 })).toBe(false);
  });

  test('avisa cuando el socket lleva la gracia completa sin conectar', () => {
    expect(GRACIA_SIN_INTERNET_MS).toBe(6000);
    expect(estaSinInternet({ ...base, ahora: 1_000 + GRACIA_SIN_INTERNET_MS })).toBe(true);
  });

  test('conectado o sin sesión nunca avisa', () => {
    expect(estaSinInternet({ ...base, conectado: true, ahora: 99_999 })).toBe(false);
    expect(estaSinInternet({ ...base, conSesion: false, ahora: 99_999 })).toBe(false);
    expect(estaSinInternet({ ...base, desconectadoDesde: null, ahora: 99_999 })).toBe(false);
  });

  test('los textos dicen qué pasa y qué revisar', () => {
    expect(TEXTO_SIN_INTERNET.titulo).toBe('Sin internet');
    expect(TEXTO_SIN_INTERNET.detalle).toMatch(/megas/);
    expect(TEXTO_SIN_INTERNET.plano).toMatch(/mapa vuelve/);
    // La leyenda va en una fila de 360 px junto a «● Salida ● Llegada ● Tú».
    expect(TEXTO_SIN_INTERNET.planoCorto.length).toBeLessThanOrEqual(18);
    expect(TEXTO_NO_SE_PUDO_ENVIAR.titulo).toBe('No se pudo enviar');
    expect(TEXTO_NO_SE_PUDO_ENVIAR.mensaje).toMatch(/no se crea otro viaje/);
    expect(TEXTO_NO_SE_PUDO_ENVIAR.reintentar).toBe('Reintentar');
  });
});

// ─── Criterio 2: plano simple de los sectores (P3) ───────────────────────────
describe('017 · plano de los sectores', () => {
  const caja: CajaPlano = { ancho: 360, alto: 124, margenX: 136, margenY: 14 };
  const norteASur = [...SECTORS].sort((a, b) => b.center.lat - a.center.lat);
  const proyectar = crearProyeccion(norteASur.map((s) => s.center), caja);
  const puntos = norteASur.map((s) => proyectar(s.center));

  test('todos los sectores quedan dentro del área libre de la caja', () => {
    for (const p of puntos) {
      expect(p.x).toBeGreaterThanOrEqual(caja.margenX - 0.01);
      expect(p.x).toBeLessThanOrEqual(caja.ancho - caja.margenX + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(caja.margenY - 0.01);
      expect(p.y).toBeLessThanOrEqual(caja.alto - caja.margenY + 0.01);
    }
  });

  test('norte arriba y oeste (el mar) a la izquierda: La Boca arriba a la derecha, La Loma abajo a la izquierda', () => {
    const boca = proyectar(SECTORS.find((s) => s.id === 'la_boca')!.center);
    const loma = proyectar(SECTORS.find((s) => s.id === 'la_loma')!.center);
    expect(boca.y).toBeLessThan(loma.y);
    expect(boca.x).toBeGreaterThan(loma.x);
    for (let i = 1; i < puntos.length; i++) expect(puntos[i].y).toBeGreaterThan(puntos[i - 1].y);
  });

  test('no deforma: la proporción en pantalla es la proporción en metros', () => {
    const [a, b] = [norteASur[0].center, norteASur[norteASur.length - 1].center];
    const [pa, pb] = [proyectar(a), proyectar(b)];
    const latMedia = norteASur.reduce((s, x) => s + x.center.lat, 0) / norteASur.length;
    const metros = (Math.abs(a.lng - b.lng) * Math.cos((latMedia * Math.PI) / 180)) / Math.abs(a.lat - b.lat);
    expect(Math.abs(pa.x - pb.x) / Math.abs(pa.y - pb.y)).toBeCloseTo(metros, 6);
  });

  test('un GPS fuera de Crucita (Portoviejo) no se dibuja; uno en Crucita sí', () => {
    expect(dentroDeCaja(proyectar({ lat: -1.0546, lng: -80.4544 }), caja)).toBe(false);
    expect(dentroDeCaja(proyectar({ lat: -0.85, lng: -80.53 }), caja)).toBe(true);
  });

  test('el mar va a la izquierda de la costa y llega a los bordes de arriba y de abajo', () => {
    const mar = contornoMar(puntos, caja).split(' ').map((par) => par.split(',').map(Number));
    expect(mar[0]).toEqual([0, 0]);
    expect(mar[mar.length - 1]).toEqual([0, caja.alto]);
    const costa = mar.slice(2, 2 + puntos.length);
    costa.forEach(([x], i) => expect(x).toBeLessThan(puntos[i].x));
    expect(lineaSectores(puntos).split(' ')).toHaveLength(SECTORS.length);
  });

  test('los nombres se alternan de lado para que dos sectores cercanos no se tapen', () => {
    expect([0, 1, 2, 3, 4].map(ladoEtiqueta)).toEqual(['derecha', 'izquierda', 'derecha', 'izquierda', 'derecha']);
  });

  test('sin puntos de referencia no hay plano', () => {
    expect(() => crearProyeccion([], caja)).toThrow();
  });
});

// ─── Criterio 1: pedir solo con lo que la app tiene guardado ─────────────────
describe('017 · el pedido no depende del mapa ni de la red', () => {
  test('con el GPS (funciona sin internet) o solo sectores se arma un pedido completo para cada par', () => {
    for (const salida of SECTORS) {
      for (const llegada of SECTORS.filter((s) => s.id !== salida.id)) {
        const gps = { coords: salida.center, sectorId: salida.id };
        for (const origen of [resolverOrigen(null, gps)!, { tipo: 'sector' as const, sectorId: salida.id }]) {
          const solicitud: Solicitud = {
            origen, destino: { tipo: 'sector', sectorId: llegada.id }, pasajeros: 2, origenNota: '', destinoNota: 'tienda azul',
          };
          const cuerpo = armarCuerpoSolicitud(solicitud);
          expect(cuerpo).toMatchObject({ pasajeros: 2, sectorOrigenId: salida.id, sectorDestinoId: llegada.id });
          expect(cuerpo.origen).toBeDefined();
          expect(cuerpo.destino).toEqual(llegada.center);
        }
      }
    }
  });

  test('el plano sabe qué resaltar sin preguntar al servidor', () => {
    expect(sectorDeOrigen({ tipo: 'sector', sectorId: 'malecon' })).toBe('malecon');
    expect(sectorDeDestino({ tipo: 'sector', sectorId: 'la_loma' })).toBe('la_loma');
    expect(sectorDeDestino({ tipo: 'lugar', lugar: { sector_id: 'la_boca' } as any })).toBe('la_boca');
    expect(sectorDeDestino({ tipo: 'lugar', lugar: { sector_id: null } as any })).toBeNull();
    expect(sectorDeDestino(null)).toBeNull();
  });
});

// ─── Criterio 3: pedido sin respuesta y reintento sin duplicar (P4) ──────────
describe('017 · solicitar sin respuesta del servidor', () => {
  const socket = { isConnected: false, onEvent: jest.fn() };
  const solicitud: Solicitud = {
    origen: { tipo: 'sector', sectorId: 'la_boca' },
    destino: { tipo: 'sector', sectorId: 'malecon' },
    pasajeros: 1,
    origenNota: '',
    destinoNota: '',
  };
  const existente = {
    id: 'v1', serviceType: 'viaje', parcel: null, status: 'solicitado', originSectorId: 'la_boca',
    originName: 'La Boca', destinationSectorId: 'malecon', destinationName: 'Malecón de Crucita',
    passengers: 1, price: 0.5, destinationNote: '', driver: null, chatThreadId: null,
    createdAt: '2026-11-19T16:00:00Z',
  } as unknown as ActiveRide;
  const responder = (status: number, body: object) =>
    jest.mocked(authFetch).mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession({ user: { id: 'p1' } } as any);
    useRideStore.setState({ activeRide: null, isRequesting: false, ultimaSolicitud: null });
  });

  test('sin red o sin tiempo: no da el pedido por hecho y marca sinConexion para ofrecer reintentar', async () => {
    jest.mocked(authFetch).mockRejectedValueOnce(new TypeError('Network request failed'));
    const r = await useViajePasajero(socket).solicitar(solicitud);
    expect(r).toMatchObject({ ok: false, sinConexion: true });
    expect(useRideStore.getState().activeRide).toBeNull();
    expect(useRideStore.getState().isRequesting).toBe(false);

    const abortado = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    jest.mocked(authFetch).mockRejectedValueOnce(abortado);
    expect(await useViajePasajero(socket).solicitar(solicitud)).toMatchObject({ ok: false, sinConexion: true });
  });

  test('reintento cuyo primer envío sí llegó: el 409 muestra ese viaje como pedido hecho, sin duplicar', async () => {
    responder(409, { message: 'Ya tienes un viaje activo. Termínalo o cancélalo antes de pedir otro.' });
    jest.mocked(sincronizarViaje).mockResolvedValueOnce(existente);
    const r = await useViajePasajero(socket).solicitar(solicitud);
    expect(r).toEqual({ ok: true });
    expect(useRideStore.getState().activeRide?.id).toBe('v1');
    expect(authFetch).toHaveBeenCalledTimes(1);
  });

  test('409 sin un viaje que mostrar: se dice el mensaje del servidor, no es un problema de red', async () => {
    responder(409, { message: 'Ya tienes un viaje activo. Termínalo o cancélalo antes de pedir otro.' });
    jest.mocked(sincronizarViaje).mockResolvedValueOnce(null);
    const r = await useViajePasajero(socket).solicitar(solicitud);
    expect(r).toEqual({ ok: false, mensaje: 'Ya tienes un viaje activo. Termínalo o cancélalo antes de pedir otro.' });
  });

  test('otros rechazos del servidor no ofrecen reintentar', async () => {
    responder(400, { message: 'Datos inválidos.' });
    const r = await useViajePasajero(socket).solicitar(solicitud);
    expect(r).toEqual({ ok: false, mensaje: 'Datos inválidos.' });
    expect(sincronizarViaje).not.toHaveBeenCalled();
  });
});

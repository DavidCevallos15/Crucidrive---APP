// Paso 005, pantallas del pasajero (T8 a T11). Las acciones reales del hook se ejercitan con el
// mismo arnés que viajeSesionTardia: sin render ni efectos, pero con los stores y las promesas.
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
jest.mock('../src/constants/config', () => ({ API_CONFIG: { endpoints: { rides: {
  request: '/solicitar', updateStatus: () => '/estado',
  terminar: (id: string) => `/${id}/terminar`, cancelar: (id: string) => `/${id}/cancelar`,
  confirmar: (id: string) => `/${id}/confirmar`, calificar: (id: string) => `/${id}/calificar`,
} } } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const memoria = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => memoria.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { memoria.set(k, v); }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useViajePasajero } from '../src/hooks/useViajePasajero';
import { useAuthStore } from '../src/store/useAuthStore';
import { useRideStore, type ActiveRide } from '../src/store/useRideStore';
import { authFetch } from '../src/utils/authFetch';
import {
  alCambiarElViaje,
  crearBuzonEventos,
  sincronizarViaje,
  type FilaViaje,
  type LectorViaje,
} from '../src/utils/viaje';
import {
  alCalificar,
  alOfrecerCalificacion,
  estrellasValidas,
  faseDelCierre,
  leerRegistro,
  leerSancion,
  puedeCancelarConMotivo,
  puedeTerminarComoPasajero,
  sigueVigenteParaCalificar,
  textoConfirmar,
  textoResenasDelConductor,
  textoResumenCobro,
  textoSancion,
  tituloDelViaje,
  tocaOfrecerCalificacion,
  type RegistroCalificacion,
} from '../src/utils/viajePasajero';

const AHORA = Date.parse('2026-10-26T16:00:00Z');
const MIN = 60_000;

const viaje = (extra: Partial<ActiveRide> = {}): ActiveRide => ({
  id: 'v1',
  status: 'aceptado',
  serviceType: 'viaje',
  originSectorId: '',
  originName: 'Muelle',
  destinationSectorId: '',
  destinationName: 'Iglesia',
  passengers: 2,
  price: 1,
  destinationNote: '',
  driver: { id: 'c1', nombre: 'Luis Pin', telefono: '0991234567', placa: 'MB-123A' },
  chatThreadId: 't1',
  createdAt: '2026-10-26T15:00:00Z',
  ...extra,
});

describe('005 · estados que ve el pasajero (criterios 3 y 4)', () => {
  test('va en camino → llegó → en viaje', () => {
    expect(tituloDelViaje(viaje())).toBe('Tu tricimoto va en camino');
    expect(tituloDelViaje(viaje({ llegadoEn: '2026-10-26T15:30:00Z' }))).toBe('Tu tricimoto llegó');
    expect(tituloDelViaje(viaje({ status: 'en_curso' }))).toBe('Viaje en curso');
  });

  test('encomienda: los mismos pasos dicen paquete', () => {
    const e = { serviceType: 'encomienda' as const };
    expect(tituloDelViaje(viaje(e))).toBe('El conductor va por tu paquete');
    expect(tituloDelViaje(viaje({ ...e, llegadoEn: 'x' }))).toBe('El conductor llegó por tu paquete');
    expect(tituloDelViaje(viaje({ ...e, status: 'en_curso' }))).toBe('Tu paquete va en camino');
  });

  test('cancelar con motivo solo aceptado; terminar solo en curso (criterios 5b, 8 y 9)', () => {
    expect(puedeCancelarConMotivo('aceptado')).toBe(true);
    expect(puedeCancelarConMotivo('en_curso')).toBe(false);
    expect(puedeTerminarComoPasajero('en_curso')).toBe(true);
    expect(puedeTerminarComoPasajero('aceptado')).toBe(false);
  });
});

describe('005 · avisos del conductor sin recargar (criterios 3, 4, 5 y 11)', () => {
  const ahoraIso = '2026-10-26T15:45:00.000Z';

  test('«Llegué» marca la llegada; «Empezar» pasa a en curso', () => {
    expect(alCambiarElViaje(viaje(), { viajeId: 'v1', cambio: 'llegada' }, ahoraIso)?.llegadoEn).toBe(ahoraIso);
    expect(alCambiarElViaje(viaje(), { viajeId: 'v1', cambio: 'en_curso' }, ahoraIso)?.status).toBe('en_curso');
  });

  test('«Llegamos» deja el viaje finalizado con la hora y sin confirmar', () => {
    const r = alCambiarElViaje(viaje({ status: 'en_curso' }), { viajeId: 'v1', cambio: 'finalizado' }, ahoraIso);
    expect(r).toMatchObject({ status: 'finalizado', cierre: { finalizadoEn: ahoraIso, confirmacion: null } });
  });

  test('si el conductor cancela, el pasajero lo ve cancelado', () => {
    expect(alCambiarElViaje(viaje(), { viajeId: 'v1', cambio: 'cancelado_por_conductor' }, ahoraIso)?.status).toBe('cancelado');
  });

  test('un aviso de otro viaje, o sobre un viaje que no está abierto, no cambia nada', () => {
    const ride = viaje();
    expect(alCambiarElViaje(ride, { viajeId: 'otro', cambio: 'en_curso' }, ahoraIso)).toBe(ride);
    const buscando = viaje({ status: 'solicitado' });
    expect(alCambiarElViaje(buscando, { viajeId: 'v1', cambio: 'finalizado' }, ahoraIso)).toBe(buscando);
    expect(alCambiarElViaje(null, { viajeId: 'v1', cambio: 'llegada' }, ahoraIso)).toBeNull();
  });

  test('un aviso que llega antes que el viaje local se aplica al crearlo', () => {
    const buzon = crearBuzonEventos();
    buzon.recibir(null, { tipo: 'viaje_estado', datos: { viajeId: 'v1', cambio: 'cancelado_por_conductor' } });
    expect(buzon.aplicarGuardados(viaje())?.status).toBe('cancelado');
  });
});

describe('005 · leer el viaje al reconectar (criterios 5a, 5b, 11 y 15)', () => {
  const fila = (extra: Partial<FilaViaje> = {}): FilaViaje => ({
    id: 'v1', estado: 'aceptado', conductor_id: 'c1', pasajeros: 2, tarifa: '1.00',
    sector_origen_id: null, sector_destino_id: null, origen_descripcion: 'Muelle', destino_descripcion: 'Iglesia',
    creado_en: '2026-10-26T15:00:00Z', llegado_en: null, cancelado_por: null, finalizado_por: null,
    finalizado_en: null, confirmacion_pasajero: null, ...extra,
  });
  const lector = (f: FilaViaje | null, pendiente: FilaViaje | null = null): LectorViaje & { conductor: jest.Mock } => ({
    viaje: jest.fn().mockResolvedValue(f),
    viajeActivo: jest.fn().mockResolvedValue(f),
    conductor: jest.fn().mockResolvedValue({
      driver: { id: 'c1', nombre: 'Luis Pin', telefono: null, placa: 'MB-123A', resenas: { promedio: 4.8, total: 23 } },
      threadId: 't1',
    }),
    pendienteDeCerrar: jest.fn().mockResolvedValue(pendiente),
  });

  test('trae la hora de llegada del conductor', async () => {
    const r = await sincronizarViaje(lector(fila({ llegado_en: '2026-10-26T15:30:00Z' })), viaje({ driver: null }), 'p1');
    expect(r).toMatchObject({ status: 'aceptado', llegadoEn: '2026-10-26T15:30:00Z', driver: { resenas: { total: 23 } } });
  });

  test('el conductor canceló un viaje que el pasajero tenía a la vista: lo ve cancelado', async () => {
    const r = await sincronizarViaje(lector(fila({ estado: 'cancelado', cancelado_por: 'conductor' })), viaje(), 'p1');
    expect(r?.status).toBe('cancelado');
  });

  test('lo canceló el propio pasajero, o no había nada a la vista: nada que mostrar', async () => {
    expect(await sincronizarViaje(lector(fila({ estado: 'cancelado', cancelado_por: 'pasajero' })), viaje(), 'p1')).toBeNull();
    expect(await sincronizarViaje(lector(fila({ estado: 'cancelado', cancelado_por: 'conductor' })), viaje({ status: 'solicitado' }), 'p1')).toBeNull();
  });

  test('terminado por el conductor: queda para confirmar y calificar', async () => {
    const f = fila({ estado: 'finalizado', finalizado_por: 'conductor', finalizado_en: '2026-10-26T15:50:00Z' });
    const r = await sincronizarViaje(lector(f), viaje({ status: 'en_curso' }), 'p1');
    expect(r).toMatchObject({ status: 'finalizado', cierre: { finalizadoEn: '2026-10-26T15:50:00Z', confirmacion: null } });
  });

  test('terminado por el propio pasajero o con «No llegué»: no se confirma ni se califica', async () => {
    const porPasajero = fila({ estado: 'finalizado', finalizado_por: 'pasajero', finalizado_en: '2026-10-26T15:50:00Z' });
    expect(await sincronizarViaje(lector(porPasajero), viaje({ status: 'en_curso' }), 'p1')).toBeNull();
    const noLlego = fila({ estado: 'finalizado', finalizado_por: 'conductor', confirmacion_pasajero: 'no_llego' });
    expect(await sincronizarViaje(lector(noLlego), viaje({ status: 'finalizado' }), 'p1')).toBeNull();
  });

  test('al abrir la app sin viaje a la vista, ofrece el último terminado que falta cerrar (criterio 15)', async () => {
    const pendiente = fila({ estado: 'finalizado', finalizado_por: 'conductor', finalizado_en: '2026-10-26T15:00:00Z', confirmacion_pasajero: 'llego' });
    const r = await sincronizarViaje(lector(null, pendiente), null, 'p1');
    expect(r).toMatchObject({ id: 'v1', status: 'finalizado', cierre: { confirmacion: 'llego' }, driver: { nombre: 'Luis Pin' } });
  });

  test('sin pendiente, o con uno que no corresponde, no muestra nada', async () => {
    expect(await sincronizarViaje(lector(null, null), null, 'p1')).toBeNull();
    const porPasajero = fila({ estado: 'finalizado', finalizado_por: 'pasajero' });
    expect(await sincronizarViaje(lector(null, porPasajero), null, 'p1')).toBeNull();
  });
});

describe('005 · hoja final: confirmar llegada (criterio 5a)', () => {
  const cierre = (confirmacion: 'llego' | 'no_llego' | null, minutosAtras: number) => ({
    status: 'finalizado' as const,
    cierre: { finalizadoEn: new Date(AHORA - minutosAtras * MIN).toISOString(), confirmacion },
  });

  test('recién terminado: pide confirmar', () => {
    expect(faseDelCierre(cierre(null, 1), AHORA)).toBe('confirmar');
    expect(faseDelCierre(cierre(null, 29), AHORA)).toBe('confirmar');
  });

  test('a los 30 minutos sin responder cuenta como «llegó» y pasa a calificar', () => {
    expect(faseDelCierre(cierre(null, 30), AHORA)).toBe('calificar');
    expect(faseDelCierre(cierre(null, 300), AHORA)).toBe('calificar');
  });

  test('«Llegué» pasa a calificar; «No llegué» no califica ni reabre', () => {
    expect(faseDelCierre(cierre('llego', 1), AHORA)).toBe('calificar');
    expect(faseDelCierre(cierre('no_llego', 1), AHORA)).toBe('nada');
  });

  test('un viaje que no está finalizado, o sin cierre, no pide nada', () => {
    expect(faseDelCierre({ status: 'en_curso' }, AHORA)).toBe('nada');
    expect(faseDelCierre({ status: 'finalizado' }, AHORA)).toBe('nada');
  });

  test('los textos cambian en una encomienda', () => {
    expect(textoConfirmar(false)).toMatchObject({ si: 'Llegué', no: 'No llegué' });
    expect(textoConfirmar(true)).toMatchObject({ si: 'Se entregó', no: 'No se entregó' });
  });

  test('el resumen muestra el total en efectivo o el acuerdo en una encomienda', () => {
    expect(textoResumenCobro({ serviceType: 'viaje', price: 1.5 })).toBe('$1.50 en efectivo');
    expect(textoResumenCobro({ serviceType: 'encomienda', price: null })).toBe('Precio acordado con el conductor');
  });
});

describe('005 · calificar una vez, con un recordatorio más (criterios 15 y 16)', () => {
  test('sin registro toca ofrecer; se ofrece dos veces y luego no más', () => {
    let r: RegistroCalificacion | null = null;
    expect(tocaOfrecerCalificacion(r, 'v1')).toBe(true);
    r = alOfrecerCalificacion(r, 'v1');
    expect(r).toEqual({ viajeId: 'v1', ofrecida: 1, hecha: false });
    expect(tocaOfrecerCalificacion(r, 'v1')).toBe(true);
    r = alOfrecerCalificacion(r, 'v1');
    expect(r.ofrecida).toBe(2);
    expect(tocaOfrecerCalificacion(r, 'v1')).toBe(false);
  });

  test('calificado no se vuelve a ofrecer; otro viaje empieza de cero', () => {
    const hecha = alCalificar(alOfrecerCalificacion(null, 'v1'), 'v1');
    expect(hecha).toEqual({ viajeId: 'v1', ofrecida: 1, hecha: true });
    expect(tocaOfrecerCalificacion(hecha, 'v1')).toBe(false);
    expect(tocaOfrecerCalificacion(hecha, 'v2')).toBe(true);
    expect(alOfrecerCalificacion(hecha, 'v2')).toEqual({ viajeId: 'v2', ofrecida: 1, hecha: false });
  });

  test('un viaje de hace más de tres días ya no se ofrece', () => {
    expect(sigueVigenteParaCalificar(new Date(AHORA - 2 * 24 * 60 * MIN).toISOString(), AHORA)).toBe(true);
    expect(sigueVigenteParaCalificar(new Date(AHORA - 4 * 24 * 60 * MIN).toISOString(), AHORA)).toBe(false);
    expect(sigueVigenteParaCalificar(null, AHORA)).toBe(false);
  });

  test('lo guardado con mala forma se descarta', () => {
    expect(leerRegistro(JSON.stringify({ viajeId: 'v1', ofrecida: 1, hecha: false }))).toEqual({ viajeId: 'v1', ofrecida: 1, hecha: false });
    expect(leerRegistro('basura')).toBeNull();
    expect(leerRegistro(JSON.stringify({ viajeId: 1 }))).toBeNull();
    expect(leerRegistro(null)).toBeNull();
  });

  test('solo estrellas enteras de 1 a 5', () => {
    expect([0, 1, 5, 6, 2.5, NaN].map(estrellasValidas)).toEqual([false, true, true, false, false, false]);
  });
});

describe('005 · reseñas junto al conductor (criterio 18)', () => {
  test('«★ 4,8 · 23 reseñas», «Nuevo» y nada si el servidor no mandó el dato', () => {
    expect(textoResenasDelConductor({ resenas: { promedio: 4.8, total: 23 } })).toBe('★ 4,8 · 23 reseñas');
    expect(textoResenasDelConductor({ resenas: { promedio: null, total: 0 } })).toBe('Nuevo');
    expect(textoResenasDelConductor({})).toBe('');
    expect(textoResenasDelConductor(null)).toBe('');
  });
});

describe('005 · terminar el viaje el pasajero: aviso de la sanción (criterios 5b y 5c)', () => {
  test('lee los números del servidor; con forma inválida no inventa nada', () => {
    expect(leerSancion({ sancion: { llevas: 1, max: 3, ventanaDias: 30, bloqueoHoras: 24 } })).toEqual({ llevas: 1, max: 3, ventanaDias: 30, bloqueoHoras: 24 });
    expect(leerSancion({ sancion: { llevas: 'x', max: 3 } })).toBeNull();
    expect(leerSancion({ sancion: { llevas: 1, max: 0, ventanaDias: 30, bloqueoHoras: 24 } })).toBeNull();
    expect(leerSancion(null)).toBeNull();
    expect(leerSancion({})).toBeNull();
  });

  test('dice cuántas lleva y cuántas faltan', () => {
    expect(textoSancion({ llevas: 1, max: 3, ventanaDias: 30, bloqueoHoras: 24 })).toBe(
      'Llevas 1 de 3 viajes terminados por ti en 30 días. Te faltan 2 para no poder pedir durante 24 horas.');
    expect(textoSancion({ llevas: 2, max: 3, ventanaDias: 30, bloqueoHoras: 24 })).toMatch(/Te falta 1 para/);
    expect(textoSancion({ llevas: 3, max: 3, ventanaDias: 30, bloqueoHoras: 24 })).toMatch(/no podrás pedir viajes durante 24 horas/);
  });
});

// ─── Acciones reales del hook: nada avanza si el servidor no respondió (criterio 20) ───
describe('005 · sin conexión los botones no avanzan el estado (T11)', () => {
  const socket = { isConnected: true, onEvent: jest.fn() };
  const responder = (status: number, data: object = {}, message?: string) =>
    jest.mocked(authFetch).mockResolvedValueOnce(new Response(JSON.stringify({ data, message }), { status }));
  const sinRed = () => jest.mocked(authFetch).mockRejectedValueOnce(new TypeError('Network request failed'));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setSession({ user: { id: 'p1' } } as any);
    useRideStore.setState({ activeRide: viaje(), isRequesting: false, ultimaSolicitud: null });
  });

  test('cancelar con motivo envía el motivo y cierra solo si el servidor respondió', async () => {
    responder(200, { id: 'v1' });
    const r = await useViajePasajero(socket).cancelar('tarda_demasiado');
    expect(r).toEqual({ ok: true });
    expect(authFetch).toHaveBeenCalledWith('/v1/cancelar', { method: 'POST', body: JSON.stringify({ motivo: 'tarda_demasiado' }) });
    expect(useRideStore.getState().activeRide).toBeNull();
  });

  test('cancelar mientras busca no envía motivo (criterio 12 del 003)', async () => {
    useRideStore.setState({ activeRide: viaje({ status: 'solicitado', driver: null }) });
    responder(200, { id: 'v1' });
    await useViajePasajero(socket).cancelar();
    expect(authFetch).toHaveBeenCalledWith('/v1/cancelar', { method: 'POST', body: undefined });
  });

  test('sin red: avisa y deja el viaje como estaba', async () => {
    sinRed();
    const r = await useViajePasajero(socket).cancelar('otro');
    expect(r).toMatchObject({ ok: false, mensaje: expect.stringMatching(/conectar/) });
    expect(useRideStore.getState().activeRide?.status).toBe('aceptado');
  });

  test('el servidor rechaza: muestra su mensaje y no cierra el viaje', async () => {
    responder(409, {}, 'El viaje ya no está en ese paso. Actualiza la pantalla.');
    const r = await useViajePasajero(socket).cancelar('otro');
    expect(r).toEqual({ ok: false, mensaje: 'El viaje ya no está en ese paso. Actualiza la pantalla.' });
    expect(useRideStore.getState().activeRide?.status).toBe('aceptado');
  });

  test('terminar el viaje: devuelve la sanción y cierra; sin red no cierra', async () => {
    useRideStore.setState({ activeRide: viaje({ status: 'en_curso' }) });
    sinRed();
    expect(await useViajePasajero(socket).terminarComoPasajero()).toMatchObject({ ok: false });
    expect(useRideStore.getState().activeRide?.status).toBe('en_curso');

    responder(200, { id: 'v1', sancion: { llevas: 1, max: 3, ventanaDias: 30, bloqueoHoras: 24 } });
    const r = await useViajePasajero(socket).terminarComoPasajero();
    expect(r).toEqual({ ok: true, sancion: { llevas: 1, max: 3, ventanaDias: 30, bloqueoHoras: 24 } });
    expect(useRideStore.getState().activeRide).toBeNull();
  });

  test('«Llegué»: queda confirmado y pasa a calificar; sin red sigue sin confirmar', async () => {
    const cierre = { finalizadoEn: new Date().toISOString(), confirmacion: null as null };
    useRideStore.setState({ activeRide: viaje({ status: 'finalizado', cierre }) });
    sinRed();
    expect(await useViajePasajero(socket).confirmarLlegada(true)).toMatchObject({ ok: false });
    expect(useRideStore.getState().activeRide?.cierre?.confirmacion).toBeNull();

    responder(200, { id: 'v1' });
    expect(await useViajePasajero(socket).confirmarLlegada(true)).toEqual({ ok: true });
    expect(useRideStore.getState().activeRide?.cierre?.confirmacion).toBe('llego');
    expect(authFetch).toHaveBeenLastCalledWith('/v1/confirmar', { method: 'POST', body: JSON.stringify({ llego: true }) });
  });

  test('«No llegué»: se registra y el viaje se cierra sin calificar', async () => {
    const cierre = { finalizadoEn: new Date().toISOString(), confirmacion: null as null };
    useRideStore.setState({ activeRide: viaje({ status: 'finalizado', cierre }) });
    responder(200, { id: 'v1' });
    expect(await useViajePasajero(socket).confirmarLlegada(false)).toEqual({ ok: true });
    expect(useRideStore.getState().activeRide).toBeNull();
  });

  test('calificar: valida las estrellas antes de llamar, guarda que ya se hizo y cierra', async () => {
    const cierre = { finalizadoEn: new Date().toISOString(), confirmacion: 'llego' as const };
    useRideStore.setState({ activeRide: viaje({ status: 'finalizado', cierre }) });
    expect(await useViajePasajero(socket).calificar(0, '')).toMatchObject({ ok: false });
    expect(authFetch).not.toHaveBeenCalled();

    responder(200, { id: 'v1' });
    expect(await useViajePasajero(socket).calificar(5, '  Muy amable  ')).toEqual({ ok: true });
    expect(authFetch).toHaveBeenCalledWith('/v1/calificar', { method: 'POST', body: JSON.stringify({ estrellas: 5, comentario: 'Muy amable' }) });
    expect(useRideStore.getState().activeRide).toBeNull();
    await new Promise((r) => setImmediate(r));
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'crucidrive:calificacion:v1:p1', JSON.stringify({ viajeId: 'v1', ofrecida: 1, hecha: true }));
  });

  test('calificar sin comentario no manda el campo; si ya estaba calificado, el servidor responde 409 y la hoja sigue', async () => {
    const cierre = { finalizadoEn: new Date().toISOString(), confirmacion: 'llego' as const };
    useRideStore.setState({ activeRide: viaje({ status: 'finalizado', cierre }) });
    responder(409, {}, 'Ya calificaste este viaje.');
    const r = await useViajePasajero(socket).calificar(4, '');
    expect(authFetch).toHaveBeenCalledWith('/v1/calificar', { method: 'POST', body: JSON.stringify({ estrellas: 4 }) });
    expect(r).toEqual({ ok: false, mensaje: 'Ya calificaste este viaje.' });
    expect(useRideStore.getState().activeRide?.status).toBe('finalizado');
  });

  test('«Ahora no» cierra la hoja sin llamar al servidor', () => {
    const cierre = { finalizadoEn: new Date().toISOString(), confirmacion: null as null };
    useRideStore.setState({ activeRide: viaje({ status: 'finalizado', cierre }) });
    useViajePasajero(socket).cerrarSinResponder();
    expect(useRideStore.getState().activeRide).toBeNull();
    expect(authFetch).not.toHaveBeenCalled();
  });
});

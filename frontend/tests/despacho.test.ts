/**
 * Paso 003 · app.
 * T12: búsqueda de lugares (criterios 18, 20 y 25): normalización igual a la BD, mínimo de
 * 2 letras, espera entre teclas, respuestas viejas descartadas y atribución de OSM.
 * T13: origen por GPS, lugar o sector (21) y estados de la solicitud del pasajero:
 * buscando (16), sin conductor con "Volver a pedir" (11) y aceptado (10).
 * T14: consola del conductor: cuenta regresiva desde venceEn con el desfase del reloj (R14),
 * una oferta a la vez (7), retirada (6, 12), lo que muestra la oferta (15) y contraste (28).
 * T15: formulario de lugares del administrador (24): mismas reglas que la BD y el backend.
 */
import { normalizar, puedeBuscar } from '../src/utils/texto';
import {
  ATRIBUCION_OSM,
  ICONO_CATEGORIA,
  buscarLugares,
  crearBuscadorLugares,
  type ClienteRpc,
  type EstadoBusqueda,
  type Lugar,
} from '../src/utils/lugares';
import {
  armarCuerpoSolicitud,
  nombreOrigen,
  refrescarOrigen,
  resolverOrigen,
  type Gps,
  type Solicitud,
} from '../src/utils/solicitud';
import {
  alAceptarViaje,
  alQuedarSinConductor,
  crearBuzonEventos,
  sincronizarViaje,
  type EventoViajeAceptado,
  type FilaViaje,
  type LectorViaje,
} from '../src/utils/viaje';
import { useRideStore, type ActiveRide } from '../src/store/useRideStore';
import {
  COLORES_OFERTA,
  alRecibirOferta,
  alRetirarOferta,
  calcularDesfase,
  contraste,
  estadoTrasError,
  segundosRestantes,
  textoDistancia,
  textoPunto,
  type OfertaViaje,
} from '../src/utils/oferta';
import { SECTORS } from '../src/constants/sectors';
import {
  CATEGORIAS,
  NOMBRE_LUGAR_MAX,
  cambiosLugar,
  enZonaDeCrucita,
  formularioDesde,
  limpiarNombre,
  validarLugar,
  type FormularioLugar,
  type LugarAdmin,
} from '../src/utils/lugaresAdmin';

const lugar = (nombre: string, extra: Partial<Lugar> = {}): Lugar => ({
  id: `id-${nombre}`, nombre, categoria: 'comida', sector_id: 'malecon', lat: -0.87, lng: -80.54, ...extra,
});

describe('T12 · normalización (igual que private.normalizar)', () => {
  test('quita tildes, pasa a minúsculas y junta espacios', () => {
    expect(normalizar('  Cevichería   EL Mañaba ')).toBe('cevicheria el manaba');
    expect(normalizar(null)).toBe('');
  });

  test('exige al menos 2 letras y como mucho 80', () => {
    expect(puedeBuscar('m')).toBe(false);
    expect(puedeBuscar('  m  ')).toBe(false);
    expect(puedeBuscar('mu')).toBe(true);
    expect(puedeBuscar('a'.repeat(81))).toBe(false);
  });
});

describe('T12 · buscarLugares (criterio 18)', () => {
  test('llama a buscar_lugares de la BD, no a un servicio externo', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [lugar('Muelle de Crucita')], error: null });
    const resultados = await buscarLugares({ rpc } as unknown as ClienteRpc, 'muelle');
    expect(rpc).toHaveBeenCalledWith('buscar_lugares', { q: 'muelle' });
    expect(resultados.map((l) => l.nombre)).toEqual(['Muelle de Crucita']);
  });

  test('con menos de 2 letras no consulta nada', async () => {
    const rpc = jest.fn();
    await expect(buscarLugares({ rpc } as unknown as ClienteRpc, 'm')).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  test('un error de la BD se propaga para mostrar un aviso', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'caída' } });
    await expect(buscarLugares({ rpc } as unknown as ClienteRpc, 'muelle')).rejects.toThrow('caída');
  });
});

describe('T12 · buscador mientras se escribe', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const montar = (buscar: (q: string) => Promise<Lugar[]>) => {
    const estados: EstadoBusqueda[] = [];
    const buscador = crearBuscadorLugares({ buscar, alCambiar: (e) => estados.push(e), esperaMs: 250 });
    return { buscador, estados, ultimo: () => estados[estados.length - 1] };
  };

  test('espera 250 ms después de la última tecla y busca una sola vez', async () => {
    const buscar = jest.fn().mockResolvedValue([lugar('Farmacias Santa Martha')]);
    const { buscador, ultimo } = montar(buscar);
    buscador.escribir('fa');
    buscador.escribir('far');
    buscador.escribir('farm');
    expect(ultimo().cargando).toBe(true);
    await jest.advanceTimersByTimeAsync(249);
    expect(buscar).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith('farm');
    expect(ultimo()).toMatchObject({ cargando: false, buscado: true });
    expect(ultimo().resultados).toHaveLength(1);
  });

  test('descarta la respuesta de una búsqueda vieja que llega tarde', async () => {
    let resolverVieja: (l: Lugar[]) => void = () => {};
    const buscar = jest.fn()
      .mockImplementationOnce(() => new Promise<Lugar[]>((r) => { resolverVieja = r; }))
      .mockResolvedValueOnce([lugar('Pizzería Genoa')]);
    const { buscador, ultimo } = montar(buscar);
    buscador.escribir('pi');
    await jest.advanceTimersByTimeAsync(250); // la primera queda en vuelo
    buscador.escribir('pizz');
    await jest.advanceTimersByTimeAsync(250);
    resolverVieja([lugar('Picantería Omega 3')]); // llega tarde
    await Promise.resolve();
    expect(ultimo().resultados.map((l) => l.nombre)).toEqual(['Pizzería Genoa']);
  });

  test('criterio 20: sin coincidencias queda "buscado" con lista vacía, para ofrecer sector y referencia', async () => {
    const { buscador, ultimo } = montar(jest.fn().mockResolvedValue([]));
    buscador.escribir('casa de mi tía');
    await jest.advanceTimersByTimeAsync(250);
    expect(ultimo()).toEqual({ resultados: [], cargando: false, error: null, buscado: true });
  });

  test('sin conexión muestra un aviso en vez de una lista vacía', async () => {
    const { buscador, ultimo } = montar(jest.fn().mockRejectedValue(new Error('red')));
    buscador.escribir('muelle');
    await jest.advanceTimersByTimeAsync(250);
    expect(ultimo().error).toContain('conexión');
  });

  test('al borrar el texto vuelve al estado inicial sin consultar', async () => {
    const buscar = jest.fn().mockResolvedValue([]);
    const { buscador, ultimo } = montar(buscar);
    buscador.escribir('mu');
    buscador.escribir('');
    await jest.advanceTimersByTimeAsync(500);
    expect(buscar).not.toHaveBeenCalled();
    expect(ultimo()).toEqual({ resultados: [], cargando: false, error: null, buscado: false });
  });
});

describe('T12 · presentación', () => {
  test('criterio 25: la atribución de OpenStreetMap está definida', () => {
    expect(ATRIBUCION_OSM).toBe('© OpenStreetMap');
  });

  test('cada categoría del catálogo (CHECK de 0011) tiene ícono', () => {
    const categorias = ['comida', 'hospedaje', 'tienda', 'salud', 'educacion', 'religion', 'gobierno', 'turismo', 'transporte', 'poblado', 'otro'];
    expect(Object.keys(ICONO_CATEGORIA).sort()).toEqual([...categorias].sort());
  });
});

// ─── T13 ─────────────────────────────────────────────────────

const centro = (id: string) => SECTORS.find((x) => x.id === id)!.center;
const gps: Gps = { coords: { lat: -0.85, lng: -80.53 }, sectorId: SECTORS[2].id };
const muelle = lugar('Muelle de Crucita', { id: 'lugar-muelle', categoria: 'turismo', sector_id: SECTORS[3].id });

const solicitud = (extra: Partial<Solicitud> = {}): Solicitud => ({
  origen: { tipo: 'gps', coords: gps!.coords, sectorId: gps!.sectorId },
  destino: { tipo: 'lugar', lugar: muelle },
  pasajeros: 2,
  origenNota: '',
  destinoNota: '',
  ...extra,
});

const viajeLocal = (extra: Partial<ActiveRide> = {}): ActiveRide => ({
  id: 'viaje-1',
  status: 'solicitado',
  originSectorId: SECTORS[2].id,
  originName: 'Tu ubicación',
  destinationSectorId: SECTORS[3].id,
  destinationName: 'Muelle de Crucita',
  passengers: 2,
  price: 1,
  destinationNote: '',
  driver: null,
  chatThreadId: null,
  createdAt: '2026-10-09T15:00:00Z',
  ...extra,
});

const aceptado: EventoViajeAceptado = {
  viajeId: 'viaje-1',
  conductor: { id: 'cond-1', nombre: 'Luis Pin', telefono: '0991234567', placa: 'MB-123A' },
  chat: { threadId: 'hilo-1' },
};

describe('T13 · origen del viaje (criterio 21)', () => {
  test('con GPS y sin elegir nada, el origen es la ubicación del pasajero', () => {
    expect(resolverOrigen(null, gps)).toEqual({ tipo: 'gps', coords: gps!.coords, sectorId: gps!.sectorId });
    expect(nombreOrigen(resolverOrigen(null, gps))).toBe(`Tu ubicación · ${SECTORS[2].name}`);
  });

  test('sin GPS y sin elegir, no hay origen: la app pide un lugar o un sector', () => {
    expect(resolverOrigen(null, null)).toBeNull();
  });

  test('un lugar o un sector elegidos ganan al GPS', () => {
    expect(resolverOrigen({ tipo: 'lugar', lugar: muelle }, gps)).toEqual({ tipo: 'lugar', lugar: muelle });
    expect(resolverOrigen({ tipo: 'sector', sectorId: SECTORS[0].id }, null)).toEqual({ tipo: 'sector', sectorId: SECTORS[0].id });
  });
});

describe('T13 · cuerpo de la solicitud', () => {
  test('origen por GPS: envía sus coordenadas y su sector; destino lugar: solo el id (criterio 19)', () => {
    expect(armarCuerpoSolicitud(solicitud())).toEqual({
      pasajeros: 2,
      origen: gps!.coords,
      sectorOrigenId: gps!.sectorId,
      lugarDestinoId: 'lugar-muelle',
    });
  });

  test('origen lugar: solo el id; la BD pone coordenadas, nombre y sector', () => {
    const cuerpo = armarCuerpoSolicitud(solicitud({ origen: { tipo: 'lugar', lugar: muelle }, destino: { tipo: 'sector', sectorId: SECTORS[0].id } }));
    expect(cuerpo).toEqual({
      pasajeros: 2,
      lugarOrigenId: 'lugar-muelle',
      destino: centro(SECTORS[0].id),
      sectorDestinoId: SECTORS[0].id,
    });
  });

  test('origen sector sin GPS: centro del sector y la referencia escrita (recortada)', () => {
    const cuerpo = armarCuerpoSolicitud(solicitud({
      origen: { tipo: 'sector', sectorId: SECTORS[1].id },
      origenNota: '  casa azul junto a la cancha ',
      destinoNota: '   ',
    }));
    expect(cuerpo.origen).toEqual(centro(SECTORS[1].id));
    expect(cuerpo.sectorOrigenId).toBe(SECTORS[1].id);
    expect(cuerpo.origenDescripcion).toBe('casa azul junto a la cancha');
    expect(cuerpo).not.toHaveProperty('destinoDescripcion');
  });

  test('nunca envía precio: lo fija la BD (D-08)', () => {
    const cuerpo = armarCuerpoSolicitud(solicitud());
    expect(cuerpo).not.toHaveProperty('tarifa');
    expect(cuerpo).not.toHaveProperty('precio');
  });

  test('un sector inexistente no se envía', () => {
    expect(() => armarCuerpoSolicitud(solicitud({ destino: { tipo: 'sector', sectorId: 'no-existe' } }))).toThrow();
  });
});

describe('T13 · "No hay tricimotos disponibles ahora" (criterio 11)', () => {
  beforeEach(() => useRideStore.setState({ activeRide: null, isRequesting: false, ultimaSolicitud: null }));

  test('viaje_sin_conductor cierra la búsqueda del viaje propio', () => {
    expect(alQuedarSinConductor(viajeLocal(), { viajeId: 'viaje-1' })?.status).toBe('sin_conductor');
  });

  test('un aviso de otro viaje o de un viaje ya aceptado no cambia nada', () => {
    const ride = viajeLocal();
    expect(alQuedarSinConductor(ride, { viajeId: 'otro' })).toBe(ride);
    const ya = viajeLocal({ status: 'aceptado' });
    expect(alQuedarSinConductor(ya, { viajeId: 'viaje-1' })).toBe(ya);
  });

  test('"Volver a pedir" reusa la solicitud guardada aunque se limpie el viaje', () => {
    const s = solicitud({ pasajeros: 4, destinoNota: 'frente a las letras' });
    useRideStore.getState().setUltimaSolicitud(s);
    useRideStore.getState().setActiveRide(viajeLocal({ status: 'sin_conductor' }));
    useRideStore.getState().clearRide();
    expect(useRideStore.getState().ultimaSolicitud).toEqual(s);
  });

  test('al volver a pedir, el origen por GPS toma la posición actual; un lugar no cambia', () => {
    const movido: Gps = { coords: { lat: -0.86, lng: -80.535 }, sectorId: SECTORS[3].id };
    expect(refrescarOrigen(solicitud(), movido).origen).toEqual({ tipo: 'gps', ...movido });
    const conLugar = solicitud({ origen: { tipo: 'lugar', lugar: muelle } });
    expect(refrescarOrigen(conLugar, movido)).toBe(conLugar);
    expect(refrescarOrigen(solicitud(), null)).toEqual(solicitud());
  });
});

describe('T13 · aceptado sin recargar (criterios 10 y 16)', () => {
  test('viaje_aceptado pasa a "aceptado" con nombre, placa, teléfono y chat', () => {
    const ride = alAceptarViaje(viajeLocal(), aceptado)!;
    expect(ride.status).toBe('aceptado');
    expect(ride.driver).toEqual(aceptado.conductor);
    expect(ride.chatThreadId).toBe('hilo-1');
  });

  test('un aceptado de otro viaje se ignora', () => {
    const ride = viajeLocal();
    expect(alAceptarViaje(ride, { ...aceptado, viajeId: 'otro' })).toBe(ride);
  });

  test('un aviso que llega antes que la respuesta de /solicitar se aplica al crear el viaje', () => {
    const buzon = crearBuzonEventos();
    expect(buzon.recibir(null, { tipo: 'viaje_sin_conductor', datos: { viajeId: 'viaje-1' } })).toBeNull();
    expect(buzon.aplicarGuardados(viajeLocal())?.status).toBe('sin_conductor');
    // Ya se aplicó: no se repite en el siguiente viaje con el mismo id.
    expect(buzon.aplicarGuardados(viajeLocal())?.status).toBe('solicitado');
  });

  test('el buzón no mezcla avisos de otros viajes', () => {
    const buzon = crearBuzonEventos();
    buzon.recibir(null, { tipo: 'viaje_aceptado', datos: { ...aceptado, viajeId: 'viejo' } });
    expect(buzon.aplicarGuardados(viajeLocal())?.status).toBe('solicitado');
  });
});

describe('T13 · lectura del viaje al reconectar (criterio 16)', () => {
  const fila = (extra: Partial<FilaViaje> = {}): FilaViaje => ({
    id: 'viaje-1',
    estado: 'solicitado',
    conductor_id: null,
    pasajeros: 2,
    tarifa: '1.00',
    sector_origen_id: SECTORS[2].id,
    sector_destino_id: SECTORS[3].id,
    origen_descripcion: null,
    destino_descripcion: 'Muelle de Crucita',
    creado_en: '2026-10-09T15:00:00Z',
    ...extra,
  });

  const lector = (f: FilaViaje | null): LectorViaje & { conductor: jest.Mock } => ({
    viaje: jest.fn().mockResolvedValue(f),
    viajeActivo: jest.fn().mockResolvedValue(f),
    conductor: jest.fn().mockResolvedValue({
      driver: { id: 'cond-1', nombre: 'Luis Pin', telefono: '0991234567', placa: 'MB-123A' },
      threadId: 'hilo-1',
    }),
  });

  test('aceptado mientras no había señal: lee al conductor y el chat', async () => {
    const l = lector(fila({ estado: 'aceptado', conductor_id: 'cond-1' }));
    const ride = await sincronizarViaje(l, viajeLocal(), 'pas-1');
    expect(l.viaje).toHaveBeenCalledWith('viaje-1');
    expect(ride?.status).toBe('aceptado');
    expect(ride?.driver?.placa).toBe('MB-123A');
    expect(ride?.chatThreadId).toBe('hilo-1');
  });

  test('con el conductor ya conocido no vuelve a leerlo', async () => {
    const l = lector(fila({ estado: 'en_curso', conductor_id: 'cond-1' }));
    const ride = await sincronizarViaje(l, alAceptarViaje(viajeLocal(), aceptado), 'pas-1');
    expect(ride?.status).toBe('en_curso');
    expect(l.conductor).not.toHaveBeenCalled();
  });

  test('cerrado como sin_conductor mientras esperaba: muestra el aviso (criterio 11)', async () => {
    expect((await sincronizarViaje(lector(fila({ estado: 'sin_conductor' })), viajeLocal(), 'pas-1'))?.status)
      .toBe('sin_conductor');
  });

  test('un viaje finalizado o cancelado limpia el estado', async () => {
    expect(await sincronizarViaje(lector(fila({ estado: 'cancelado' })), viajeLocal(), 'pas-1')).toBeNull();
    expect(await sincronizarViaje(lector(fila({ estado: 'finalizado' })), viajeLocal(), 'pas-1')).toBeNull();
  });

  test('al abrir la app con una solicitud viva, vuelve a "Buscando tricimoto…"', async () => {
    const l = lector(fila());
    const ride = await sincronizarViaje(l, null, 'pas-1');
    expect(l.viajeActivo).toHaveBeenCalledWith('pas-1');
    expect(ride).toMatchObject({ id: 'viaje-1', status: 'solicitado', price: 1, destinationName: 'Muelle de Crucita' });
    expect(ride?.originName).toBe(SECTORS[2].name);
  });

  test('sin viaje activo no hay nada que mostrar', async () => {
    expect(await sincronizarViaje(lector(null), null, 'pas-1')).toBeNull();
  });

  test('si la lectura falla, el error sube y quien llama conserva lo local', async () => {
    const l = lector(null);
    l.viaje = jest.fn().mockRejectedValue(new Error('sin red'));
    await expect(sincronizarViaje(l, viajeLocal(), 'pas-1')).rejects.toThrow('sin red');
  });
});

// ─── T14 ─────────────────────────────────────────────────────

const oferta = (extra: Partial<OfertaViaje> = {}): OfertaViaje => ({
  viajeId: 'viaje-1',
  pasajeros: 3,
  tarifa: 1.5,
  origen: { sectorId: SECTORS[3].id, descripcion: 'Muelle de Crucita' },
  destino: { sectorId: SECTORS[0].id, descripcion: null },
  distanciaM: 420,
  fase: 'secuencial',
  venceEn: 1_000_000 + 15_000,
  ...extra,
});

describe('T14 · cuenta regresiva desde venceEn (R14)', () => {
  test('con el reloj en hora, una oferta recién creada marca 15 s', () => {
    expect(segundosRestantes(1_015_000, 0, 1_000_000)).toBe(15);
  });

  test('si la oferta llega 2 s tarde, marca 13, igual que la BD', () => {
    expect(segundosRestantes(1_015_000, 0, 1_002_000)).toBe(13);
  });

  test('corrige el reloj del teléfono atrasado o adelantado con hora_servidor', () => {
    // El teléfono va 30 s atrasado: sin corregir mostraría 45 s.
    const desfase = calcularDesfase(1_000_000, 970_000);
    expect(desfase).toBe(30_000);
    expect(segundosRestantes(1_015_000, desfase, 970_000)).toBe(15);
    // Adelantado 5 s.
    expect(segundosRestantes(1_015_000, calcularDesfase(1_000_000, 1_005_000), 1_005_000)).toBe(15);
  });

  test('nunca es negativa y redondea hacia arriba (0 solo al vencer)', () => {
    expect(segundosRestantes(1_015_000, 0, 1_020_000)).toBe(0);
    expect(segundosRestantes(1_015_000, 0, 1_014_900)).toBe(1);
  });

  test('una hora del servidor inválida no rompe la cuenta', () => {
    expect(calcularDesfase(Number.NaN, 1_000_000)).toBe(0);
  });
});

describe('T14 · ofertas en pantalla (criterios 6, 7 y 12)', () => {
  test('una oferta a la vez: la nueva reemplaza a la anterior', () => {
    const nueva = oferta({ viajeId: 'viaje-2' });
    expect(alRecibirOferta(oferta(), nueva)).toBe(nueva);
  });

  test('oferta_retirada cierra la oferta de ese viaje', () => {
    expect(alRetirarOferta(oferta(), 'viaje-1')).toBeNull();
  });

  test('una retirada de otro viaje no cierra la oferta actual', () => {
    const actual = oferta();
    expect(alRetirarOferta(actual, 'viaje-viejo')).toBe(actual);
    expect(alRetirarOferta(null, 'viaje-1')).toBeNull();
  });

  test('un 409 al cambiar la disponibilidad significa viaje en curso', () => {
    expect(estadoTrasError(409, 'disponible')).toBe('ocupado');
    expect(estadoTrasError(403, 'inactivo')).toBe('inactivo');
  });
});

describe('T14 · lo que ve el conductor (criterio 15)', () => {
  test('origen y destino: referencia y sector, o solo el sector', () => {
    expect(textoPunto(oferta().origen)).toBe(`Muelle de Crucita · ${SECTORS[3].name}`);
    expect(textoPunto(oferta().destino)).toBe(SECTORS[0].name);
    expect(textoPunto({ sectorId: null, descripcion: null })).toBe('Sin referencia');
  });

  test('distancia aproximada en m o km', () => {
    expect(textoDistancia(423)).toBe('a 420 m');
    expect(textoDistancia(3)).toBe('a 10 m');
    expect(textoDistancia(1250)).toBe('a 1,3 km');
    expect(textoDistancia(null)).toBe('');
  });

  test('el payload de la oferta no trae datos del pasajero', () => {
    const claves = Object.keys(oferta());
    for (const prohibida of ['telefono', 'nombre', 'pasajeroNombre', 'lat', 'lng', 'coords']) {
      expect(claves).not.toContain(prohibida);
    }
  });
});

describe('T14 · regla 6: contraste del modal de oferta (criterio 28)', () => {
  const c = COLORES_OFERTA;
  test.each([
    ['texto', c.texto, c.fondo],
    ['texto suave', c.textoSuave, c.fondo],
    ['cuenta regresiva y total', c.cuenta, c.fondo],
    ['Aceptar', c.aceptarTexto, c.aceptarFondo],
    ['Rechazar', c.rechazarTexto, c.rechazarFondo],
    ['aviso sin conexión', c.avisoTexto, c.avisoFondo],
  ])('%s cumple AA (≥ 4,5:1)', (_nombre, texto, fondo) => {
    expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  test('el cálculo de contraste coincide con WCAG (blanco/negro = 21)', () => {
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });
});

// ─── T15 ─────────────────────────────────────────────────────

const formulario = (extra: Partial<FormularioLugar> = {}): FormularioLugar => ({
  nombre: 'Farmacia Santa Martha',
  categoria: 'salud',
  lat: '-0.8714',
  lng: '-80.5401',
  visible: true,
  ...extra,
});

const lugarAdmin = (extra: Partial<LugarAdmin> = {}): LugarAdmin => ({
  id: 'l-1',
  nombre: 'Farmacia Santa Martha',
  categoria: 'salud',
  sector_id: SECTORS[3].id,
  fuente: 'osm',
  visible: true,
  editado_por_admin: false,
  actualizado_en: '2026-10-09T00:00:00Z',
  lat: -0.8714,
  lng: -80.5401,
  ...extra,
});

describe('T15 · formulario de lugares (criterio 24)', () => {
  test('un formulario completo es válido y limpia el nombre como el backend', () => {
    const r = validarLugar(formulario({ nombre: '  Farmacia   Santa  Martha ' }));
    expect(r).toEqual({
      ok: true,
      cuerpo: { nombre: 'Farmacia Santa Martha', categoria: 'salud', lat: -0.8714, lng: -80.5401, visible: true },
    });
    expect(limpiarNombre(' a  b ')).toBe('a b');
  });

  test('nombre entre 2 y 120 caracteres (CHECK de 0011)', () => {
    expect(validarLugar(formulario({ nombre: ' x ' })).ok).toBe(false);
    expect(validarLugar(formulario({ nombre: 'x'.repeat(NOMBRE_LUGAR_MAX + 1) })).ok).toBe(false);
    expect(validarLugar(formulario({ nombre: 'x'.repeat(NOMBRE_LUGAR_MAX) })).ok).toBe(true);
  });

  test('las categorías son las del CHECK de la BD', () => {
    expect(CATEGORIAS.map((c) => c.value).sort()).toEqual(Object.keys(ICONO_CATEGORIA).sort());
    const r = validarLugar(formulario({ categoria: '' }));
    expect(r.ok === false && r.errores.categoria).toBeTruthy();
  });

  test('acepta coma decimal en latitud y longitud', () => {
    const r = validarLugar(formulario({ lat: '-0,8714', lng: '-80,5401' }));
    expect(r.ok && r.cuerpo.lat).toBe(-0.8714);
  });

  test('sin ubicación o con texto que no es número, pide marcarla', () => {
    for (const f of [formulario({ lat: '', lng: '' }), formulario({ lat: 'abc' }), formulario({ lng: '1e5' })]) {
      const r = validarLugar(f);
      expect(r.ok === false && r.errores.ubicacion).toContain('mapa');
    }
  });

  test('un punto lejos de Crucita (latitud y longitud cruzadas) se rechaza', () => {
    const r = validarLugar(formulario({ lat: '-80.5401', lng: '-0.8714' }));
    expect(r.ok === false && r.errores.ubicacion).toContain('lejos');
    expect(enZonaDeCrucita(-0.2, -78.5)).toBe(false); // Quito
    for (const s of SECTORS) expect(enZonaDeCrucita(s.center.lat, s.center.lng)).toBe(true);
  });

  test('junta todos los errores a la vez', () => {
    const r = validarLugar({ nombre: '', categoria: '', lat: '', lng: '', visible: true });
    expect(r.ok === false && Object.keys(r.errores).sort()).toEqual(['categoria', 'nombre', 'ubicacion']);
  });
});

describe('T15 · corregir un lugar existente', () => {
  test('el formulario parte de los datos del lugar; uno nuevo arranca visible y vacío', () => {
    expect(formularioDesde(lugarAdmin())).toEqual({
      nombre: 'Farmacia Santa Martha', categoria: 'salud', lat: '-0.871400', lng: '-80.540100', visible: true,
    });
    expect(formularioDesde(null)).toEqual({ nombre: '', categoria: '', lat: '', lng: '', visible: true });
  });

  test('PATCH lleva solo lo que cambió', () => {
    const original = lugarAdmin();
    const r = validarLugar({ ...formularioDesde(original), nombre: 'Farmacia Sta. Martha' });
    expect(r.ok && cambiosLugar(original, r.cuerpo)).toEqual({ nombre: 'Farmacia Sta. Martha' });
  });

  test('ocultar envía solo visible: false (no hay borrado)', () => {
    const original = lugarAdmin();
    const r = validarLugar({ ...formularioDesde(original), visible: false });
    expect(r.ok && cambiosLugar(original, r.cuerpo)).toEqual({ visible: false });
  });

  test('mover el punto envía lat y lng juntos, como pide el backend', () => {
    const original = lugarAdmin();
    const r = validarLugar({ ...formularioDesde(original), lat: '-0.8720' });
    expect(r.ok && cambiosLugar(original, r.cuerpo)).toEqual({ lat: -0.872, lng: -80.5401 });
  });

  test('sin cambios no hay nada que guardar', () => {
    const original = lugarAdmin();
    const r = validarLugar(formularioDesde(original));
    expect(r.ok && cambiosLugar(original, r.cuerpo)).toEqual({});
  });
});

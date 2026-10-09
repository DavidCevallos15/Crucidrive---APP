/**
 * Paso 003 · app.
 * T12: búsqueda de lugares (criterios 18, 20 y 25): normalización igual a la BD, mínimo de
 * 2 letras, espera entre teclas, respuestas viejas descartadas y atribución de OSM.
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

// Paso 007, criterio 11: desde la 0019 el teléfono no se lee con select sobre perfiles.
// Las pantallas del viaje (pasajero y conductor) lo piden a telefono_contraparte y el perfil
// propio sale de mi_perfil. Se ejercitan los lectores reales con un cliente de Supabase falso.
import * as fs from 'fs';
import * as path from 'path';

type Llamada = { tipo: 'from'; tabla: string; columnas?: string } | { tipo: 'rpc'; fn: string; args?: unknown };

const mockLlamadas: Llamada[] = [];
const mockRespuestasRpc: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('../src/utils/supabaseClient', () => {
  const tablas: Record<string, unknown> = {
    perfiles: { nombre: 'Carla' },
    tricimotos: { placa: 'ABC-123' },
    threads: { id: 'hilo-1' },
  };
  return {
    supabase: {
      from: (tabla: string) => {
        const llamada: { tipo: 'from'; tabla: string; columnas?: string } = { tipo: 'from', tabla };
        mockLlamadas.push(llamada);
        const q: any = {
          select: (columnas: string) => { llamada.columnas = columnas; return q; },
          eq: () => q,
          maybeSingle: async () => ({ data: tablas[tabla] ?? null, error: null }),
        };
        return q;
      },
      rpc: async (fn: string, args?: unknown) => {
        mockLlamadas.push({ tipo: 'rpc', fn, args });
        return mockRespuestasRpc[fn] ?? { data: null, error: null };
      },
    },
  };
});
jest.mock('../src/utils/authFetch', () => ({ authFetch: jest.fn() }));
jest.mock('../src/constants/config', () => ({ API_CONFIG: { endpoints: { rides: {
  request: '/solicitar', updateStatus: () => '/estado', llegada: () => '/llegada',
  iniciar: () => '/iniciar', terminar: () => '/terminar', cancelar: () => '/cancelar',
} } } }));

import { crearLector } from '../src/hooks/useViajePasajero';
import { lector as lectorConductor } from '../src/hooks/useViajeConductor';
import { textoONulo } from '../src/utils/telefono';

beforeEach(() => {
  mockLlamadas.length = 0;
  for (const k of Object.keys(mockRespuestasRpc)) delete mockRespuestasRpc[k];
});

const columnasDePerfiles = () =>
  mockLlamadas.filter((l): l is Extract<Llamada, { tipo: 'from' }> => l.tipo === 'from' && l.tabla === 'perfiles')
    .map((l) => l.columnas ?? '');

describe('007 · el teléfono de la otra parte sale de telefono_contraparte', () => {
  test('pasajero: con el viaje activo ve nombre y teléfono del conductor, sin pedir la columna', async () => {
    mockRespuestasRpc.telefono_contraparte = { data: '0992222222', error: null };
    mockRespuestasRpc.resumen_conductor = { data: [{ promedio: 4.8, total: 3 }], error: null };
    const { driver } = await crearLector(new Set()).conductor('v1', 'c1');
    expect(driver).toMatchObject({ id: 'c1', nombre: 'Carla', telefono: '0992222222', placa: 'ABC-123' });
    expect(mockLlamadas).toContainEqual({ tipo: 'rpc', fn: 'telefono_contraparte', args: { p_viaje: 'v1' } });
    expect(columnasDePerfiles()).toEqual(['nombre']);
  });

  test('pasajero: si la BD no da el teléfono (viaje cerrado o error), queda sin botón «Llamar»', async () => {
    mockRespuestasRpc.telefono_contraparte = { data: null, error: { message: 'permission denied' } };
    const { driver } = await crearLector(new Set()).conductor('v1', 'c1');
    expect(driver.nombre).toBe('Carla');
    expect(driver.telefono).toBeNull();
  });

  test('conductor: ve nombre y teléfono del pasajero de ese viaje, sin pedir la columna', async () => {
    mockRespuestasRpc.telefono_contraparte = { data: '0991111111', error: null };
    const pasajero = await lectorConductor.pasajero('v1', 'p1');
    expect(pasajero).toEqual({ nombre: 'Carla', telefono: '0991111111' });
    expect(mockLlamadas).toContainEqual({ tipo: 'rpc', fn: 'telefono_contraparte', args: { p_viaje: 'v1' } });
    expect(columnasDePerfiles()).toEqual(['nombre']);
  });

  test('textoONulo solo deja pasar un texto con contenido', () => {
    expect(textoONulo('0991111111')).toBe('0991111111');
    expect(textoONulo('  ')).toBeNull();
    expect(textoONulo(null)).toBeNull();
    expect(textoONulo(undefined)).toBeNull();
    expect(textoONulo(991111111)).toBeNull();
  });
});

describe('007 · ninguna lectura de la app pide el teléfono con select', () => {
  const archivos = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) return archivos(ruta);
      return /\.(ts|tsx)$/.test(e.name) ? [ruta] : [];
    });
  const fuentes = [path.join(__dirname, '../src'), path.join(__dirname, '../app')]
    .filter((d) => fs.existsSync(d))
    .flatMap(archivos);

  test('no hay .select(...) con «telefono» en src/ ni app/', () => {
    const conTelefono = fuentes.filter((f) => /\.select\(\s*['"`][^'"`]*telefono/.test(fs.readFileSync(f, 'utf8')));
    expect(conTelefono.map((f) => path.relative(path.join(__dirname, '..'), f))).toEqual([]);
  });

  test('el perfil propio se lee con mi_perfil', () => {
    const auth = fs.readFileSync(path.join(__dirname, '../src/hooks/useSupabaseAuth.ts'), 'utf8');
    expect(auth).toContain("supabase.rpc('mi_perfil')");
    expect(auth).not.toMatch(/from\('perfiles'\)/);
  });
});

import { puedeBuscar } from './texto';

/**
 * Catálogo de lugares (paso 003, D-09). La búsqueda es local en nuestra BD (buscar_lugares):
 * sin API de pago ni descarga de mapa (criterio 18). Datos © OpenStreetMap (ODbL).
 */

export type CategoriaLugar =
  | 'comida' | 'hospedaje' | 'tienda' | 'salud' | 'educacion' | 'religion'
  | 'gobierno' | 'turismo' | 'transporte' | 'poblado' | 'otro';

export interface Lugar {
  id: string;
  nombre: string;
  categoria: CategoriaLugar;
  sector_id: string | null;
  lat: number;
  lng: number;
}

/** Atribución que exige la licencia ODbL donde se muestran resultados (criterio 25). */
export const ATRIBUCION_OSM = '© OpenStreetMap';

/** Ícono de Ionicons por categoría, para reconocer el tipo de lugar de un vistazo. */
export const ICONO_CATEGORIA: Record<CategoriaLugar, string> = {
  comida: 'restaurant',
  hospedaje: 'bed',
  tienda: 'storefront',
  salud: 'medkit',
  educacion: 'school',
  religion: 'heart',
  gobierno: 'shield',
  turismo: 'camera',
  transporte: 'car',
  poblado: 'home',
  otro: 'location',
};

/** Lo mínimo del cliente de Supabase que usa la búsqueda (facilita las pruebas). */
export interface ClienteRpc {
  rpc: (
    fn: 'buscar_lugares',
    args: { q: string }
  ) => PromiseLike<{ data: Lugar[] | null; error: { message: string } | null }>;
}

export const buscarLugares = async (cliente: ClienteRpc, q: string): Promise<Lugar[]> => {
  if (!puedeBuscar(q)) return [];
  const { data, error } = await cliente.rpc('buscar_lugares', { q });
  if (error) throw new Error(error.message);
  return data ?? [];
};

export interface EstadoBusqueda {
  resultados: Lugar[];
  cargando: boolean;
  error: string | null;
  /** El texto ya se buscó (para distinguir "sin resultados" de "aún no busqué"). */
  buscado: boolean;
}

export const ESTADO_INICIAL: EstadoBusqueda = { resultados: [], cargando: false, error: null, buscado: false };

/**
 * Buscador con espera entre teclas y sin respuestas viejas: si el usuario sigue escribiendo,
 * la respuesta de una búsqueda anterior se descarta aunque llegue después.
 */
export const crearBuscadorLugares = ({
  buscar,
  alCambiar,
  esperaMs = 250,
}: {
  buscar: (q: string) => Promise<Lugar[]>;
  alCambiar: (estado: EstadoBusqueda) => void;
  esperaMs?: number;
}) => {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let turno = 0;

  return {
    escribir(q: string) {
      if (temporizador) clearTimeout(temporizador);
      const miTurno = ++turno;
      if (!puedeBuscar(q)) {
        alCambiar(ESTADO_INICIAL);
        return;
      }
      alCambiar({ resultados: [], cargando: true, error: null, buscado: false });
      temporizador = setTimeout(async () => {
        try {
          const resultados = await buscar(q);
          if (miTurno === turno) alCambiar({ resultados, cargando: false, error: null, buscado: true });
        } catch {
          if (miTurno === turno) {
            alCambiar({ resultados: [], cargando: false, error: 'No se pudo buscar. Revisa tu conexión.', buscado: true });
          }
        }
      }, esperaMs);
    },
    cancelar() {
      if (temporizador) clearTimeout(temporizador);
      turno += 1;
    },
  };
};

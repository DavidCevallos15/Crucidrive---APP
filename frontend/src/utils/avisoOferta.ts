import type { OfertaViaje } from './oferta';

/**
 * Avisos de oferta en la app (paso 004, plan P6 a P8). Funciones puras: las usan el
 * manejador de avisos, la tarea de segundo plano, la consola y las pruebas.
 */

/** Lo que manda el backend en `data` (`backend/src/avisos/mensajes.js`). */
export type DatosAviso =
  | { tipo: 'oferta'; viajeId: string; venceEn: number | null }
  | { tipo: 'oferta_retirada'; viajeId: string }
  | { tipo: 'viaje_aceptado'; viajeId: string }
  | { tipo: 'viaje_sin_conductor'; viajeId: string };

const TIPOS = new Set(['oferta', 'oferta_retirada', 'viaje_aceptado', 'viaje_sin_conductor']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const comoObjeto = (valor: unknown): Record<string, unknown> | null => {
  if (typeof valor === 'string') {
    try {
      return comoObjeto(JSON.parse(valor));
    } catch {
      return null;
    }
  }
  return valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : null;
};

/**
 * Interpreta el `data` de un aviso. Según cómo llegue (primer plano, toque o tarea de
 * segundo plano), Expo lo entrega como objeto o como texto JSON en `dataString` o `body`.
 * Cualquier otra cosa se ignora.
 */
export const leerDatosAviso = (crudo: unknown): DatosAviso | null => {
  const objeto = comoObjeto(crudo);
  if (!objeto) return null;
  if (typeof objeto.tipo !== 'string') {
    return leerDatosAviso(objeto.dataString ?? objeto.body ?? null);
  }
  const { tipo, viajeId } = objeto;
  if (!TIPOS.has(tipo) || typeof viajeId !== 'string' || !UUID.test(viajeId)) return null;
  if (tipo === 'oferta') {
    const venceEn = typeof objeto.venceEn === 'number' ? objeto.venceEn : null;
    return { tipo, viajeId, venceEn };
  }
  return { tipo, viajeId } as DatosAviso;
};

/** Lo que sabe la app de la consola del conductor en este momento. */
export interface EstadoConsola {
  /** La consola está en pantalla. */
  abierta: boolean;
  /** Su socket está conectado: el modal de la oferta llega por ahí. */
  conectada: boolean;
}

/**
 * Con la app en primer plano (criterio 9, P6): la oferta no se muestra como aviso si la
 * consola está abierta y conectada, porque ya aparece el modal. Sin conexión sí, porque es
 * el único canal. La retirada nunca se muestra: es un aviso de datos.
 */
export const mostrarEnPrimerPlano = (datos: DatosAviso | null, consola: EstadoConsola): boolean => {
  if (!datos) return true;
  if (datos.tipo === 'oferta_retirada') return false;
  if (datos.tipo === 'oferta') return !(consola.abierta && consola.conectada);
  return true;
};

/** Fila de `ofertas_viaje` con su viaje, como la lee la app (RLS: la propia oferta). */
export interface FilaOferta {
  fase: string;
  vence_en: string;
  distancia_m: number | null;
  resultado: string;
  viaje: {
    id: string;
    estado: string;
    pasajeros: number;
    tarifa: number | string | null;
    sector_origen_id: string | null;
    sector_destino_id: string | null;
    origen_descripcion: string | null;
    destino_descripcion: string | null;
  } | null;
}

/**
 * Al tocar el aviso (criterio 7): la oferta solo se abre si sigue pendiente, sin vencer y
 * con el viaje aún solicitado. Si no, null y la app dice "Esta oferta ya no está disponible".
 * `ahoraServidor` es la hora del teléfono corregida con el desfase (R14 del 003).
 */
export const ofertaDesdeFila = (fila: FilaOferta | null, ahoraServidor: number): OfertaViaje | null => {
  if (!fila || fila.resultado !== 'pendiente' || !fila.viaje || fila.viaje.estado !== 'solicitado') return null;
  const venceEn = new Date(fila.vence_en).getTime();
  if (!Number.isFinite(venceEn) || venceEn <= ahoraServidor) return null;
  const { viaje } = fila;
  return {
    viajeId: viaje.id,
    pasajeros: viaje.pasajeros,
    tarifa: Number(viaje.tarifa ?? 0),
    origen: { sectorId: viaje.sector_origen_id, descripcion: viaje.origen_descripcion },
    destino: { sectorId: viaje.sector_destino_id, descripcion: viaje.destino_descripcion },
    distanciaM: fila.distancia_m,
    fase: fila.fase === 'abierta' ? 'abierta' : 'secuencial',
    venceEn,
  };
};

export const OFERTA_NO_DISPONIBLE = 'Esta oferta ya no está disponible';

/** Adónde lleva tocar un aviso (criterios 7 y 10). */
export type DestinoAviso =
  | { pathname: '/(app)/(driver)'; params: { oferta: string } }
  | { pathname: '/(app)/(passenger)' };

/**
 * La oferta abre la consola con su viaje; los avisos del viaje abren el mapa del pasajero,
 * que ya sincroniza el viaje con la BD al abrirse (R23 del 003). Un aviso que no es para el
 * rol de la cuenta (el teléfono cambió de cuenta) no lleva a ninguna parte.
 */
export const destinoDeAviso = (datos: DatosAviso | null, rol: string | null): DestinoAviso | null => {
  if (!datos) return null;
  if (datos.tipo === 'oferta' && rol === 'conductor') {
    return { pathname: '/(app)/(driver)', params: { oferta: datos.viajeId } };
  }
  if ((datos.tipo === 'viaje_aceptado' || datos.tipo === 'viaje_sin_conductor') && rol === 'pasajero') {
    return { pathname: '/(app)/(passenger)' };
  }
  return null;
};

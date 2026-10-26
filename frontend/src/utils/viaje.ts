import type { ActiveRide, DriverInfo, RideStatus } from '../store/useRideStore';
import { nombreSector } from './solicitud';
import type { EventoViajeEstado } from './viajeConductor';

/**
 * Estado del viaje del pasajero mientras se busca conductor (paso 003, T13). Sin React.
 *
 * Los cambios llegan por socket (plan R12): `viaje_aceptado` y `viaje_sin_conductor`.
 * Si un aviso se pierde (sin señal, app en segundo plano), la app vuelve a leer el viaje de
 * la BD con el JWT del pasajero (RLS) al reconectar y cada cierto tiempo mientras busca.
 */

/** Payload de `viaje_aceptado` (backend: viajeController.aceptarViaje). */
export interface EventoViajeAceptado {
  viajeId: string;
  conductor: {
    id: string;
    nombre: string | null;
    telefono: string | null;
    placa: string | null;
    /** Promedio y reseñas (005, criterio 18); un servidor anterior no lo manda. */
    resenas?: { promedio: number | null; total: number };
  };
  chat: { threadId: string | null };
}

/** Payload de `viaje_sin_conductor` (backend: despachador.avisarCierres). */
export interface EventoViajeSinConductor {
  viajeId: string;
}

/** Un conductor aceptó: el pasajero ve nombre, placa y teléfono (criterio 10). */
export const alAceptarViaje = (ride: ActiveRide | null, ev: EventoViajeAceptado): ActiveRide | null => {
  if (!ride || ride.id !== ev.viajeId) return ride;
  return {
    ...ride,
    status: 'aceptado',
    driver: { ...ev.conductor },
    chatThreadId: ev.chat?.threadId ?? null,
  };
};

/** Nadie aceptó a tiempo (criterio 11). Solo aplica si se seguía buscando. */
export const alQuedarSinConductor = (ride: ActiveRide | null, ev: EventoViajeSinConductor): ActiveRide | null => {
  if (!ride || ride.id !== ev.viajeId || ride.status !== 'solicitado') return ride;
  return { ...ride, status: 'sin_conductor' };
};

/**
 * Cambios que el conductor hace al viaje (paso 005, P7). El pasajero los ve sin recargar; la
 * hora exacta y lo demás se leen después de la BD (`sincronizarViaje`).
 */
export const alCambiarElViaje = (ride: ActiveRide | null, ev: EventoViajeEstado, ahoraIso: string): ActiveRide | null => {
  if (!ride || ride.id !== ev.viajeId) return ride;
  const activo = ride.status === 'aceptado' || ride.status === 'en_curso';
  if (!activo) return ride;
  switch (ev.cambio) {
    case 'llegada':
      return ride.status === 'aceptado' ? { ...ride, llegadoEn: ride.llegadoEn ?? ahoraIso } : ride;
    case 'en_curso':
      return { ...ride, status: 'en_curso' };
    case 'finalizado':
      return { ...ride, status: 'finalizado', cierre: { finalizadoEn: ahoraIso, confirmacion: null } };
    case 'cancelado_por_conductor':
      return { ...ride, status: 'cancelado' };
    default:
      return ride;
  }
};

export type EventoPasajero =
  | { tipo: 'viaje_aceptado'; datos: EventoViajeAceptado }
  | { tipo: 'viaje_sin_conductor'; datos: EventoViajeSinConductor }
  | { tipo: 'viaje_estado'; datos: EventoViajeEstado };

export const aplicarEvento = (ride: ActiveRide | null, evento: EventoPasajero, ahoraIso = new Date().toISOString()): ActiveRide | null => {
  if (evento.tipo === 'viaje_aceptado') return alAceptarViaje(ride, evento.datos);
  if (evento.tipo === 'viaje_estado') return alCambiarElViaje(ride, evento.datos, ahoraIso);
  return alQuedarSinConductor(ride, evento.datos);
};

/**
 * Un aviso puede llegar antes que la respuesta de POST /solicitar (sin candidatos, el
 * despachador cierra al instante). Se guardan los avisos de viajes que aún no se conocen
 * y se aplican cuando el viaje local existe.
 */
export const crearBuzonEventos = (max = 5) => {
  let guardados: EventoPasajero[] = [];
  return {
    /** Aplica el aviso si es del viaje local; si no, lo guarda. */
    recibir(ride: ActiveRide | null, evento: EventoPasajero): ActiveRide | null {
      if (ride && ride.id === evento.datos.viajeId) return aplicarEvento(ride, evento);
      guardados = [...guardados, evento].slice(-max);
      return ride;
    },
    /** Aplica los avisos guardados del viaje recién creado. */
    aplicarGuardados(ride: ActiveRide | null): ActiveRide | null {
      if (!ride) return ride;
      const propios = guardados.filter((e) => e.datos.viajeId === ride.id);
      guardados = guardados.filter((e) => e.datos.viajeId !== ride.id);
      return propios.reduce<ActiveRide | null>((actual, evento) => aplicarEvento(actual, evento), ride);
    },
  };
};

// ─── Sincronización con la BD ────────────────────────────────

export const ESTADOS_ACTIVOS = ['solicitado', 'aceptado', 'en_curso'] as const;

/** Columnas de `viajes` que lee la app del pasajero. */
export const COLUMNAS_VIAJE =
  'id, estado, tipo_servicio, conductor_id, pasajeros, tarifa, sector_origen_id, sector_destino_id, origen_descripcion, destino_descripcion, creado_en, llegado_en, cancelado_por, finalizado_por, finalizado_en, confirmacion_pasajero';

export interface FilaViaje {
  tipo_servicio?: 'viaje' | 'encomienda';
  id: string;
  estado: RideStatus;
  conductor_id: string | null;
  pasajeros: number;
  tarifa: number | string | null;
  sector_origen_id: string | null;
  sector_destino_id: string | null;
  origen_descripcion: string | null;
  destino_descripcion: string | null;
  creado_en: string;
  // Paso 005 (0017). Opcionales: una fila anterior a la migración no las trae.
  llegado_en?: string | null;
  cancelado_por?: 'pasajero' | 'conductor' | null;
  finalizado_por?: 'conductor' | 'pasajero' | null;
  finalizado_en?: string | null;
  confirmacion_pasajero?: 'llego' | 'no_llego' | null;
}

/** Lecturas que necesita la sincronización (la implementación usa supabase-js con RLS). */
export interface LectorViaje {
  viaje: (id: string) => Promise<FilaViaje | null>;
  viajeActivo: (pasajeroId: string) => Promise<FilaViaje | null>;
  conductor: (viajeId: string, conductorId: string) => Promise<{ driver: DriverInfo; threadId: string | null }>;
  /**
   * Último viaje que el conductor terminó y al que aún le falta confirmar o calificar
   * (criterio 15: se ofrece otra vez al abrir la app). Quien lo implementa decide, con lo
   * guardado en el teléfono, si todavía toca ofrecerlo.
   */
  pendienteDeCerrar?: (pasajeroId: string) => Promise<FilaViaje | null>;
}

const desdeFila = (fila: FilaViaje): ActiveRide => ({
  serviceType: fila.tipo_servicio ?? 'viaje',
  id: fila.id,
  status: fila.estado,
  originSectorId: fila.sector_origen_id ?? '',
  originName: fila.origen_descripcion || nombreSector(fila.sector_origen_id),
  destinationSectorId: fila.sector_destino_id ?? '',
  destinationName: fila.destino_descripcion || nombreSector(fila.sector_destino_id),
  passengers: fila.pasajeros,
  price: fila.tipo_servicio === 'encomienda' ? null : Number(fila.tarifa ?? 0),
  destinationNote: '',
  driver: null,
  chatThreadId: null,
  createdAt: fila.creado_en,
  llegadoEn: fila.llegado_en ?? null,
});

/** Lo que falta por cerrar de un viaje que el conductor terminó (criterios 5a y 15). */
const cierreDeFila = (fila: FilaViaje): ActiveRide['cierre'] => ({
  finalizadoEn: fila.finalizado_en ?? fila.creado_en,
  confirmacion: fila.confirmacion_pasajero ?? null,
});

/**
 * Lee el viaje y devuelve cómo debe quedar el estado local.
 * - Con un viaje local, se lee ese viaje; sin él, el último viaje activo del pasajero
 *   (por ejemplo, si cerró la app mientras buscaba conductor).
 * - Un viaje cerrado (finalizado o cancelado) limpia el estado; `sin_conductor` solo se
 *   muestra si el pasajero estaba esperando ese viaje.
 * - Si la lectura falla, lanza el error: quien llama conserva el estado local.
 */
export const sincronizarViaje = async (
  lector: LectorViaje,
  local: ActiveRide | null,
  pasajeroId: string
): Promise<ActiveRide | null> => {
  const fila = local ? await lector.viaje(local.id) : await lector.viajeActivo(pasajeroId);
  if (!fila) return local ? null : pendienteDeCerrar(lector, pasajeroId);

  if (fila.estado === 'cancelado') {
    // Solo se muestra si el conductor canceló un viaje que el pasajero tenía a la vista (011).
    const loCancelaronAEl = fila.cancelado_por === 'conductor' && local !== null
      && (local.status === 'aceptado' || local.status === 'en_curso' || local.status === 'cancelado');
    return loCancelaronAEl ? { ...local, status: 'cancelado' } : null;
  }
  if (fila.estado === 'finalizado') {
    // Terminado por el pasajero: ya vio su aviso y no confirma ni califica (criterio 5b).
    if (fila.finalizado_por !== 'conductor') return null;
    const base = local ?? desdeFila(fila);
    // «No llegué» queda registrado y no se califica (criterio 5a).
    if (fila.confirmacion_pasajero === 'no_llego') return null;
    return { ...await conDatosDelConductor(lector, base, fila), status: 'finalizado', cierre: cierreDeFila(fila) };
  }
  if (fila.estado === 'sin_conductor') return local ? { ...local, status: 'sin_conductor' } : null;

  const base = local ?? desdeFila(fila);
  if (fila.estado === 'solicitado') return { ...base, status: 'solicitado' };

  // aceptado o en_curso: hacen falta los datos del conductor (criterio 10).
  const conLlegada = { ...base, llegadoEn: fila.llegado_en ?? null };
  if (!fila.conductor_id) return { ...conLlegada, status: fila.estado };
  return { ...await conDatosDelConductor(lector, conLlegada, fila), status: fila.estado };
};

/** Lee al conductor solo si aún no se conoce (o si cambió). */
const conDatosDelConductor = async (lector: LectorViaje, base: ActiveRide, fila: FilaViaje): Promise<ActiveRide> => {
  if (!fila.conductor_id) return base;
  if (base.driver && base.driver.id === fila.conductor_id) return base;
  const { driver, threadId } = await lector.conductor(fila.id, fila.conductor_id);
  return { ...base, driver, chatThreadId: threadId };
};

/** Al abrir la app sin viaje a la vista: el último terminado que falta confirmar o calificar. */
const pendienteDeCerrar = async (lector: LectorViaje, pasajeroId: string): Promise<ActiveRide | null> => {
  const fila = await lector.pendienteDeCerrar?.(pasajeroId);
  if (!fila || fila.estado !== 'finalizado' || fila.finalizado_por !== 'conductor' || fila.confirmacion_pasajero === 'no_llego') return null;
  const base = await conDatosDelConductor(lector, desdeFila(fila), fila);
  return { ...base, status: 'finalizado', cierre: cierreDeFila(fila) };
};

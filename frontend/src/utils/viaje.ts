import type { ActiveRide, DriverInfo, RideStatus } from '../store/useRideStore';
import { nombreSector } from './solicitud';

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
  conductor: { id: string; nombre: string | null; telefono: string | null; placa: string | null };
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

export type EventoPasajero =
  | { tipo: 'viaje_aceptado'; datos: EventoViajeAceptado }
  | { tipo: 'viaje_sin_conductor'; datos: EventoViajeSinConductor };

export const aplicarEvento = (ride: ActiveRide | null, evento: EventoPasajero): ActiveRide | null =>
  evento.tipo === 'viaje_aceptado' ? alAceptarViaje(ride, evento.datos) : alQuedarSinConductor(ride, evento.datos);

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
      return propios.reduce<ActiveRide | null>(aplicarEvento, ride);
    },
  };
};

// ─── Sincronización con la BD ────────────────────────────────

export const ESTADOS_ACTIVOS = ['solicitado', 'aceptado', 'en_curso'] as const;

/** Columnas de `viajes` que lee la app del pasajero. */
export const COLUMNAS_VIAJE =
  'id, estado, conductor_id, pasajeros, tarifa, sector_origen_id, sector_destino_id, origen_descripcion, destino_descripcion, creado_en';

export interface FilaViaje {
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
}

/** Lecturas que necesita la sincronización (la implementación usa supabase-js con RLS). */
export interface LectorViaje {
  viaje: (id: string) => Promise<FilaViaje | null>;
  viajeActivo: (pasajeroId: string) => Promise<FilaViaje | null>;
  conductor: (viajeId: string, conductorId: string) => Promise<{ driver: DriverInfo; threadId: string | null }>;
}

const desdeFila = (fila: FilaViaje): ActiveRide => ({
  id: fila.id,
  status: fila.estado,
  originSectorId: fila.sector_origen_id ?? '',
  originName: fila.origen_descripcion || nombreSector(fila.sector_origen_id),
  destinationSectorId: fila.sector_destino_id ?? '',
  destinationName: fila.destino_descripcion || nombreSector(fila.sector_destino_id),
  passengers: fila.pasajeros,
  price: Number(fila.tarifa ?? 0),
  destinationNote: '',
  driver: null,
  chatThreadId: null,
  createdAt: fila.creado_en,
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
  if (!fila) return null;

  if (fila.estado === 'finalizado' || fila.estado === 'cancelado') return null;
  if (fila.estado === 'sin_conductor') return local ? { ...local, status: 'sin_conductor' } : null;

  const base = local ?? desdeFila(fila);
  if (fila.estado === 'solicitado') return { ...base, status: 'solicitado' };

  // aceptado o en_curso: hacen falta los datos del conductor (criterio 10).
  if (base.driver && base.driver.id === fila.conductor_id) return { ...base, status: fila.estado };
  if (!fila.conductor_id) return { ...base, status: fila.estado };
  const { driver, threadId } = await lector.conductor(fila.id, fila.conductor_id);
  return { ...base, status: fila.estado, driver, chatThreadId: threadId };
};

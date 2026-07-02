import { create } from 'zustand';

/**
 * Estados posibles de un viaje en el ciclo de vida completo.
 */
export type RideStatus =
  | 'idle'
  | 'solicitado'
  | 'aceptado'
  | 'en_curso'
  | 'finalizado'
  | 'cancelado';

/**
 * Información del conductor asignado al viaje.
 */
export interface DriverInfo {
  id: string;
  nombre: string;
  telefono: string;
  placa: string;
  calificacion: number;
  avatar_url?: string;
}

/**
 * Datos completos de un viaje activo.
 */
export interface ActiveRide {
  /** ID del viaje en la base de datos */
  id: string;
  /** Estado actual del viaje */
  status: RideStatus;
  /** Sector de origen */
  originSectorId: string;
  /** Nombre del sector de origen */
  originName: string;
  /** Sector de destino */
  destinationSectorId: string;
  /** Nombre del sector de destino */
  destinationName: string;
  /** Tarifa fija en USD */
  price: number;
  /** Distancia estimada en km */
  estimatedDistanceKm: number;
  /** Tiempo estimado en minutos */
  estimatedTimeMin: number;
  /** Datos del conductor asignado (null si aún no se ha aceptado) */
  driver: DriverInfo | null;
  /** ID del thread de chat asociado */
  chatThreadId: string | null;
  /** Timestamp de creación */
  createdAt: string;
}

/**
 * Estado global del viaje.
 */
interface RideState {
  /** Viaje activo actual (null si no hay viaje en curso) */
  activeRide: ActiveRide | null;
  /** Indica si se está procesando una solicitud */
  isRequesting: boolean;

  // ─── Acciones ──────────────────────────────────────────────
  /** Establece el viaje activo completo */
  setActiveRide: (ride: ActiveRide | null) => void;
  /** Actualiza parcialmente el viaje activo */
  updateRide: (updates: Partial<ActiveRide>) => void;
  /** Actualiza solo el estado del viaje */
  setRideStatus: (status: RideStatus) => void;
  /** Asigna conductor al viaje */
  setDriver: (driver: DriverInfo) => void;
  /** Marca como solicitando */
  setRequesting: (requesting: boolean) => void;
  /** Limpia el viaje activo */
  clearRide: () => void;
}

/**
 * Store global de viaje usando Zustand.
 *
 * Gestiona el ciclo de vida completo de un viaje:
 * idle → solicitado → aceptado → en_curso → finalizado/cancelado.
 */
export const useRideStore = create<RideState>((set) => ({
  activeRide: null,
  isRequesting: false,

  setActiveRide: (activeRide) => set({ activeRide }),

  updateRide: (updates) =>
    set((state) => ({
      activeRide: state.activeRide
        ? { ...state.activeRide, ...updates }
        : null,
    })),

  setRideStatus: (status) =>
    set((state) => ({
      activeRide: state.activeRide
        ? { ...state.activeRide, status }
        : null,
    })),

  setDriver: (driver) =>
    set((state) => ({
      activeRide: state.activeRide
        ? { ...state.activeRide, driver, status: 'aceptado' }
        : null,
    })),

  setRequesting: (isRequesting) => set({ isRequesting }),

  clearRide: () => set({ activeRide: null, isRequesting: false }),
}));

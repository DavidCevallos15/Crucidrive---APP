import { create } from 'zustand';
import type { Solicitud } from '../utils/solicitud';

/**
 * Estados posibles de un viaje en el ciclo de vida completo.
 */
export type RideStatus =
  | 'idle'
  | 'solicitado'
  | 'aceptado'
  | 'en_curso'
  | 'finalizado'
  | 'cancelado'
  /** Nadie aceptó a tiempo (paso 003, criterio 11). */
  | 'sin_conductor';

/**
 * Información del conductor asignado al viaje.
 */
export interface DriverInfo {
  id: string;
  nombre: string | null;
  telefono: string | null;
  placa: string | null;
  /** Aún no existe (calificaciones: paso 005). */
  calificacion?: number;
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
  /** Número de pasajeros */
  passengers: number;
  /** Total en USD (0,50 por persona; lo fija el servidor) */
  price: number;
  /** Referencia de texto libre del destino (opcional) */
  destinationNote: string;
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
  /** Última solicitud enviada, para "Volver a pedir" sin rellenar de nuevo (paso 003, criterio 11) */
  ultimaSolicitud: Solicitud | null;

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
  /** Guarda la solicitud enviada */
  setUltimaSolicitud: (solicitud: Solicitud | null) => void;
  /** Limpia el viaje activo (conserva la última solicitud) */
  clearRide: () => void;
}

/**
 * Store global de viaje usando Zustand.
 *
 * Gestiona el ciclo de vida completo de un viaje:
 * idle → solicitado → aceptado → en_curso → finalizado/cancelado,
 * o solicitado → sin_conductor / cancelado mientras se busca conductor (paso 003).
 */
export const useRideStore = create<RideState>((set) => ({
  activeRide: null,
  isRequesting: false,
  ultimaSolicitud: null,

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

  setUltimaSolicitud: (ultimaSolicitud) => set({ ultimaSolicitud }),

  clearRide: () => set({ activeRide: null, isRequesting: false }),
}));

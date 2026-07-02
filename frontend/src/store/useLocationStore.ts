import { create } from 'zustand';

/**
 * Coordenadas geográficas simples.
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Información de un conductor cercano visible en el mapa.
 */
export interface NearbyDriver {
  /** ID del conductor */
  conductorId: string;
  /** Nombre del conductor */
  nombre: string;
  /** Coordenadas actuales */
  coords: Coordinates;
  /** Estado operativo */
  estado: 'disponible' | 'ocupado' | 'inactivo';
  /** Timestamp de la última actualización */
  lastUpdate: number;
}

/**
 * Estado global de geolocalización.
 */
interface LocationState {
  /** Coordenadas actuales del usuario */
  userCoords: Coordinates | null;
  /** ID del sector actual del usuario */
  currentSectorId: string | null;
  /** Mapa de conductores cercanos por ID */
  nearbyDrivers: Map<string, NearbyDriver>;
  /** Indica si los permisos de ubicación están concedidos */
  hasPermission: boolean;
  /** Indica si el GPS está activo */
  isTracking: boolean;

  // ─── Acciones ──────────────────────────────────────────────
  /** Actualiza las coordenadas del usuario */
  setUserCoords: (coords: Coordinates) => void;
  /** Establece el sector actual */
  setCurrentSector: (sectorId: string) => void;
  /** Actualiza o agrega un conductor cercano */
  updateNearbyDriver: (driver: NearbyDriver) => void;
  /** Elimina un conductor del mapa de cercanos */
  removeNearbyDriver: (conductorId: string) => void;
  /** Limpia todos los conductores cercanos */
  clearNearbyDrivers: () => void;
  /** Establece el estado del permiso GPS */
  setPermission: (hasPermission: boolean) => void;
  /** Establece el estado de tracking */
  setTracking: (isTracking: boolean) => void;
}

/**
 * Store global de geolocalización usando Zustand.
 *
 * Gestiona las coordenadas del usuario, los conductores cercanos
 * visibles en el mapa y el estado de permisos/tracking GPS.
 */
export const useLocationStore = create<LocationState>((set) => ({
  userCoords: null,
  currentSectorId: null,
  nearbyDrivers: new Map(),
  hasPermission: false,
  isTracking: false,

  setUserCoords: (userCoords) => set({ userCoords }),

  setCurrentSector: (currentSectorId) => set({ currentSectorId }),

  updateNearbyDriver: (driver) =>
    set((state) => {
      const updatedMap = new Map(state.nearbyDrivers);
      updatedMap.set(driver.conductorId, {
        ...driver,
        lastUpdate: Date.now(),
      });
      return { nearbyDrivers: updatedMap };
    }),

  removeNearbyDriver: (conductorId) =>
    set((state) => {
      const updatedMap = new Map(state.nearbyDrivers);
      updatedMap.delete(conductorId);
      return { nearbyDrivers: updatedMap };
    }),

  clearNearbyDrivers: () =>
    set({ nearbyDrivers: new Map() }),

  setPermission: (hasPermission) => set({ hasPermission }),

  setTracking: (isTracking) => set({ isTracking }),
}));

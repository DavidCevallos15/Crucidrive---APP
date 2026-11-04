import { create } from 'zustand';

/**
 * Coordenadas geográficas simples.
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Una tricimoto que deja de actualizarse durante este tiempo sale del mapa (007, criterio 4).
 * Es la ventana de frescura del despacho (D-13): pasado ese tiempo ya no recibiría ofertas.
 */
export const CADUCIDAD_CONDUCTOR_MS = 60_000;

/**
 * Tricimoto disponible en el mapa del sector. No trae quién es (007, criterio 3; D-18):
 * solo un marcador que cambia cada día y coordenadas redondeadas a ~110 m.
 */
export interface NearbyDriver {
  /** Marcador efímero del día: identifica el punto en el mapa, no a la persona */
  marcador: string;
  /** Coordenadas aproximadas (3 decimales) */
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
  /** Tricimotos cercanas por marcador */
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
  /** Elimina una tricimoto del mapa por su marcador */
  removeNearbyDriver: (marcador: string) => void;
  /** Quita las tricimotos sin actualizar en `maxEdadMs` (007, criterio 4) */
  podarConductores: (ahora: number, maxEdadMs?: number) => void;
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
      // Sin marcador (un backend viejo) no se dibuja: evita una tricimoto fantasma sin clave.
      if (!driver.marcador) return {};
      const updatedMap = new Map(state.nearbyDrivers);
      updatedMap.set(driver.marcador, {
        ...driver,
        lastUpdate: Date.now(),
      });
      return { nearbyDrivers: updatedMap };
    }),

  removeNearbyDriver: (marcador) =>
    set((state) => {
      const updatedMap = new Map(state.nearbyDrivers);
      updatedMap.delete(marcador);
      return { nearbyDrivers: updatedMap };
    }),

  podarConductores: (ahora, maxEdadMs = CADUCIDAD_CONDUCTOR_MS) =>
    set((state) => {
      const vigentes = new Map(
        [...state.nearbyDrivers].filter(([, d]) => ahora - d.lastUpdate < maxEdadMs)
      );
      // Sin cambios no se crea un Map nuevo: el mapa no se vuelve a dibujar cada 10 s.
      return vigentes.size === state.nearbyDrivers.size ? {} : { nearbyDrivers: vigentes };
    }),

  clearNearbyDrivers: () =>
    set({ nearbyDrivers: new Map() }),

  setPermission: (hasPermission) => set({ hasPermission }),

  setTracking: (isTracking) => set({ isTracking }),
}));

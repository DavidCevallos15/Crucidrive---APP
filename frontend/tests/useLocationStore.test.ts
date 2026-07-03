import { useLocationStore } from '../src/store/useLocationStore';
import type { NearbyDriver } from '../src/store/useLocationStore';

describe('useLocationStore', () => {
  beforeEach(() => {
    useLocationStore.setState({
      userCoords: null,
      currentSectorId: null,
      nearbyDrivers: new Map(),
      hasPermission: false,
      isTracking: false,
    });
  });

  const mockDriver: NearbyDriver = {
    conductorId: 'driver-1',
    nombre: 'Carlos',
    coords: { lat: -1.0448, lng: -80.5432 },
    estado: 'disponible',
    lastUpdate: Date.now(),
  };

  describe('initial state', () => {
    it('should have null userCoords', () => {
      expect(useLocationStore.getState().userCoords).toBeNull();
    });

    it('should have null currentSectorId', () => {
      expect(useLocationStore.getState().currentSectorId).toBeNull();
    });

    it('should have empty nearbyDrivers map', () => {
      expect(useLocationStore.getState().nearbyDrivers.size).toBe(0);
    });

    it('should have hasPermission as false', () => {
      expect(useLocationStore.getState().hasPermission).toBe(false);
    });

    it('should have isTracking as false', () => {
      expect(useLocationStore.getState().isTracking).toBe(false);
    });
  });

  describe('setUserCoords', () => {
    it('should set user coordinates', () => {
      const coords = { lat: -1.0448, lng: -80.5432 };
      useLocationStore.getState().setUserCoords(coords);
      expect(useLocationStore.getState().userCoords).toEqual(coords);
    });
  });

  describe('setCurrentSector', () => {
    it('should set the current sector ID', () => {
      useLocationStore.getState().setCurrentSector('centro');
      expect(useLocationStore.getState().currentSectorId).toBe('centro');
    });
  });

  describe('updateNearbyDriver', () => {
    it('should add a new driver to the map', () => {
      useLocationStore.getState().updateNearbyDriver(mockDriver);

      const drivers = useLocationStore.getState().nearbyDrivers;
      expect(drivers.size).toBe(1);
      expect(drivers.get('driver-1')).toBeDefined();
      expect(drivers.get('driver-1')!.nombre).toBe('Carlos');
    });

    it('should update an existing driver', () => {
      useLocationStore.getState().updateNearbyDriver(mockDriver);
      useLocationStore.getState().updateNearbyDriver({
        ...mockDriver,
        coords: { lat: -1.05, lng: -80.55 },
        estado: 'ocupado',
      });

      const drivers = useLocationStore.getState().nearbyDrivers;
      expect(drivers.size).toBe(1);
      expect(drivers.get('driver-1')!.estado).toBe('ocupado');
      expect(drivers.get('driver-1')!.coords.lat).toBe(-1.05);
    });

    it('should add multiple drivers', () => {
      useLocationStore.getState().updateNearbyDriver(mockDriver);
      useLocationStore.getState().updateNearbyDriver({
        conductorId: 'driver-2',
        nombre: 'Pedro',
        coords: { lat: -1.05, lng: -80.54 },
        estado: 'disponible',
        lastUpdate: Date.now(),
      });

      expect(useLocationStore.getState().nearbyDrivers.size).toBe(2);
    });

    it('should set lastUpdate timestamp', () => {
      const before = Date.now();
      useLocationStore.getState().updateNearbyDriver(mockDriver);
      const after = Date.now();

      const driver = useLocationStore.getState().nearbyDrivers.get('driver-1');
      expect(driver!.lastUpdate).toBeGreaterThanOrEqual(before);
      expect(driver!.lastUpdate).toBeLessThanOrEqual(after);
    });
  });

  describe('removeNearbyDriver', () => {
    it('should remove a driver from the map', () => {
      useLocationStore.getState().updateNearbyDriver(mockDriver);
      useLocationStore.getState().removeNearbyDriver('driver-1');

      expect(useLocationStore.getState().nearbyDrivers.size).toBe(0);
    });

    it('should not fail when removing non-existent driver', () => {
      useLocationStore.getState().removeNearbyDriver('nonexistent');
      expect(useLocationStore.getState().nearbyDrivers.size).toBe(0);
    });
  });

  describe('clearNearbyDrivers', () => {
    it('should clear all nearby drivers', () => {
      useLocationStore.getState().updateNearbyDriver(mockDriver);
      useLocationStore.getState().updateNearbyDriver({
        conductorId: 'driver-2',
        nombre: 'Pedro',
        coords: { lat: -1.05, lng: -80.54 },
        estado: 'disponible',
        lastUpdate: Date.now(),
      });

      useLocationStore.getState().clearNearbyDrivers();
      expect(useLocationStore.getState().nearbyDrivers.size).toBe(0);
    });
  });

  describe('setPermission', () => {
    it('should set hasPermission to true', () => {
      useLocationStore.getState().setPermission(true);
      expect(useLocationStore.getState().hasPermission).toBe(true);
    });

    it('should set hasPermission to false', () => {
      useLocationStore.getState().setPermission(true);
      useLocationStore.getState().setPermission(false);
      expect(useLocationStore.getState().hasPermission).toBe(false);
    });
  });

  describe('setTracking', () => {
    it('should set isTracking to true', () => {
      useLocationStore.getState().setTracking(true);
      expect(useLocationStore.getState().isTracking).toBe(true);
    });

    it('should set isTracking to false', () => {
      useLocationStore.getState().setTracking(true);
      useLocationStore.getState().setTracking(false);
      expect(useLocationStore.getState().isTracking).toBe(false);
    });
  });
});

import { useRideStore } from '../src/store/useRideStore';
import type { ActiveRide, DriverInfo } from '../src/store/useRideStore';

describe('useRideStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useRideStore.setState({
      activeRide: null,
      isRequesting: false,
    });
  });

  const mockRide: ActiveRide = {
    id: 'ride-1',
    status: 'solicitado',
    originSectorId: 'centro',
    originName: 'Centro de Crucita',
    destinationSectorId: 'playa',
    destinationName: 'Malecón / Playa',
    passengers: 3,
    price: 1.50,
    destinationNote: '',
    driver: null,
    chatThreadId: null,
    createdAt: '2024-01-01T00:00:00Z',
  };

  const mockDriver: DriverInfo = {
    id: 'driver-1',
    nombre: 'Carlos',
    telefono: '0999999999',
    placa: 'ABC-123',
    calificacion: 4.8,
  };

  describe('initial state', () => {
    it('should have null activeRide', () => {
      expect(useRideStore.getState().activeRide).toBeNull();
    });

    it('should have isRequesting as false', () => {
      expect(useRideStore.getState().isRequesting).toBe(false);
    });
  });

  describe('setActiveRide', () => {
    it('should set the active ride', () => {
      useRideStore.getState().setActiveRide(mockRide);
      expect(useRideStore.getState().activeRide).toEqual(mockRide);
    });

    it('should set active ride to null', () => {
      useRideStore.getState().setActiveRide(mockRide);
      useRideStore.getState().setActiveRide(null);
      expect(useRideStore.getState().activeRide).toBeNull();
    });
  });

  describe('updateRide', () => {
    it('should partially update the active ride', () => {
      useRideStore.getState().setActiveRide(mockRide);
      useRideStore.getState().updateRide({ price: 2.00, status: 'aceptado' });

      const state = useRideStore.getState();
      expect(state.activeRide!.price).toBe(2.00);
      expect(state.activeRide!.status).toBe('aceptado');
      expect(state.activeRide!.originSectorId).toBe('centro');
    });

    it('should do nothing if activeRide is null', () => {
      useRideStore.getState().updateRide({ price: 2.00 });
      expect(useRideStore.getState().activeRide).toBeNull();
    });
  });

  describe('setRideStatus', () => {
    it('should update the ride status', () => {
      useRideStore.getState().setActiveRide(mockRide);
      useRideStore.getState().setRideStatus('aceptado');
      expect(useRideStore.getState().activeRide!.status).toBe('aceptado');
    });

    it('should do nothing if activeRide is null', () => {
      useRideStore.getState().setRideStatus('aceptado');
      expect(useRideStore.getState().activeRide).toBeNull();
    });

    it('should transition through all valid states', () => {
      useRideStore.getState().setActiveRide(mockRide);

      useRideStore.getState().setRideStatus('aceptado');
      expect(useRideStore.getState().activeRide!.status).toBe('aceptado');

      useRideStore.getState().setRideStatus('en_curso');
      expect(useRideStore.getState().activeRide!.status).toBe('en_curso');

      useRideStore.getState().setRideStatus('finalizado');
      expect(useRideStore.getState().activeRide!.status).toBe('finalizado');
    });
  });

  describe('setDriver', () => {
    it('should set the driver and change status to aceptado', () => {
      useRideStore.getState().setActiveRide(mockRide);
      useRideStore.getState().setDriver(mockDriver);

      const state = useRideStore.getState();
      expect(state.activeRide!.driver).toEqual(mockDriver);
      expect(state.activeRide!.status).toBe('aceptado');
    });

    it('should do nothing if activeRide is null', () => {
      useRideStore.getState().setDriver(mockDriver);
      expect(useRideStore.getState().activeRide).toBeNull();
    });
  });

  describe('setRequesting', () => {
    it('should set isRequesting to true', () => {
      useRideStore.getState().setRequesting(true);
      expect(useRideStore.getState().isRequesting).toBe(true);
    });

    it('should set isRequesting to false', () => {
      useRideStore.getState().setRequesting(true);
      useRideStore.getState().setRequesting(false);
      expect(useRideStore.getState().isRequesting).toBe(false);
    });
  });

  describe('clearRide', () => {
    it('should clear the active ride and reset isRequesting', () => {
      useRideStore.getState().setActiveRide(mockRide);
      useRideStore.getState().setRequesting(true);
      useRideStore.getState().clearRide();

      const state = useRideStore.getState();
      expect(state.activeRide).toBeNull();
      expect(state.isRequesting).toBe(false);
    });
  });
});

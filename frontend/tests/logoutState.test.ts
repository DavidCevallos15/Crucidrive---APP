import { useAuthStore } from '../src/store/useAuthStore';
import { useRideStore } from '../src/store/useRideStore';
import { useLocationStore } from '../src/store/useLocationStore';

beforeEach(() => {
  useAuthStore.getState().clearSession();
  useAuthStore.getState().endSignOut(null);
});

it.each(['salir', 'cambiar de cuenta'])('%s limpia viaje, chat, última referencia y conductores de la cuenta anterior', (accion) => {
  useAuthStore.getState().setSession({ user: { id: 'A' } } as any);
  useRideStore.setState({ activeRide: { id: 'viaje-A', chatThreadId: 'chat-A' } as any, ultimaSolicitud: { destinoNota: 'domicilio-A' } as any, isRequesting: true });
  useLocationStore.getState().updateNearbyDriver({ conductorId: 'conductor-A' } as any);
  if (accion === 'salir') useAuthStore.getState().clearSession();
  else useAuthStore.getState().setSession({ user: { id: 'B' } } as any);
  expect(useRideStore.getState()).toMatchObject({ activeRide: null, ultimaSolicitud: null, isRequesting: false });
  expect(useLocationStore.getState().nearbyDrivers.size).toBe(0);
});

it('dos pantallas comparten una única salida y el mismo estado de error/reintento', () => {
  const menu = useAuthStore.getState();
  const perfil = useAuthStore.getState();
  expect(menu.beginSignOut()).toBe(true);
  expect(perfil.beginSignOut()).toBe(false);
  expect(useAuthStore.getState().isSigningOut).toBe(true);
  menu.endSignOut('Reintenta');
  expect(useAuthStore.getState()).toMatchObject({ isSigningOut: false, isLoading: false, logoutError: 'Reintenta' });
  expect(perfil.beginSignOut()).toBe(true);
  expect(useAuthStore.getState().logoutError).toBeNull();
});

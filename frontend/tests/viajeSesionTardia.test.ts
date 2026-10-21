// Se ejercitan las acciones reales de ambos hooks. El arnés omite efectos y render,
// pero conserva los stores y las promesas: la red termina después del logout.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: jest.fn((initial: any) => [typeof initial === 'function' ? initial() : initial, jest.fn()]),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useDebugValue: () => {},
}));
jest.mock('../src/utils/supabaseClient', () => ({ supabase: {} }));
jest.mock('../src/utils/authFetch', () => ({ authFetch: jest.fn() }));
jest.mock('../src/constants/config', () => ({ API_CONFIG: { endpoints: { rides: {
  request: '/solicitar', updateStatus: () => '/estado', llegada: () => '/llegada',
  iniciar: () => '/iniciar', terminar: () => '/terminar', cancelar: () => '/cancelar',
} } } }));

import { useState } from 'react';
import { useViajePasajero } from '../src/hooks/useViajePasajero';
import { useViajeConductor } from '../src/hooks/useViajeConductor';
import { useAuthStore } from '../src/store/useAuthStore';
import { useRideStore } from '../src/store/useRideStore';
import { authFetch } from '../src/utils/authFetch';
import { SECTORS } from '../src/constants/sectors';

const socket = { isConnected: false, onEvent: jest.fn() };
const entrar = (id: string) => useAuthStore.getState().setSession({ user: { id } } as any);

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.getState().clearSession();
  entrar('A');
});

it.each(['solicitar', 'cancelar pasajero', 'llegada', 'terminar', 'cancelar conductor'].flatMap(
  (operacion) => ['salir', 'cambiar', 'volver a A'].map((cambio) => [operacion, cambio]),
))('%s pendiente → %s → descarta resultado y finally antiguos', async (operacion, cambio) => {
  let resolver!: (response: Response) => void;
  jest.mocked(authFetch).mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
  const alCerrar = jest.fn();
  let pendiente: Promise<unknown>;
  if (operacion === 'solicitar' || operacion === 'cancelar pasajero') {
    useRideStore.setState({ activeRide: { id: 'viaje-A' } as any });
    const acciones = useViajePasajero(socket);
    pendiente = operacion === 'solicitar' ? acciones.solicitar({
      origen: { tipo: 'sector', sectorId: SECTORS[0].id }, destino: { tipo: 'sector', sectorId: SECTORS[1].id },
      origenNota: 'domicilio-A', destinoNota: '', pasajeros: 1,
    }) : acciones.cancelar();
  } else {
    (useState as jest.Mock).mockImplementationOnce(() => [{ id: 'viaje-A', estado: 'aceptado' }, jest.fn()]);
    const acciones = useViajeConductor(socket, 'ocupado', alCerrar);
    pendiente = operacion === 'cancelar conductor' ? acciones.cancelar('otro') : acciones.darPaso(operacion as 'llegada' | 'terminar');
  }
  useAuthStore.getState().clearSession();
  if (cambio !== 'salir') {
    entrar(cambio === 'volver a A' ? 'A' : 'B');
    useRideStore.setState({ activeRide: { id: 'viaje-nuevo' } as any, isRequesting: true });
  }
  const esperado = useRideStore.getState();
  resolver(new Response(JSON.stringify({ data: { id: 'viaje-A' } }), { status: 200 }));
  await expect(pendiente).resolves.toMatchObject({ ok: false });
  expect(useRideStore.getState()).toBe(esperado);
  expect(alCerrar).not.toHaveBeenCalled();
});

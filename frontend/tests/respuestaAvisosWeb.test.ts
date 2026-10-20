/**
 * Paso 004: en la web no hay avisos push. La versión web del hook no debe tocar
 * expo-notifications (su `useLastNotificationResponse` lanza en web y rompía el layout raíz).
 */
jest.mock('expo-notifications', () => {
  throw new Error('La versión web no debe importar expo-notifications');
}, { virtual: true });

import { useRespuestaAvisos } from '../src/hooks/useRespuestaAvisos.web';

describe('useRespuestaAvisos (web)', () => {
  it('no hace nada y no importa expo-notifications', () => {
    expect(() => useRespuestaAvisos('pasajero')).not.toThrow();
    expect(() => useRespuestaAvisos(null)).not.toThrow();
  });
});

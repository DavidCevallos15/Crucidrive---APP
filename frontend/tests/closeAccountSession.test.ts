import { closeAccountSession } from '../src/utils/closeAccountSession';

function actions() {
  return {
    stopTracking: jest.fn(async () => undefined),
    forgetDevice: jest.fn(async () => undefined),
    revoke: jest.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
    clearSession: jest.fn(),
  };
}

describe('cierre de sesión confirmado', () => {
  it('un fallo al apagar GPS no impide intentar revocar las credenciales', async () => {
    const a = actions();
    a.stopTracking.mockRejectedValue(new Error('GPS'));
    expect(await closeAccountSession(a)).toBe(true);
    expect(a.forgetDevice).toHaveBeenCalled();
    expect(a.revoke).toHaveBeenCalled();
    expect(a.clearSession).toHaveBeenCalledTimes(1);
  });
  it('un error de red devuelto por Auth no produce un falso logout', async () => {
    const a = actions();
    a.revoke.mockResolvedValue({ error: new Error('sin conexión') });
    expect(await closeAccountSession(a)).toBe(false);
    expect(a.clearSession).not.toHaveBeenCalled();
  });
  it('una excepción de Auth conserva la cuenta para mostrar el error y reintentar', async () => {
    const a = actions();
    a.revoke.mockRejectedValue(new Error('red'));
    expect(await closeAccountSession(a)).toBe(false);
    expect(a.clearSession).not.toHaveBeenCalled();
  });
  it('la limpieza de datos locales ocurre después de confirmar Auth', async () => {
    const a = actions();
    a.revoke.mockImplementation(async () => {
      expect(a.clearSession).not.toHaveBeenCalled();
      return { error: null };
    });
    expect(await closeAccountSession(a)).toBe(true);
    expect(a.clearSession).toHaveBeenCalledTimes(1);
  });
});

import { captureAccountScope } from '../src/utils/accountScope';
import { useAuthStore } from '../src/store/useAuthStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

describe('respuestas tardías de otra sesión', () => {
  const signIn = (id: string) => useAuthStore.getState().setSession({ user: { id } } as any);
  beforeEach(() => useAuthStore.getState().clearSession());

  it.each(['otra-cuenta', 'logout', 'volver-a-la-misma-cuenta'])('descarta perfil y verificación: %s', async (scenario) => {
    signIn('A');
    const scope = captureAccountScope(useAuthStore.getState);
    const request = deferred<string>();
    const commit = jest.fn();
    const operation = request.promise.then((value) => { if (scope.isCurrent()) commit(value); });
    if (scenario === 'otra-cuenta') signIn('B');
    else {
      useAuthStore.getState().clearSession();
      if (scenario === 'volver-a-la-misma-cuenta') signIn('A');
    }
    request.resolve('datos privados de A');
    await operation;
    expect(commit).not.toHaveBeenCalled();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().verification).toBeNull();
  });

  it('un error tardío tampoco borra los datos de la cuenta nueva', async () => {
    signIn('A');
    const scope = captureAccountScope(useAuthStore.getState);
    const request = deferred<string>();
    const commitError = jest.fn();
    const operation = request.promise.catch(() => { if (scope.isCurrent()) commitError(); });
    signIn('B');
    request.reject(new Error('fallo tardío'));
    await operation;
    expect(commitError).not.toHaveBeenCalled();
  });

  it('el refresco de token de la misma sesión conserva respuestas válidas', async () => {
    signIn('A');
    const scope = captureAccountScope(useAuthStore.getState);
    signIn('A');
    expect(scope.isCurrent()).toBe(true);
  });
});

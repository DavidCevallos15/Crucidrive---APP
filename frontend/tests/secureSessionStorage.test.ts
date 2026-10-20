import { createSecureSessionStorage, type SessionStorage } from '../src/utils/secureSessionStorage';

function memory() {
  const data = new Map<string, string>();
  const storage: SessionStorage = {
    getItem: jest.fn(async (key) => data.get(key) ?? null),
    setItem: jest.fn(async (key, value) => { data.set(key, value); }),
    removeItem: jest.fn(async (key) => { data.delete(key); }),
  };
  return { data, storage };
}

describe('sesiones protegidas en móvil', () => {
  it('migra la sesión antigua y elimina la copia sin cifrar', async () => {
    const secure = memory(); const legacy = memory();
    legacy.data.set('auth', 'sesión anterior');
    const adapter = createSecureSessionStorage(secure.storage, legacy.storage);
    expect(await adapter.getItem('auth')).toBe('sesión anterior');
    expect(legacy.data.size).toBe(0);
    expect(await adapter.getItem('auth')).toBe('sesión anterior');
  });

  it('guarda sesiones extensas con Unicode sin exceder 2 KB por fragmento', async () => {
    const secure = memory(); const legacy = memory();
    const adapter = createSecureSessionStorage(secure.storage, legacy.storage);
    const value = JSON.stringify({ access_token: 'a'.repeat(3000), metadata: '🌊'.repeat(3000) });
    await adapter.setItem('auth', value);
    expect([...secure.data.values()].every((v) => Buffer.byteLength(v, 'utf8') < 2048)).toBe(true);
    expect(await adapter.getItem('auth')).toBe(value);
    expect(legacy.storage.setItem).not.toHaveBeenCalled();
  });

  it('una escritura incompleta conserva la sesión anterior y no guarda texto plano', async () => {
    const secure = memory(); const legacy = memory();
    const adapter = createSecureSessionStorage(secure.storage, legacy.storage);
    await adapter.setItem('auth', 'válida');
    (secure.storage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Keystore no disponible'));
    await expect(adapter.setItem('auth', 'nueva')).rejects.toThrow('Keystore');
    expect(await adapter.getItem('auth')).toBe('válida');
    expect(legacy.storage.setItem).not.toHaveBeenCalled();
  });

  it('el cierre elimina manifiesto, fragmentos y sesión heredada', async () => {
    const secure = memory(); const legacy = memory();
    const adapter = createSecureSessionStorage(secure.storage, legacy.storage);
    await adapter.setItem('auth', 'x'.repeat(8000));
    await adapter.removeItem('auth');
    expect(await adapter.getItem('auth')).toBeNull();
    expect(secure.data.size).toBe(0);
    expect(legacy.data.size).toBe(0);
  });

  it('ordena un refresco seguido de logout sin resucitar credenciales', async () => {
    const secure = memory(); const legacy = memory();
    const adapter = createSecureSessionStorage(secure.storage, legacy.storage);
    await Promise.all([adapter.setItem('auth', 'vieja'), adapter.setItem('auth', 'nueva'), adapter.removeItem('auth')]);
    expect(await adapter.getItem('auth')).toBeNull();
  });

  it('una sesión protegida incompleta no recupera una copia antigua', async () => {
    const secure = memory(); const legacy = memory();
    const adapter = createSecureSessionStorage(secure.storage, legacy.storage);
    await adapter.setItem('auth', 'válida');
    const chunk = [...secure.data.keys()].find((key) => !key.endsWith('manifest'))!;
    secure.data.delete(chunk);
    legacy.data.set('auth', 'sesión obsoleta');
    await expect(adapter.getItem('auth')).rejects.toThrow('incompleta');
  });
});

/** Adapter sin dependencias nativas: escritura atómica de sesiones grandes en Keychain/Keystore. */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type Manifest = { id: string; count: number };
const CHUNK_SIZE = 400; // Como máximo 1600 bytes UTF-8, por debajo del límite histórico de iOS.
const MAX_CHUNKS = 512;

export function createSecureSessionStorage(secure: SessionStorage, legacy: SessionStorage): SessionStorage {
  let serial = Promise.resolve();
  let revision = 0;
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = serial.then(operation);
    serial = result.then(() => undefined, () => undefined);
    return result;
  };
  const manifestKey = (key: string) => `${key}.secure-manifest`;
  const chunkKey = (key: string, id: string, index: number) => `${key}.${id}.${index}`;
  const readManifest = async (key: string): Promise<Manifest | null> => {
    const value = await secure.getItem(manifestKey(key));
    if (!value) return null;
    const parsed = JSON.parse(value) as Manifest;
    if (!/^[0-9]+-[0-9]+$/.test(parsed.id) || !Number.isInteger(parsed.count) || parsed.count < 1 || parsed.count > MAX_CHUNKS) {
      throw new Error('No se pudo leer la sesión protegida.');
    }
    return parsed;
  };
  const deleteChunks = async (key: string, manifest: Manifest | null) => {
    if (!manifest) return;
    await Promise.all(Array.from({ length: manifest.count }, (_, i) => secure.removeItem(chunkKey(key, manifest.id, i))));
  };
  const write = async (key: string, value: string) => {
    const previous = await readManifest(key);
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    if (count > MAX_CHUNKS) throw new Error('La sesión supera el tamaño permitido.');
    const next = { id: `${Date.now()}-${++revision}`, count };
    try {
      for (let i = 0; i < count; i++) {
        await secure.setItem(chunkKey(key, next.id, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      // Publicar solo cuando todos los fragmentos estén guardados. Un fallo conserva la sesión anterior.
      await secure.setItem(manifestKey(key), JSON.stringify(next));
    } catch (error) {
      await deleteChunks(key, next).catch(() => undefined);
      throw error; // Nunca volver a persistir tokens en texto plano si falla el almacén seguro.
    }
    await legacy.removeItem(key);
    await deleteChunks(key, previous);
  };
  return {
    getItem: (key) => enqueue(async () => {
      const manifest = await readManifest(key);
      if (manifest) {
        const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, i) => secure.getItem(chunkKey(key, manifest.id, i))));
        if (chunks.some((chunk) => chunk === null)) throw new Error('La sesión protegida está incompleta. Vuelve a iniciar sesión.');
        await legacy.removeItem(key);
        return chunks.join('');
      }
      const previous = await legacy.getItem(key);
      if (previous !== null) await write(key, previous);
      return previous;
    }),
    setItem: (key, value) => enqueue(() => write(key, value)),
    removeItem: (key) => enqueue(async () => {
      const manifest = await readManifest(key);
      await legacy.removeItem(key);
      // Retirar primero el manifiesto evita recuperar una sesión borrada a medias.
      await secure.removeItem(manifestKey(key));
      await deleteChunks(key, manifest);
    }),
  };
}

/** Límite de transporte para Auth; la salida tiene además su límite de operación. */
export const LIMITE_AUTH_RED_MS = 15_000;

/** Aborta la red y rechaza incluso si un transporte nativo no respeta AbortSignal. */
export function crearAuthFetchConLimite(transporte: typeof fetch): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const original = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
    const abortar = () => controller.abort();
    if (original?.aborted) abortar();
    else original?.addEventListener('abort', abortar, { once: true });

    let timer: ReturnType<typeof setTimeout>;
    return new Promise<Response>((resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Tiempo de espera agotado al conectar con Auth.'));
      }, LIMITE_AUTH_RED_MS);
      Promise.resolve().then(() => transporte(input, { ...init, signal: controller.signal })).then(resolve, reject);
    }).finally(() => { clearTimeout(timer); original?.removeEventListener('abort', abortar); });
  };
}

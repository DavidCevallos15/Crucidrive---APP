/**
 * Registro del teléfono para avisos (paso 004, plan P3, criterio 11).
 *
 * Lógica pura, sin módulos de Expo: recibe cómo obtener el token y cómo llamar a la API.
 * Así se prueba con dobles y `avisos.ts` solo conecta las piezas reales.
 */

/** Llamadas al backend: `POST /api/dispositivos` y `DELETE /api/dispositivos/:token`. */
export interface ApiDispositivos {
  registrar: (token: string) => Promise<boolean>;
  olvidar: (token: string) => Promise<boolean>;
}

export interface DependenciasRegistro {
  /** Token de Expo de este teléfono, o null si no hay avisos (web, Expo Go, permiso negado). */
  obtenerToken: () => Promise<string | null>;
  api: ApiDispositivos;
  /** Para no ensuciar la consola en pruebas. */
  avisar?: (mensaje: string, error?: unknown) => void;
}

export interface RegistroAvisos {
  /** Registra el teléfono para la cuenta. Repetirlo con la misma cuenta no vuelve a llamar a la API. */
  registrar: (usuarioId: string) => Promise<string | null>;
  /** Al cerrar sesión, antes de invalidar el JWT: el teléfono deja de recibir avisos de la cuenta. */
  olvidar: () => Promise<void>;
  /** Cuenta para la que quedó registrado el teléfono (null si ninguna). */
  registradoPara: () => string | null;
}

/** Igual que el CHECK de `dispositivos_push` (0014) y que el backend. */
export const TOKEN_EXPO = /^ExponentPushToken\[[A-Za-z0-9_-]{10,200}\]$/;

export const crearRegistroAvisos = ({
  obtenerToken,
  api,
  avisar = (mensaje, error) => console.warn(mensaje, error),
}: DependenciasRegistro): RegistroAvisos => {
  let token: string | null = null;
  let usuario: string | null = null;
  // Una sola operación a la vez: iniciar y cerrar sesión rápido no deben cruzarse.
  let cola: Promise<unknown> = Promise.resolve();
  const enCola = <T>(tarea: () => Promise<T>): Promise<T> => {
    const resultado = cola.then(tarea, tarea);
    cola = resultado.catch(() => undefined);
    return resultado;
  };

  const registrar = (usuarioId: string) => enCola(async () => {
    if (usuario === usuarioId && token) return token;
    try {
      const nuevo = await obtenerToken();
      if (!nuevo || !TOKEN_EXPO.test(nuevo)) return null;
      if (!(await api.registrar(nuevo))) {
        avisar('[Avisos] El servidor no registró el teléfono.');
        return null;
      }
      token = nuevo;
      usuario = usuarioId;
      return nuevo;
    } catch (err) {
      avisar('[Avisos] No se pudo registrar el teléfono:', err);
      return null;
    }
  });

  const olvidar = () => enCola(async () => {
    const actual = token;
    token = null;
    usuario = null;
    if (!actual) return;
    try {
      if (!(await api.olvidar(actual))) avisar('[Avisos] El servidor no quitó el teléfono.');
    } catch (err) {
      // Si falla, el token queda en la BD hasta que otra cuenta lo reclame o Expo lo dé por
      // muerto; los avisos de oferta no traen datos personales (P7).
      avisar('[Avisos] No se pudo quitar el teléfono:', err);
    }
  });

  return { registrar, olvidar, registradoPara: () => usuario };
};

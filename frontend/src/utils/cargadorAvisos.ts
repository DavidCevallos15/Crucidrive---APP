/**
 * Carga perezosa de `expo-notifications` (paso 004). Puro, sin módulos nativos, para probarlo.
 *
 * Expo Go (Android, SDK 53 o más) lanza un error al IMPORTAR `expo-notifications`, aunque no
 * se use nada, y la web no tiene avisos. Por eso el módulo solo se carga donde existe: el APK y
 * las builds de desarrollo.
 */

/** Los avisos remotos existen fuera de la web y fuera de Expo Go. */
export const avisosDisponibles = ({ web, expoGo }: { web: boolean; expoGo: boolean }): boolean => !web && !expoGo;

/**
 * Devuelve una función que carga el módulo una sola vez, o `null` si no hay avisos (y entonces
 * `cargar` ni se llama). Si cargar falla, la app sigue sin avisos en vez de caerse.
 */
export const crearCargador = <T>(
  disponible: boolean,
  cargar: () => T,
  avisar: (error: unknown) => void = (error) => console.warn('[Avisos] No se pudo cargar expo-notifications:', error)
): (() => T | null) => {
  let cargado: T | null | undefined;
  return () => {
    if (cargado === undefined) {
      try {
        cargado = disponible ? cargar() : null;
      } catch (error) {
        avisar(error);
        cargado = null;
      }
    }
    return cargado;
  };
};

/**
 * Preferencias de cookies y almacenamiento en la versión web (spec 019, criterios 9 a 11).
 * Módulo puro sin dependencia de React para pruebas unitarias directas.
 *
 * CruciDrive no usa cookies publicitarias ni analítica externa; la única preferencia opcional
 * en la web es autorizar Google Maps externo frente al mapa de respaldo de OpenStreetMap.
 */

export const WEB_PREFS_STORAGE_KEY = 'crucidrive.preferenciasWeb';
export const WEB_PREFS_VERSION = '1.0';
export const WEB_PREFS_TTL_DAYS = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface WebPrivacyPreferences {
  version: string;
  essentials: true;
  externalMap: boolean;
  savedAt: string;
  expiresAt: string;
}

type PreferenceListener = (prefs: WebPrivacyPreferences) => void;
type ModalOpenListener = () => void;

const preferenceListeners = new Set<PreferenceListener>();
const modalOpenListeners = new Set<ModalOpenListener>();

/** Construye un registro de preferencias con fecha de elección y caducidad de 180 días. */
export const buildWebPreferences = (externalMap: boolean, now = new Date()): WebPrivacyPreferences => ({
  version: WEB_PREFS_VERSION,
  essentials: true,
  externalMap,
  savedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + WEB_PREFS_TTL_DAYS * MS_PER_DAY).toISOString(),
});

/** Valida versión, estructura y fecha de caducidad de unas preferencias guardadas. */
export const isPreferenceValid = (prefs: unknown, now = new Date()): prefs is WebPrivacyPreferences => {
  if (!prefs || typeof prefs !== 'object') return false;
  const candidate = prefs as Partial<WebPrivacyPreferences>;
  if (candidate.version !== WEB_PREFS_VERSION) return false;
  if (candidate.essentials !== true) return false;
  if (typeof candidate.externalMap !== 'boolean') return false;
  if (typeof candidate.savedAt !== 'string' || typeof candidate.expiresAt !== 'string') return false;
  const expiresMs = Date.parse(candidate.expiresAt);
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs > now.getTime();
};

/** El aviso de preferencias se muestra cuando no hay una elección vigente guardada. */
export const shouldShowWebPreferencesBanner = (prefs: WebPrivacyPreferences | null, now = new Date()): boolean =>
  !isPreferenceValid(prefs, now);

/**
 * Indica si el mapa web puede cargar Google Maps según las preferencias del usuario.
 * Si el usuario eligió explícitamente «Solo esenciales» (`externalMap: false`), no se carga Google Maps.
 */
export const allowsGoogleMapsByPreferences = (prefs: WebPrivacyPreferences | null, now = new Date()): boolean => {
  if (!isPreferenceValid(prefs, now)) return true;
  return prefs.externalMap;
};

/** Lee las preferencias desde localStorage; devuelve null si faltan, caducaron o falla el almacenamiento. */
export const readWebPreferences = (now = new Date()): WebPrivacyPreferences | null => {
  try {
    const raw = globalThis.localStorage?.getItem(WEB_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPreferenceValid(parsed, now) ? parsed : null;
  } catch {
    return null;
  }
};

/** Guarda las preferencias en localStorage y notifica a los componentes suscritos (como Map.web). */
export const saveWebPreferences = (externalMap: boolean, now = new Date()): WebPrivacyPreferences => {
  const prefs = buildWebPreferences(externalMap, now);
  try {
    globalThis.localStorage?.setItem(WEB_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Modo privado o almacenamiento deshabilitado: se aplica en memoria durante la sesión actual.
  }
  preferenceListeners.forEach((listener) => listener(prefs));
  return prefs;
};

/** Permite reaccionar en vivo cuando el usuario cambia sus preferencias de mapa en la web. */
export const subscribeWebPreferences = (listener: PreferenceListener): (() => void) => {
  preferenceListeners.add(listener);
  return () => {
    preferenceListeners.delete(listener);
  };
};

/** Abre el panel de personalización de preferencias desde Configuración en cualquier momento. */
export const requestOpenWebPreferencesModal = (): void => {
  modalOpenListeners.forEach((listener) => listener());
};

/** Suscripción interna del modal global de preferencias web. */
export const subscribeOpenWebPreferencesModal = (listener: ModalOpenListener): (() => void) => {
  modalOpenListeners.add(listener);
  return () => {
    modalOpenListeners.delete(listener);
  };
};

/**
 * Cálculos del mapa web con Google Maps (spec 018, Enmienda 1; criterios 14 y 15). Puro, sin
 * React ni el navegador, para probarlo. El componente vive en `components/Map.web.tsx`.
 */
import type { MapRegionLike } from './mapBbox';

/** Centro de Crucita, el mismo que usa el mapa de OpenStreetMap de respaldo. */
export const REGION_CRUCITA: MapRegionLike = {
  latitude: -0.842,
  longitude: -80.531,
  latitudeDelta: 0.11,
  longitudeDelta: 0.06,
};

/** Una clave pública de Google empieza con «AIza» y tiene 39 caracteres. */
export const claveValida = (clave: string | null | undefined): clave is string =>
  typeof clave === 'string' && /^AIza[0-9A-Za-z_-]{35}$/.test(clave.trim());

/** Se usa Google solo con una clave válida; si no, el respaldo de OpenStreetMap (criterio 15). */
export const usarGoogleMaps = (clave: string | null | undefined): boolean => claveValida(clave);

/**
 * URL del script de Maps JavaScript. `loading=async` es el modo que recomienda Google; el
 * callback avisa cuando `google.maps` ya existe. Idioma y región: español de Ecuador.
 */
export const urlScriptGoogleMaps = (clave: string, callback: string): string => {
  const params = new URLSearchParams({
    key: clave.trim(),
    callback,
    loading: 'async',
    language: 'es',
    region: 'EC',
    v: 'weekly',
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
};

/**
 * Zoom de Google a partir del alto visible en grados (`latitudeDelta` de react-native-maps).
 * Con el zoom z, el mundo mide 256·2^z px; 360° de longitud ocupan ese ancho. Se acota a 3–20.
 */
export const zoomDesdeDelta = (delta: number | undefined, altoPx = 640): number => {
  if (!delta || !Number.isFinite(delta) || delta <= 0) return 14;
  const zoom = Math.log2((360 * altoPx) / (256 * delta));
  return Math.min(20, Math.max(3, Math.round(zoom)));
};

/** Centro y zoom para crear o mover el mapa. */
export const vistaDesdeRegion = (region: MapRegionLike | null | undefined, altoPx?: number) => {
  const r = region ?? REGION_CRUCITA;
  return { center: { lat: r.latitude, lng: r.longitude }, zoom: zoomDesdeDelta(r.latitudeDelta, altoPx) };
};

/** El evento de toque con la misma forma que react-native-maps (`nativeEvent.coordinate`). */
export const eventoToque = (lat: number, lng: number) => ({
  nativeEvent: { coordinate: { latitude: lat, longitude: lng } },
});

/**
 * Región del mapa (misma forma que Region de react-native-maps).
 */
export interface MapRegionLike {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Convierte una región de mapa en el cuadro "oeste,sur,este,norte" que usa el
 * mapa embebido de OpenStreetMap en la versión web.
 */
export const regionToBbox = (region: MapRegionLike): string => {
  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  return [west, south, east, north].map((n) => n.toFixed(5)).join(',');
};

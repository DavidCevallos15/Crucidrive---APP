/**
 * Sectores geográficos de Crucita, Manabí — Ecuador.
 *
 * Cada sector define un polígono de geocerca y su tarifa fija
 * hacia otros sectores. Este modelo elimina la necesidad de
 * calcular distancias dinámicas y simplifica la tarifación.
 */

export interface SectorCoordinate {
  lat: number;
  lng: number;
}

export interface Sector {
  /** Identificador único del sector */
  id: string;
  /** Nombre legible del sector */
  name: string;
  /** Coordenada central del sector (para centrar el mapa) */
  center: SectorCoordinate;
  /** Color del marcador en el mapa */
  markerColor: string;
}

export interface TariffEntry {
  /** Sector de origen */
  originId: string;
  /** Sector de destino */
  destinationId: string;
  /** Tarifa fija en USD */
  price: number;
  /** Distancia estimada en km */
  estimatedDistanceKm: number;
  /** Tiempo estimado en minutos */
  estimatedTimeMin: number;
}

/**
 * Sectores operativos de Crucita.
 * Los nombres están en español ya que son topónimos locales.
 */
export const SECTORS: Sector[] = [
  {
    id: 'centro',
    name: 'Centro de Crucita',
    center: { lat: -1.0448, lng: -80.5432 },
    markerColor: '#0D9488',
  },
  {
    id: 'playa',
    name: 'Malecón / Playa',
    center: { lat: -1.0470, lng: -80.5485 },
    markerColor: '#14B8A6',
  },
  {
    id: 'las_gilces',
    name: 'Las Gilces',
    center: { lat: -1.0395, lng: -80.5350 },
    markerColor: '#F59E0B',
  },
  {
    id: 'los_arenales',
    name: 'Los Arenales',
    center: { lat: -1.0520, lng: -80.5410 },
    markerColor: '#FBBF24',
  },
  {
    id: 'san_jacinto',
    name: 'San Jacinto',
    center: { lat: -1.0600, lng: -80.5370 },
    markerColor: '#10B981',
  },
];

/**
 * Matriz de tarifas fijas entre sectores.
 * Nota: La tarifa es simétrica (A→B cuesta igual que B→A).
 */
export const TARIFFS: TariffEntry[] = [
  // Centro ↔ Playa
  { originId: 'centro', destinationId: 'playa', price: 1.50, estimatedDistanceKm: 1.2, estimatedTimeMin: 5 },
  // Centro ↔ Las Gilces
  { originId: 'centro', destinationId: 'las_gilces', price: 2.00, estimatedDistanceKm: 2.0, estimatedTimeMin: 8 },
  // Centro ↔ Los Arenales
  { originId: 'centro', destinationId: 'los_arenales', price: 1.75, estimatedDistanceKm: 1.5, estimatedTimeMin: 6 },
  // Centro ↔ San Jacinto
  { originId: 'centro', destinationId: 'san_jacinto', price: 2.40, estimatedDistanceKm: 3.2, estimatedTimeMin: 10 },
  // Playa ↔ Las Gilces
  { originId: 'playa', destinationId: 'las_gilces', price: 2.50, estimatedDistanceKm: 3.0, estimatedTimeMin: 12 },
  // Playa ↔ Los Arenales
  { originId: 'playa', destinationId: 'los_arenales', price: 1.50, estimatedDistanceKm: 1.0, estimatedTimeMin: 4 },
  // Playa ↔ San Jacinto
  { originId: 'playa', destinationId: 'san_jacinto', price: 2.20, estimatedDistanceKm: 2.8, estimatedTimeMin: 9 },
  // Las Gilces ↔ Los Arenales
  { originId: 'las_gilces', destinationId: 'los_arenales', price: 2.00, estimatedDistanceKm: 2.2, estimatedTimeMin: 8 },
  // Las Gilces ↔ San Jacinto
  { originId: 'las_gilces', destinationId: 'san_jacinto', price: 3.00, estimatedDistanceKm: 4.0, estimatedTimeMin: 15 },
  // Los Arenales ↔ San Jacinto
  { originId: 'los_arenales', destinationId: 'san_jacinto', price: 1.50, estimatedDistanceKm: 1.3, estimatedTimeMin: 5 },
];

/**
 * Busca la tarifa fija entre dos sectores.
 * @param originId - ID del sector de origen
 * @param destinationId - ID del sector de destino
 * @returns Entrada de tarifa o undefined si no existe la ruta
 */
export const findTariff = (
  originId: string,
  destinationId: string
): TariffEntry | undefined => {
  return TARIFFS.find(
    (t) =>
      (t.originId === originId && t.destinationId === destinationId) ||
      (t.originId === destinationId && t.destinationId === originId)
  );
};

/**
 * Determina el sector más cercano a unas coordenadas dadas.
 * Usa la distancia euclidiana simplificada (suficiente para distancias cortas).
 * @param lat - Latitud del usuario
 * @param lng - Longitud del usuario
 * @returns El sector más cercano
 */
export const findNearestSector = (lat: number, lng: number): Sector => {
  let nearestSector = SECTORS[0];
  let minDistance = Infinity;

  for (const sector of SECTORS) {
    const dLat = sector.center.lat - lat;
    const dLng = sector.center.lng - lng;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

    if (distance < minDistance) {
      minDistance = distance;
      nearestSector = sector;
    }
  }

  return nearestSector;
};

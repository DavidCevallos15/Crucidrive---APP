/**
 * Sectores geográficos de Crucita, Manabí — Ecuador.
 *
 * Los sectores sirven para ubicar al usuario y despachar tricimotos cercanas.
 * NO fijan el precio: en Crucita se cobra por persona (D-08), sin importar la ruta.
 * Los 5 centros son pines reales marcados en Google Maps (migración 0009).
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

/**
 * Sectores operativos de Crucita.
 * Los nombres están en español ya que son topónimos locales.
 */
export const SECTORS: Sector[] = [
  {
    id: 'la_boca',
    name: 'La Boca',
    center: { lat: -0.80147852, lng: -80.52098189 },
    markerColor: '#38BDF8',
  },
  {
    id: 'las_gilces',
    name: 'Las Gilces',
    center: { lat: -0.82141437, lng: -80.52405601 },
    markerColor: '#F59E0B',
  },
  {
    id: 'los_arenales',
    name: 'Los Arenales',
    center: { lat: -0.8567572, lng: -80.53186699 },
    markerColor: '#FBBF24',
  },
  {
    id: 'malecon',
    name: 'Malecón de Crucita',
    center: { lat: -0.8699838, lng: -80.53995042 },
    markerColor: '#14B8A6',
  },
  {
    id: 'la_loma',
    name: 'La Loma',
    center: { lat: -0.88463806, lng: -80.54802452 },
    markerColor: '#10B981',
  },
];

/** Precio por persona en USD. Solo para mostrar; el servidor fija el cobro real. */
export const PRICE_PER_PERSON_USD = 0.5;

/** Tope de pasajeros por solicitud (barrera técnica; igual al CHECK de la BD). */
export const MAX_PASSENGERS = 20;

/**
 * Total estimado del viaje: precio por persona × número de pasajeros.
 * No depende del origen, el destino ni la distancia.
 * @param passengers - Número de personas (entero ≥ 1)
 */
export const calculateFare = (passengers: number): number => {
  const people = Number.isInteger(passengers) && passengers >= 1 ? passengers : 1;
  return Math.round(people * PRICE_PER_PERSON_USD * 100) / 100;
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

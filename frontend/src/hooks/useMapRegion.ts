import { useMemo } from 'react';
import { LOCATION_CONFIG } from '../constants/config';
import type { Coordinates } from '../store/useLocationStore';

/**
 * Tipo compatible con react-native-maps Region.
 */
interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Hook que computa la región del mapa a partir de las coordenadas del usuario.
 *
 * Si no hay coordenadas disponibles (permisos denegados, GPS apagado),
 * retorna la región por defecto de Crucita.
 *
 * Compartido entre MapScreen (pasajero) y DriverConsoleScreen (conductor).
 *
 * @param userCoords - Coordenadas actuales del usuario (o null).
 * @returns Región memoizada para MapView.
 */
export const useMapRegion = (userCoords: Coordinates | null): MapRegion => {
  return useMemo(
    () => ({
      latitude: userCoords?.lat ?? LOCATION_CONFIG.defaultRegion.latitude,
      longitude: userCoords?.lng ?? LOCATION_CONFIG.defaultRegion.longitude,
      latitudeDelta: LOCATION_CONFIG.defaultRegion.latitudeDelta,
      longitudeDelta: LOCATION_CONFIG.defaultRegion.longitudeDelta,
    }),
    [userCoords]
  );
};

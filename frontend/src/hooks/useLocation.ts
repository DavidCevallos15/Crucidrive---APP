import { useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { useLocationStore } from '../store/useLocationStore';
import { findNearestSector } from '../constants/sectors';
import { LOCATION_CONFIG } from '../constants/config';

/**
 * Hook para geolocalización con expo-location.
 *
 * Gestiona permisos, tracking en tiempo real y determinación
 * automática del sector actual del usuario.
 *
 * @param enableTracking - Si es true, inicia el tracking continuo de GPS.
 */
export const useLocation = (enableTracking: boolean = false) => {
  const {
    userCoords,
    currentSectorId,
    hasPermission,
    isTracking,
    setUserCoords,
    setCurrentSector,
    setPermission,
    setTracking,
  } = useLocationStore();

  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  // ─── Solicitar permisos de ubicación ───────────────────────
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } =
        await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        console.warn('[Location] Permiso de ubicación en primer plano denegado.');
        setPermission(false);
        return false;
      }

      setPermission(true);
      return true;
    } catch (error) {
      console.error('[Location] Error al solicitar permisos:', error);
      setPermission(false);
      return false;
    }
  }, [setPermission]);

  // ─── Solicitar permisos de ubicación en background (conductor) ─
  const requestBackgroundPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('[Location] Permiso de ubicación en background denegado.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Location] Error al solicitar permisos background:', error);
      return false;
    }
  }, []);

  // ─── Obtener posición actual (una sola vez) ───────────────
  const getCurrentPosition = useCallback(async () => {
    try {
      const granted = hasPermission || (await requestPermissions());
      if (!granted) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      setUserCoords(coords);

      // Determinar sector actual
      const nearestSector = findNearestSector(coords.lat, coords.lng);
      setCurrentSector(nearestSector.id);

      return coords;
    } catch (error) {
      console.error('[Location] Error al obtener posición:', error);
      return null;
    }
  }, [hasPermission, requestPermissions, setUserCoords, setCurrentSector]);

  // ─── Iniciar tracking continuo ─────────────────────────────
  const startTracking = useCallback(async () => {
    try {
      const granted = hasPermission || (await requestPermissions());
      if (!granted) return;

      // Detener tracking previo si existe
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_CONFIG.driverUpdateIntervalMs,
          distanceInterval: LOCATION_CONFIG.distanceFilterMeters,
        },
        (location) => {
          const coords = {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          };

          setUserCoords(coords);

          // Actualizar sector si cambió
          const nearestSector = findNearestSector(coords.lat, coords.lng);
          setCurrentSector(nearestSector.id);
        }
      );

      watchSubscriptionRef.current = subscription;
      setTracking(true);
    } catch (error) {
      console.error('[Location] Error al iniciar tracking:', error);
    }
  }, [hasPermission, requestPermissions, setUserCoords, setCurrentSector, setTracking]);

  // ─── Detener tracking ──────────────────────────────────────
  const stopTracking = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    setTracking(false);
  }, [setTracking]);

  // ─── Auto-tracking según prop ──────────────────────────────
  useEffect(() => {
    if (enableTracking) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enableTracking]);

  // Obtener posición inicial al montar
  useEffect(() => {
    getCurrentPosition();
  }, []);

  return {
    userCoords,
    currentSectorId,
    hasPermission,
    isTracking,
    requestPermissions,
    requestBackgroundPermissions,
    getCurrentPosition,
    startTracking,
    stopTracking,
  };
};

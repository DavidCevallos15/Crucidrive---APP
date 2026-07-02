import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GlassCard } from '../../components/GlassCard';
import { GlassButton } from '../../components/GlassButton';
import { BlurContainer } from '../../components/BlurContainer';
import { PanicButton } from '../../components/PanicButton';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useLocation } from '../../hooks/useLocation';
import { useSocket } from '../../hooks/useSocket';
import { useTariff } from '../../hooks/useTariff';
import { useLocationStore, type NearbyDriver } from '../../store/useLocationStore';
import { useRideStore } from '../../store/useRideStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SECTORS } from '../../constants/sectors';
import { LOCATION_CONFIG, API_CONFIG } from '../../constants/config';
import { COLORS, FONTS, SPACING, SHAPES, Z_INDEX } from '../../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Pantalla principal del mapa para el pasajero.
 *
 * Muestra:
 * - Mapa interactivo a pantalla completa con marcadores de tricimotos
 * - Barra de búsqueda flotante estilo píldora (sector de destino)
 * - Bottom sheet con tarifa precalculada
 * - Botón de Pánico (SOS) flotante
 *
 * Diseño: DESIGN.md §3.B — Panel del Mapa y Ficha de Destino
 */
export const MapScreen: React.FC = () => {
  const { userCoords, currentSectorId } = useLocation(false);
  const { joinSector, onEvent } = useSocket();
  const nearbyDrivers = useLocationStore((s) => s.nearbyDrivers);
  const updateNearbyDriver = useLocationStore((s) => s.updateNearbyDriver);
  const { activeRide, isRequesting, setActiveRide, setRequesting } = useRideStore();
  const session = useAuthStore((s) => s.session);

  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [showRideSheet, setShowRideSheet] = useState(false);

  const {
    tariff,
    originName,
    destinationName,
    formattedPrice,
    formattedTime,
    formattedDistance,
  } = useTariff(currentSectorId, selectedDestination);

  // ─── Región inicial del mapa ───────────────────────────────
  const initialRegion: Region = useMemo(
    () => ({
      latitude: userCoords?.lat ?? LOCATION_CONFIG.defaultRegion.latitude,
      longitude: userCoords?.lng ?? LOCATION_CONFIG.defaultRegion.longitude,
      latitudeDelta: LOCATION_CONFIG.defaultRegion.latitudeDelta,
      longitudeDelta: LOCATION_CONFIG.defaultRegion.longitudeDelta,
    }),
    [userCoords]
  );

  // ─── Suscribirse al sector cuando se determina ────────────
  useEffect(() => {
    if (currentSectorId) {
      joinSector(currentSectorId);
    }
  }, [currentSectorId, joinSector]);

  // ─── Escuchar actualizaciones de ubicación de conductores ──
  useEffect(() => {
    const unsubscribe = onEvent('location_updated', (data) => {
      updateNearbyDriver({
        conductorId: data.conductorId,
        nombre: data.nombre,
        coords: data.coords,
        estado: data.estado as NearbyDriver['estado'],
        lastUpdate: Date.now(),
      });
    });

    return unsubscribe;
  }, [onEvent, updateNearbyDriver]);

  // ─── Seleccionar destino ──────────────────────────────────
  const handleSelectDestination = useCallback((sectorId: string) => {
    setSelectedDestination(sectorId);
    setShowRideSheet(true);
  }, []);

  // ─── Solicitar viaje ──────────────────────────────────────
  const handleRequestRide = useCallback(async () => {
    if (!currentSectorId || !selectedDestination || !tariff) return;

    try {
      setRequesting(true);

      const response = await fetch(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.rides.request}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            sector_origen: currentSectorId,
            sector_destino: selectedDestination,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al solicitar el viaje');
      }

      const data = await response.json();

      setActiveRide({
        id: data.viaje?.id ?? '',
        status: 'solicitado',
        originSectorId: currentSectorId,
        originName,
        destinationSectorId: selectedDestination,
        destinationName,
        price: tariff.price,
        estimatedDistanceKm: tariff.estimatedDistanceKm,
        estimatedTimeMin: tariff.estimatedTimeMin,
        driver: null,
        chatThreadId: null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[MapScreen] Error al solicitar viaje:', error);
    } finally {
      setRequesting(false);
    }
  }, [
    currentSectorId,
    selectedDestination,
    tariff,
    session,
    originName,
    destinationName,
    setActiveRide,
    setRequesting,
  ]);

  // ─── Activar botón de pánico ──────────────────────────────
  const handlePanic = useCallback(async () => {
    try {
      // Emitir señal de emergencia al backend
      console.log('[SOS] ¡Botón de pánico activado!');
      // TODO: Implementar endpoint de emergencia en el backend
    } catch (error) {
      console.error('[SOS] Error al activar pánico:', error);
    }
  }, []);

  // ─── Convertir Map a Array para iterar ────────────────────
  const driversArray = useMemo(
    () => Array.from(nearbyDrivers.values()),
    [nearbyDrivers]
  );

  // ─── Sectores de destino disponibles (excluyendo el actual) ─
  const availableDestinations = useMemo(
    () => SECTORS.filter((s) => s.id !== currentSectorId),
    [currentSectorId]
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ─── MAPA DE PANTALLA COMPLETA ──────────────────────── */}
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="standard"
      >
        {/* Marcadores de conductores cercanos */}
        {driversArray.map((driver) => (
          <Marker
            key={driver.conductorId}
            coordinate={{
              latitude: driver.coords.lat,
              longitude: driver.coords.lng,
            }}
            title={driver.nombre}
            description={
              driver.estado === 'disponible' ? 'Disponible' : 'Ocupado'
            }
          >
            <View
              style={[
                styles.driverMarker,
                {
                  backgroundColor:
                    driver.estado === 'disponible'
                      ? COLORS.success
                      : COLORS.glassTextMutedDark,
                },
              ]}
            >
              <Ionicons name="car" size={16} color={COLORS.white} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ─── BARRA DE BÚSQUEDA FLOTANTE (PÍLDORA) ─────────── */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(500)}
        style={styles.searchBarContainer}
      >
        <BlurContainer
          intensity={30}
          style={styles.searchBar}
        >
          <Ionicons
            name="search"
            size={20}
            color={COLORS.glassTextMutedDark}
          />
          <Text style={styles.searchText}>
            ¿A dónde vas?
          </Text>
        </BlurContainer>
      </Animated.View>

      {/* ─── SELECTOR DE DESTINO ───────────────────────────── */}
      {!showRideSheet && (
        <Animated.View
          entering={FadeInUp.delay(400).duration(500)}
          style={styles.destinationContainer}
        >
          <GlassCard style={styles.destinationCard}>
            <Text style={styles.sectionTitle}>Selecciona tu destino</Text>
            {availableDestinations.map((sector) => (
              <GlassButton
                key={sector.id}
                label={sector.name}
                onPress={() => handleSelectDestination(sector.id)}
                variant="ghost"
                size="md"
                leftIcon={
                  <Ionicons
                    name="location"
                    size={18}
                    color={sector.markerColor}
                  />
                }
                style={styles.destinationButton}
              />
            ))}
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── BOTTOM SHEET: FICHA DE VIAJE ─────────────────── */}
      {showRideSheet && tariff && (
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.rideSheetContainer}
        >
          <GlassCard style={styles.rideSheet}>
            {/* Encabezado con tarifa */}
            <View style={styles.rideHeader}>
              <Text style={styles.rideLabel}>Tarifa precalculada</Text>
              <Text style={styles.ridePrice}>{formattedPrice}</Text>
              <Text style={styles.rideCurrency}>USD</Text>
            </View>

            {/* Detalles de la ruta */}
            <View style={styles.routeDetails}>
              <View style={styles.routeRow}>
                <Ionicons name="navigate" size={16} color={COLORS.primary} />
                <Text style={styles.routeText}>Distancia</Text>
                <Text style={styles.routeValue}>{formattedDistance}</Text>
              </View>
              <View style={styles.routeRow}>
                <Ionicons name="time" size={16} color={COLORS.secondary} />
                <Text style={styles.routeText}>Duración</Text>
                <Text style={styles.routeValue}>{formattedTime}</Text>
              </View>
              <View style={styles.routeRow}>
                <Ionicons name="location" size={16} color={COLORS.success} />
                <Text style={styles.routeText}>
                  {originName} → {destinationName}
                </Text>
              </View>
            </View>

            {/* Botón de solicitud */}
            {activeRide?.status === 'solicitado' ? (
              <LoadingSpinner message="Buscando conductor..." />
            ) : (
              <GlassButton
                label="Solicitar Tricimoto"
                onPress={handleRequestRide}
                variant="secondary"
                size="lg"
                loading={isRequesting}
                leftIcon={
                  <Ionicons name="car" size={20} color={COLORS.darkBg} />
                }
                style={styles.requestButton}
              />
            )}

            {/* Botón de cancelar */}
            <GlassButton
              label="Cancelar"
              onPress={() => {
                setShowRideSheet(false);
                setSelectedDestination(null);
              }}
              variant="ghost"
              size="sm"
              style={styles.cancelButton}
            />
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── BOTÓN DE PÁNICO (SOS) ────────────────────────── */}
      <PanicButton onActivate={handlePanic} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },

  // ─── Barra de búsqueda ──────────────────────────────────
  searchBarContainer: {
    position: 'absolute',
    top: 60,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: Z_INDEX.searchBar,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: SHAPES.borderRadiusFull,
    borderWidth: 1,
    borderColor: COLORS.glassBorderDark,
  },
  searchText: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    marginLeft: SPACING.sm,
    flex: 1,
  },

  // ─── Selector de destino ─────────────────────────────────
  destinationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: Z_INDEX.bottomSheet,
  },
  destinationCard: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.md,
  },
  destinationButton: {
    marginBottom: SPACING.sm,
    justifyContent: 'flex-start',
  },

  // ─── Bottom Sheet: Ficha de viaje ────────────────────────
  rideSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: Z_INDEX.bottomSheet,
  },
  rideSheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 40,
  },
  rideHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.md,
  },
  rideLabel: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginRight: SPACING.sm,
  },
  ridePrice: {
    fontSize: FONTS.sizes.display,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
  },
  rideCurrency: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginLeft: SPACING.xs,
  },
  routeDetails: {
    marginBottom: SPACING.lg,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.glassBorderDark,
  },
  routeText: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  routeValue: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
  },
  requestButton: {
    alignSelf: 'stretch',
  },
  cancelButton: {
    marginTop: SPACING.sm,
    alignSelf: 'center',
  },

  // ─── Marcadores de conductores ──────────────────────────
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
});

export default MapScreen;

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  Alert,
} from 'react-native';
import MapView, { Marker } from '../components/Map';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { BlurContainer } from '../components/BlurContainer';
import { PanicButton } from '../components/PanicButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useLocation } from '../hooks/useLocation';
import { useSocket } from '../hooks/useSocket';
import { useTariff } from '../hooks/useTariff';
import { useMapRegion } from '../hooks/useMapRegion';
import { useLocationStore, type NearbyDriver } from '../store/useLocationStore';
import { useRideStore } from '../store/useRideStore';
import { SECTORS, MAX_PASSENGERS } from '../constants/sectors';
import { LOCATION_CONFIG, API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SPACING, SHAPES, Z_INDEX } from '../constants/theme';
import { authFetch } from '../utils/authFetch';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Pantalla principal del mapa para el pasajero.
 *
 * Muestra:
 * - Mapa interactivo a pantalla completa con marcadores de tricimotos
 * - Barra de búsqueda flotante estilo píldora (sector de destino)
 * - Bottom sheet con el total (0,50 USD por persona)
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

  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [showRideSheet, setShowRideSheet] = useState(false);
  const [passengers, setPassengers] = useState(1);
  const [destinationNote, setDestinationNote] = useState('');

  const { total, formattedPrice, formattedPricePerPerson } = useTariff(passengers);

  const originName = SECTORS.find((s) => s.id === currentSectorId)?.name ?? '';
  const destinationName = SECTORS.find((s) => s.id === selectedDestination)?.name ?? '';

  // ─── Región inicial del mapa ───────────────────────────────
  const initialRegion = useMapRegion(userCoords);

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
    const originSector = SECTORS.find((s) => s.id === currentSectorId);
    const destinationSector = SECTORS.find((s) => s.id === selectedDestination);
    if (!originSector || !destinationSector) return;

    const note = destinationNote.trim();

    try {
      setRequesting(true);

      // El precio no se envía: el servidor lo calcula (0,50 × pasajeros).
      const response = await authFetch(API_CONFIG.endpoints.rides.request, {
        method: 'POST',
        body: JSON.stringify({
          origen: userCoords ?? originSector.center,
          destino: destinationSector.center,
          pasajeros: passengers,
          sectorOrigenId: originSector.id,
          sectorDestinoId: destinationSector.id,
          ...(note ? { destinoDescripcion: note } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        Alert.alert('Error', errorData?.message ?? 'No se pudo solicitar el viaje.');
        return;
      }

      const data = await response.json();

      setActiveRide({
        id: data.data?.id ?? '',
        status: 'solicitado',
        originSectorId: originSector.id,
        originName: originSector.name,
        destinationSectorId: destinationSector.id,
        destinationName: destinationSector.name,
        passengers,
        price: Number(data.data?.tarifa ?? total),
        destinationNote: note,
        driver: null,
        chatThreadId: null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[MapScreen] Error al solicitar viaje:', error);
      Alert.alert('Error de conexión', 'No se pudo conectar con el servidor para solicitar el viaje.');
    } finally {
      setRequesting(false);
    }
  }, [
    currentSectorId,
    selectedDestination,
    userCoords,
    passengers,
    destinationNote,
    total,
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
      {showRideSheet && (
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.rideSheetContainer}
        >
          <GlassCard style={styles.rideSheet}>
            {/* Encabezado con el total */}
            <View style={styles.rideHeader}>
              <Text style={styles.rideLabel}>Total</Text>
              <Text style={styles.ridePrice}>{formattedPrice}</Text>
              <Text style={styles.rideCurrency}>USD</Text>
            </View>

            {/* Detalles del viaje */}
            <View style={styles.routeDetails}>
              <View style={styles.routeRow}>
                <Ionicons name="people" size={16} color={COLORS.primary} />
                <Text style={styles.routeText}>
                  Pasajeros ({formattedPricePerPerson} c/u)
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quitar un pasajero"
                  disabled={passengers <= 1}
                  onPress={() => setPassengers((n) => Math.max(1, n - 1))}
                  style={[styles.stepperButton, passengers <= 1 && styles.stepperDisabled]}
                >
                  <Ionicons name="remove" size={22} color={COLORS.white} />
                </Pressable>
                <Text style={styles.stepperValue}>{passengers}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Agregar un pasajero"
                  disabled={passengers >= MAX_PASSENGERS}
                  onPress={() => setPassengers((n) => Math.min(MAX_PASSENGERS, n + 1))}
                  style={[styles.stepperButton, passengers >= MAX_PASSENGERS && styles.stepperDisabled]}
                >
                  <Ionicons name="add" size={22} color={COLORS.white} />
                </Pressable>
              </View>
              <View style={styles.routeRow}>
                <Ionicons name="location" size={16} color={COLORS.success} />
                <Text style={styles.routeText}>
                  {originName} → {destinationName}
                </Text>
              </View>
              <TextInput
                value={destinationNote}
                onChangeText={setDestinationNote}
                placeholder="¿Dónde exactamente? (opcional)"
                placeholderTextColor={COLORS.glassTextMutedDark}
                maxLength={200}
                accessibilityLabel="Referencia del destino"
                style={styles.noteInput}
              />
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
                setPassengers(1);
                setDestinationNote('');
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
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  stepperDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  noteInput: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: SHAPES.borderRadiusFull,
    borderWidth: 1,
    borderColor: COLORS.glassBorderDark,
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  Dimensions,
  Modal,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  BounceIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GlassCard } from '../../components/GlassCard';
import { GlassButton } from '../../components/GlassButton';
import { BlurContainer } from '../../components/BlurContainer';
import { useLocation } from '../../hooks/useLocation';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocationStore } from '../../store/useLocationStore';
import { LOCATION_CONFIG, API_CONFIG } from '../../constants/config';
import { COLORS, FONTS, SPACING, SHAPES, ANIMATION } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Solicitud de viaje entrante que llega desde el backend.
 */
interface IncomingRideRequest {
  id: string;
  sectorOrigen: string;
  sectorDestino: string;
  pasajeroNombre: string;
  tarifa: number;
}

/**
 * Pantalla de la Consola del Conductor.
 *
 * Funcionalidades:
 * - Switch de estado operativo (disponible/ocupado)
 * - Mapa de tracking en background
 * - Modal de cristal elástico para solicitudes entrantes (15s timeout)
 * - Transmisión de ubicación GPS en tiempo real
 *
 * Diseño: DESIGN.md §3.C — Consola del Conductor
 */
export const DriverConsoleScreen: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const { userCoords, currentSectorId } = useLocation(true);
  const { updateLocation, onEvent } = useSocket();

  const [isAvailable, setIsAvailable] = useState(
    profile?.estado_operativo === 'disponible'
  );
  const [incomingRequest, setIncomingRequest] = useState<IncomingRideRequest | null>(null);
  const [acceptCountdown, setAcceptCountdown] = useState(15);
  const [isAccepting, setIsAccepting] = useState(false);

  // ─── Región del mapa ──────────────────────────────────────
  const region: Region = useMemo(
    () => ({
      latitude: userCoords?.lat ?? LOCATION_CONFIG.defaultRegion.latitude,
      longitude: userCoords?.lng ?? LOCATION_CONFIG.defaultRegion.longitude,
      latitudeDelta: LOCATION_CONFIG.defaultRegion.latitudeDelta,
      longitudeDelta: LOCATION_CONFIG.defaultRegion.longitudeDelta,
    }),
    [userCoords]
  );

  // ─── Emitir ubicación GPS al backend ──────────────────────
  useEffect(() => {
    if (!isAvailable || !userCoords || !currentSectorId) return;

    const interval = setInterval(() => {
      updateLocation(
        currentSectorId,
        userCoords,
        isAvailable ? 'disponible' : 'ocupado'
      );
    }, LOCATION_CONFIG.driverUpdateIntervalMs);

    return () => clearInterval(interval);
  }, [isAvailable, userCoords, currentSectorId, updateLocation]);

  // ─── Toggle de estado operativo ───────────────────────────
  const handleToggleAvailability = useCallback((value: boolean) => {
    setIsAvailable(value);
    // TODO: Actualizar estado en backend
  }, []);

  // ─── Temporizador de aceptación (15 segundos) ─────────────
  useEffect(() => {
    if (!incomingRequest) return;

    setAcceptCountdown(15);
    const timer = setInterval(() => {
      setAcceptCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIncomingRequest(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingRequest]);

  // ─── Aceptar viaje ────────────────────────────────────────
  const handleAcceptRide = useCallback(async () => {
    if (!incomingRequest) return;

    try {
      setIsAccepting(true);

      const response = await fetch(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.rides.accept}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ viaje_id: incomingRequest.id }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al aceptar el viaje');
      }

      setIncomingRequest(null);
      setIsAvailable(false);
      // TODO: Navegar a pantalla de viaje en curso
    } catch (error) {
      console.error('[DriverConsole] Error al aceptar:', error);
    } finally {
      setIsAccepting(false);
    }
  }, [incomingRequest, session]);

  // ─── Rechazar viaje ───────────────────────────────────────
  const handleRejectRide = useCallback(() => {
    setIncomingRequest(null);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ─── MAPA DE TRACKING ─────────────────────────────── */}
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        mapType="standard"
      />

      {/* ─── HEADER CON SWITCH DE ESTADO ─────────────────── */}
      <Animated.View
        entering={FadeIn.delay(200).duration(400)}
        style={styles.headerContainer}
      >
        <BlurContainer intensity={30} style={styles.header}>
          <View style={styles.headerContent}>
            {/* Info del conductor */}
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>
                {profile?.nombre ?? 'Conductor'}
              </Text>
              <Text
                style={[
                  styles.statusLabel,
                  { color: isAvailable ? COLORS.success : COLORS.glassTextMutedDark },
                ]}
              >
                {isAvailable ? 'Disponible' : 'No disponible'}
              </Text>
            </View>

            {/* Switch de disponibilidad */}
            <View style={styles.switchContainer}>
              <Switch
                value={isAvailable}
                onValueChange={handleToggleAvailability}
                trackColor={{
                  false: 'rgba(255, 255, 255, 0.1)',
                  true: COLORS.success,
                }}
                thumbColor={COLORS.white}
                ios_backgroundColor="rgba(255, 255, 255, 0.1)"
                style={styles.switch}
                accessibilityLabel={
                  isAvailable
                    ? 'Estado: Disponible. Desactiva para dejar de recibir viajes.'
                    : 'Estado: No disponible. Activa para recibir viajes.'
                }
              />
            </View>
          </View>

          {/* Estadísticas rápidas */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {profile?.calificacion?.toFixed(1) ?? '5.0'}
              </Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {currentSectorId ?? '--'}
              </Text>
              <Text style={styles.statLabel}>Sector</Text>
            </View>
          </View>
        </BlurContainer>
      </Animated.View>

      {/* ─── MODAL: SOLICITUD DE VIAJE ENTRANTE ───────────── */}
      <Modal
        visible={incomingRequest !== null}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={BounceIn.duration(500)}
            exiting={FadeOut.duration(200)}
          >
            <GlassCard
              variant="highlight"
              style={styles.requestCard}
              blurIntensity={40}
            >
              {/* Temporizador visual */}
              <View style={styles.countdownContainer}>
                <Text style={styles.countdownText}>{acceptCountdown}</Text>
                <Text style={styles.countdownLabel}>segundos</Text>
              </View>

              <Text style={styles.requestTitle}>¡Nuevo viaje!</Text>
              <Text style={styles.requestSubtitle}>
                {incomingRequest?.pasajeroNombre ?? 'Pasajero'}
              </Text>

              {/* Detalles de la ruta */}
              <View style={styles.requestRoute}>
                <View style={styles.requestRouteRow}>
                  <Ionicons name="radio-button-on" size={14} color={COLORS.primary} />
                  <Text style={styles.requestRouteText}>
                    {incomingRequest?.sectorOrigen}
                  </Text>
                </View>
                <View style={styles.requestRouteLine} />
                <View style={styles.requestRouteRow}>
                  <Ionicons name="location" size={14} color={COLORS.secondary} />
                  <Text style={styles.requestRouteText}>
                    {incomingRequest?.sectorDestino}
                  </Text>
                </View>
              </View>

              {/* Tarifa */}
              <Text style={styles.requestPrice}>
                ${incomingRequest?.tarifa.toFixed(2)}
              </Text>

              {/* Botones de acción (grandes para facilitar toque en conducción) */}
              <View style={styles.actionButtons}>
                <GlassButton
                  label="Rechazar"
                  onPress={handleRejectRide}
                  variant="danger"
                  size="lg"
                  style={styles.actionButton}
                />
                <GlassButton
                  label="Aceptar"
                  onPress={handleAcceptRide}
                  variant="primary"
                  size="lg"
                  loading={isAccepting}
                  style={styles.actionButton}
                />
              </View>
            </GlassCard>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },

  // ─── Header ──────────────────────────────────────────────
  headerContainer: {
    position: 'absolute',
    top: 50,
    left: SPACING.md,
    right: SPACING.md,
  },
  header: {
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: 1,
    borderColor: COLORS.glassBorderDark,
    padding: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  statusLabel: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    marginTop: 2,
  },
  switchContainer: {
    marginLeft: SPACING.md,
  },
  switch: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },

  // ─── Estadísticas ─────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.glassBorderDark,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    backgroundColor: COLORS.glassBorderDark,
    marginHorizontal: SPACING.md,
  },

  // ─── Modal de solicitud ──────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  requestCard: {
    width: SCREEN_WIDTH - SPACING.xl * 2,
    alignItems: 'center',
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  countdownText: {
    fontSize: 48,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
  },
  countdownLabel: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
  },
  requestTitle: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  requestSubtitle: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginTop: SPACING.xs,
  },
  requestRoute: {
    marginVertical: SPACING.lg,
    alignSelf: 'stretch',
  },
  requestRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  requestRouteLine: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.glassBorderDark,
    marginLeft: 7,
  },
  requestRouteText: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    marginLeft: SPACING.sm,
  },
  requestPrice: {
    fontSize: FONTS.sizes.title,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignSelf: 'stretch',
  },
  actionButton: {
    flex: 1,
  },
});

export default DriverConsoleScreen;

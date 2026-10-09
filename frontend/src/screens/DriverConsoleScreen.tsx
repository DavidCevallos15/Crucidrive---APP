import React, { useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  AppState,
} from 'react-native';
import MapView from '../components/Map';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { BlurContainer } from '../components/BlurContainer';
import { PressableScale } from '../components/PressableScale';
import { useLocation } from '../hooks/useLocation';
import { useSocket } from '../hooks/useSocket';
import { useMapRegion } from '../hooks/useMapRegion';
import { useConsolaConductor } from '../hooks/useConsolaConductor';
import { useSeguimientoFondo } from '../hooks/useSeguimientoFondo';
import { PermisoUbicacionScreen } from './PermisoUbicacionScreen';
import { canalUbicacion } from '../servicios/ubicacion';
import { debeSeguir } from '../utils/seguimiento';
import { AVISO_SEGUIMIENTO } from '../constants/permisoUbicacion';
import { useAuthStore } from '../store/useAuthStore';
import { COLORS, FONTS, SPACING, SHAPES } from '../constants/theme';
import { nombreSector } from '../utils/solicitud';
import {
  COLORES_OFERTA,
  textoDistancia,
  textoPunto,
  type EstadoTricimoto,
} from '../utils/oferta';

const TEXTO_ESTADO: Record<EstadoTricimoto, string> = {
  disponible: 'Disponible',
  inactivo: 'No disponible',
  ocupado: 'En un viaje',
};

/**
 * Pantalla de la Consola del Conductor.
 *
 * Funcionalidades:
 * - Interruptor de disponibilidad que cambia el estado en el servidor (paso 003, criterio 1)
 * - Mapa y envío de la ubicación GPS mientras está disponible
 * - Oferta entrante por socket con cuenta regresiva según el reloj del servidor (15, R14),
 *   Aceptar y Rechazar; se cierra sola si vence, la toma otro o el pasajero cancela (6, 12)
 * - Regla 6 (28): modal opaco sin blur, botones de 64 px, contraste AA y aviso de sin conexión
 *
 * Diseño: DESIGN.md §3.C — Consola del Conductor
 */
export const DriverConsoleScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const { userCoords, currentSectorId } = useLocation(true);
  const socket = useSocket();
  const { isConnected } = socket;
  const consola = useConsolaConductor(socket);
  const { estado, cambiando, oferta, segundos, aceptando, parametros } = consola;
  const disponible = estado === 'disponible';
  const seguimiento = useSeguimientoFondo(estado, parametros);

  // ─── Región del mapa ──────────────────────────────────────
  const region = useMapRegion(userCoords);

  // ─── Emitir ubicación GPS al backend con la app abierta ───
  // Disponible: sin ubicación reciente (60 s) no se reciben ofertas (criterio 2 del 003).
  // Ocupado: el pasajero ve al conductor (004, criterio 13). Por socket o, sin él, por REST (P11).
  // En segundo plano envía la tarea (src/tareas/ubicacionFondo.ts).
  const coordsRef = useRef(userCoords);
  coordsRef.current = userCoords;
  const seguir = debeSeguir(estado);
  useEffect(() => {
    if (!seguir) return;
    const enviar = () => {
      const coords = coordsRef.current;
      if (coords && AppState.currentState === 'active') void canalUbicacion.enviar(coords);
    };
    enviar();
    const interval = setInterval(enviar, parametros.abiertaSeg * 1000);
    return () => clearInterval(interval);
  }, [seguir, parametros.abiertaSeg]);

  // ─── Interruptor de disponibilidad ────────────────────────
  const handleToggleAvailability = useCallback(async (value: boolean) => {
    const resultado = await consola.cambiarDisponibilidad(value);
    if (!resultado.ok) Alert.alert('No se pudo cambiar', resultado.mensaje);
  }, [consola]);

  // ─── Aceptar y rechazar ───────────────────────────────────
  const handleAcceptRide = useCallback(async () => {
    const resultado = await consola.aceptar();
    if (resultado.ok) {
      Alert.alert('Viaje aceptado', 'Coordina con el pasajero desde la pestaña Chat.');
    } else {
      Alert.alert('No se pudo aceptar', resultado.mensaje);
    }
  }, [consola]);

  const textoEstado = estado ? TEXTO_ESTADO[estado] : 'Cargando…';
  const colorEstado = disponible ? COLORS.success : estado === 'ocupado' ? COLORS.secondary : COLORS.glassTextMutedDark;

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
        style={[styles.headerContainer, { top: insets.top + 12 }]}
      >
        <BlurContainer intensity={30} style={styles.header}>
          <View style={styles.headerContent}>
            {/* Info del conductor */}
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>
                {profile?.nombre ?? 'Conductor'}
              </Text>
              <Text style={[styles.statusLabel, { color: colorEstado }]} accessibilityLiveRegion="polite">
                {textoEstado}
              </Text>
            </View>

            {/* Switch de disponibilidad: el servidor decide (aprobado, sin viaje en curso) */}
            <View style={styles.switchContainer}>
              {cambiando ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Switch
                  value={disponible}
                  onValueChange={handleToggleAvailability}
                  disabled={estado === null || estado === 'ocupado' || !isConnected}
                  trackColor={{
                    false: 'rgba(255, 255, 255, 0.1)',
                    true: COLORS.success,
                  }}
                  thumbColor={COLORS.white}
                  ios_backgroundColor="rgba(255, 255, 255, 0.1)"
                  style={styles.switch}
                  accessibilityLabel={
                    disponible
                      ? 'Estado: Disponible. Desactiva para dejar de recibir viajes.'
                      : 'Estado: No disponible. Activa para recibir viajes.'
                  }
                />
              )}
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
              <Text style={styles.statValue} numberOfLines={1}>
                {nombreSector(currentSectorId) || '--'}
              </Text>
              <Text style={styles.statLabel}>Sector</Text>
            </View>
          </View>
        </BlurContainer>

        {/* Regla 6: el estado sin conexión siempre es visible */}
        {!isConnected && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline" size={18} color={COLORES_OFERTA.avisoTexto} />
            <Text style={styles.offlineText}>Sin conexión: no recibirás viajes</Text>
          </View>
        )}

        {/* Sin seguimiento en segundo plano: puede seguir con la app abierta (004, criterio 4) */}
        {seguimiento.aviso && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <Ionicons name="location-outline" size={18} color={COLORES_OFERTA.avisoTexto} />
            <Text style={styles.offlineText}>{AVISO_SEGUIMIENTO[seguimiento.aviso].texto}</Text>
            <PressableScale
              onPress={seguimiento.abrirAjustes}
              accessibilityRole="button"
              style={styles.bannerAction}
            >
              <Text style={styles.bannerActionText}>{AVISO_SEGUIMIENTO[seguimiento.aviso].accion}</Text>
            </PressableScale>
          </View>
        )}
      </Animated.View>

      {/* Explicación antes del permiso del sistema (004, criterio 5) */}
      <PermisoUbicacionScreen
        visible={seguimiento.explicando}
        onContinuar={seguimiento.continuar}
        onAhoraNo={seguimiento.ahoraNo}
      />

      {/* ─── MODAL: OFERTA DE VIAJE ───────────────────────── */}
      <Modal
        visible={oferta !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={consola.rechazar}
      >
        <View style={styles.modalOverlay}>
          {oferta && (
            <View style={styles.requestCard} accessibilityViewIsModal>
              {/* Cuenta regresiva según el servidor */}
              <View style={styles.countdownContainer}>
                <Text
                  style={styles.countdownText}
                  accessibilityLabel={`Quedan ${segundos} segundos`}
                >
                  {segundos}
                </Text>
                <Text style={styles.countdownLabel}>segundos</Text>
              </View>

              <Text style={styles.requestTitle} accessibilityRole="header">¡Nuevo viaje!</Text>
              {oferta.fase === 'abierta' && (
                <Text style={styles.requestSubtitle}>Aviso a varios: gana el primero que acepte</Text>
              )}
              {textoDistancia(oferta.distanciaM) !== '' && (
                <Text style={styles.requestSubtitle}>
                  El pasajero está {textoDistancia(oferta.distanciaM)}
                </Text>
              )}

              {/* Detalles de la ruta */}
              <View style={styles.requestRoute}>
                <View style={styles.requestRouteRow}>
                  <Ionicons name="radio-button-on" size={16} color={COLORS.primaryLight} />
                  <Text style={styles.requestRouteText}>{textoPunto(oferta.origen)}</Text>
                </View>
                <View style={styles.requestRouteLine} />
                <View style={styles.requestRouteRow}>
                  <Ionicons name="location" size={16} color={COLORES_OFERTA.cuenta} />
                  <Text style={styles.requestRouteText}>{textoPunto(oferta.destino)}</Text>
                </View>
              </View>

              {/* Total (lo fija la BD) y personas */}
              <Text style={styles.requestPrice}>${oferta.tarifa.toFixed(2)}</Text>
              <Text style={styles.requestSubtitle}>
                {oferta.pasajeros} {oferta.pasajeros === 1 ? 'persona' : 'personas'}
              </Text>

              {!isConnected && (
                <View style={[styles.offlineBanner, styles.offlineInModal]} accessibilityRole="alert">
                  <Ionicons name="cloud-offline" size={18} color={COLORES_OFERTA.avisoTexto} />
                  <Text style={styles.offlineText}>Sin conexión: no se puede aceptar</Text>
                </View>
              )}

              {/* Botones grandes para tocarlos sin mirar dos veces */}
              <View style={styles.actionButtons}>
                <PressableScale
                  onPress={consola.rechazar}
                  accessibilityRole="button"
                  accessibilityLabel="Rechazar viaje"
                  style={[styles.actionButton, styles.rejectButton]}
                >
                  <Ionicons name="close" size={24} color={COLORES_OFERTA.rechazarTexto} />
                  <Text style={[styles.actionText, { color: COLORES_OFERTA.rechazarTexto }]}>Rechazar</Text>
                </PressableScale>
                <PressableScale
                  onPress={handleAcceptRide}
                  disabled={aceptando || !isConnected}
                  accessibilityRole="button"
                  accessibilityLabel="Aceptar viaje"
                  accessibilityState={{ disabled: aceptando || !isConnected, busy: aceptando }}
                  style={[styles.actionButton, styles.acceptButton, !isConnected && styles.actionDisabled]}
                >
                  {aceptando ? (
                    <ActivityIndicator color={COLORES_OFERTA.aceptarTexto} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={24} color={COLORES_OFERTA.aceptarTexto} />
                      <Text style={[styles.actionText, { color: COLORES_OFERTA.aceptarTexto }]}>Aceptar</Text>
                    </>
                  )}
                </PressableScale>
              </View>
            </View>
          )}
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

  // ─── Sin conexión (regla 6) ──────────────────────────────
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORES_OFERTA.avisoFondo,
  },
  bannerAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: 1,
    borderColor: COLORES_OFERTA.avisoTexto,
  },
  bannerActionText: {
    color: COLORES_OFERTA.avisoTexto,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.bold,
  },
  offlineInModal: {
    alignSelf: 'stretch',
    marginTop: 0,
    marginBottom: SPACING.md,
  },
  offlineText: {
    flex: 1,
    color: COLORES_OFERTA.avisoTexto,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
  },

  // ─── Modal de oferta: opaco y sin blur (regla 6) ─────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  requestCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: SHAPES.borderRadiusLg,
    borderWidth: 2,
    borderColor: COLORES_OFERTA.cuenta,
    backgroundColor: COLORES_OFERTA.fondo,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  countdownText: {
    fontSize: 56,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORES_OFERTA.cuenta,
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORES_OFERTA.textoSuave,
  },
  requestTitle: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORES_OFERTA.texto,
  },
  requestSubtitle: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORES_OFERTA.textoSuave,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  requestRoute: {
    marginVertical: SPACING.md,
    alignSelf: 'stretch',
  },
  requestRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  requestRouteLine: {
    width: 2,
    height: 14,
    backgroundColor: COLORES_OFERTA.textoSuave,
    marginLeft: 7,
  },
  requestRouteText: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.body,
    color: COLORES_OFERTA.texto,
    marginLeft: SPACING.sm,
  },
  requestPrice: {
    fontSize: FONTS.sizes.title,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORES_OFERTA.cuenta,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignSelf: 'stretch',
    marginTop: SPACING.lg,
  },
  actionButton: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: SHAPES.borderRadiusFull,
  },
  rejectButton: {
    backgroundColor: COLORES_OFERTA.rechazarFondo,
  },
  acceptButton: {
    backgroundColor: COLORES_OFERTA.aceptarFondo,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
  },
});

export default DriverConsoleScreen;

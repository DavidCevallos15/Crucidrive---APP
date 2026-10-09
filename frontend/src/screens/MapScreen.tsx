import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import MapView, { Marker } from '../components/Map';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { BlurContainer } from '../components/BlurContainer';
import { PressableScale } from '../components/PressableScale';
import { PanicButton } from '../components/PanicButton';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useLocation } from '../hooks/useLocation';
import { useSocket } from '../hooks/useSocket';
import { useTariff } from '../hooks/useTariff';
import { useMapRegion } from '../hooks/useMapRegion';
import { useViajePasajero } from '../hooks/useViajePasajero';
import { useConductorDelViaje } from '../hooks/useConductorDelViaje';
import { puntoDeOrigen } from '../utils/conductorDelViaje';
import { distanciaMetros } from '../utils/geo';
import { textoDistancia } from '../utils/oferta';
import { useLocationStore, type NearbyDriver } from '../store/useLocationStore';
import { useRideStore, type ActiveRide } from '../store/useRideStore';
import { SECTORS, MAX_PASSENGERS } from '../constants/sectors';
import { COLORS, FONTS, SPACING, SHAPES, Z_INDEX } from '../constants/theme';
import { PANEL_IN, PANEL_OUT } from '../constants/motion';
import { rutaInicial } from '../utils/routing';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { GlassInput } from '../components/GlassInput';
import { useBuscarLugares } from '../hooks/useBuscarLugares';
import { ATRIBUCION_OSM, ICONO_CATEGORIA, type Lugar } from '../utils/lugares';
import {
  nombreDestino,
  nombreOrigen,
  nombreSector,
  resolverOrigen,
  sectorDeOrigen,
  type Destino,
  type Gps,
  type Origen,
} from '../utils/solicitud';

/** Panel visible cuando no hay un viaje en marcha. */
type Panel = 'destino' | 'origen' | 'ficha';

/**
 * Pantalla principal del mapa para el pasajero.
 *
 * Muestra:
 * - Mapa interactivo a pantalla completa con marcadores de tricimotos
 * - Píldora de estado con el sector donde estás
 * - Elección de destino y de origen (GPS, lugar o sector; paso 003, criterio 21)
 * - Ficha con el total (0,50 USD por persona) y el estado de la solicitud:
 *   "Buscando tricimoto…", "sin conductor" con "Volver a pedir" y "aceptado" (criterios 10, 11, 16)
 * - Botón de Pánico (SOS) flotante
 *
 * Diseño: DESIGN.md §3.B — Panel del Mapa y Ficha de Destino
 */
export const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((st) => st.session);
  const authProfile = useAuthStore((st) => st.profile);
  const authVerification = useAuthStore((st) => st.verification);
  const { userCoords, currentSectorId, hasPermission } = useLocation(false);
  const socket = useSocket();
  const { joinSector, onEvent } = socket;
  const viaje = useViajePasajero(socket);
  const nearbyDrivers = useLocationStore((s) => s.nearbyDrivers);
  const updateNearbyDriver = useLocationStore((s) => s.updateNearbyDriver);
  const activeRide = useRideStore((s) => s.activeRide);
  const isRequesting = useRideStore((s) => s.isRequesting);
  const ultimaSolicitud = useRideStore((s) => s.ultimaSolicitud);
  const conductorDelViaje = useConductorDelViaje(socket);

  const [panel, setPanel] = useState<Panel>('destino');
  const [destino, setDestino] = useState<Destino | null>(null);
  // Origen elegido a mano; null = el GPS (criterio 21).
  const [origenElegido, setOrigenElegido] = useState<Origen | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [destinationNote, setDestinationNote] = useState('');
  const [originNote, setOriginNote] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const busqueda = useBuscarLugares();

  const { formattedPrice, formattedPricePerPerson } = useTariff(passengers);

  const gps: Gps = useMemo(
    () => (userCoords && currentSectorId ? { coords: userCoords, sectorId: currentSectorId } : null),
    [userCoords, currentSectorId]
  );
  const origen = resolverOrigen(origenElegido, gps);

  // Distancia en línea recta del conductor al punto de partida (004, criterio 13; P17).
  const posicionConductor = conductorDelViaje.posicion;
  const distanciaConductor = useMemo(() => {
    const partida = puntoDeOrigen(ultimaSolicitud?.origen, gps);
    return posicionConductor && partida ? distanciaMetros(posicionConductor, partida) : null;
  }, [posicionConductor, ultimaSolicitud, gps]);

  const statusText = currentSectorId
    ? `Estás en ${nombreSector(currentSectorId)}`
    : hasPermission
      ? 'Buscando tu ubicación...'
      : 'Activa tu ubicación';

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

  // ─── Elegir destino u origen ──────────────────────────────
  const abrirPanel = useCallback((siguiente: Panel) => {
    busqueda.limpiar();
    setPanel(siguiente);
  }, [busqueda]);

  // Con un lugar, el servidor toma sus coordenadas y su sector (criterio 19).
  const elegirDestino = useCallback((d: Destino) => {
    setDestino(d);
    abrirPanel('ficha');
  }, [abrirPanel]);

  const elegirOrigen = useCallback((o: Origen | null) => {
    setOrigenElegido(o);
    if (o?.tipo !== 'sector') setOriginNote('');
    abrirPanel(destino ? 'ficha' : 'destino');
  }, [abrirPanel, destino]);

  const elegirLugar = useCallback((lugar: Lugar) => {
    if (panel === 'origen') elegirOrigen({ tipo: 'lugar', lugar });
    else elegirDestino({ tipo: 'lugar', lugar });
  }, [panel, elegirOrigen, elegirDestino]);

  const elegirSector = useCallback((sectorId: string) => {
    if (panel === 'origen') elegirOrigen({ tipo: 'sector', sectorId });
    else elegirDestino({ tipo: 'sector', sectorId });
  }, [panel, elegirOrigen, elegirDestino]);

  const reiniciarFicha = useCallback(() => {
    setDestino(null);
    setPassengers(1);
    setDestinationNote('');
    abrirPanel('destino');
  }, [abrirPanel]);

  // ─── Solicitar, cancelar y volver a pedir ─────────────────
  const avisarSiFalla = (resultado: { ok: true } | { ok: false; mensaje: string }) => {
    if (!resultado.ok) Alert.alert('No se pudo completar', resultado.mensaje);
  };

  const handleRequestRide = useCallback(async () => {
    // Pedir un viaje requiere cuenta: un visitante pasa primero por el inicio de sesión.
    if (!session) {
      router.push('/(auth)/login');
      return;
    }
    if (!origen || !destino) return;
    avisarSiFalla(
      await viaje.solicitar({
        origen,
        destino,
        pasajeros: passengers,
        origenNota: origen.tipo === 'sector' ? originNote : '',
        destinoNota: destinationNote,
      })
    );
  }, [session, router, origen, destino, passengers, originNote, destinationNote, viaje]);

  const handleCancelRequest = useCallback(async () => {
    setCancelando(true);
    avisarSiFalla(await viaje.cancelar());
    setCancelando(false);
  }, [viaje]);

  const handleRetry = useCallback(async () => {
    avisarSiFalla(await viaje.volverAPedir(gps));
  }, [viaje, gps]);

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

  // ─── Sectores a elegir (el destino excluye el sector de origen) ─
  const sectorOrigen = sectorDeOrigen(origen);
  const sectoresDelPanel = useMemo(
    () => (panel === 'origen' ? SECTORS : SECTORS.filter((s) => s.id !== sectorOrigen)),
    [panel, sectorOrigen]
  );

  const filaOrigen = (
    <View style={styles.routeRow}>
      <Ionicons name={origen?.tipo === 'gps' ? 'navigate' : 'radio-button-on'} size={16} color={COLORS.success} />
      <Text style={[styles.routeText, !origen && styles.routeTextMissing]} numberOfLines={1}>
        {origen ? `Desde: ${nombreOrigen(origen)}` : 'Sin GPS: elige desde dónde sales'}
      </Text>
      <PressableScale
        onPress={() => abrirPanel('origen')}
        accessibilityRole="button"
        accessibilityLabel={origen ? 'Cambiar el punto de partida' : 'Elegir el punto de partida'}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>{origen ? 'Cambiar' : 'Elegir'}</Text>
      </PressableScale>
    </View>
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

        {/* Tu conductor durante el viaje (004, criterio 13): solo tú lo ves */}
        {posicionConductor && (
          <Marker
            coordinate={{ latitude: posicionConductor.lat, longitude: posicionConductor.lng }}
            title={activeRide?.driver?.nombre ?? 'Tu conductor'}
            description={activeRide?.driver?.placa ? `Placa ${activeRide.driver.placa}` : undefined}
          >
            <View style={[styles.driverMarker, styles.myDriverMarker]}>
              <Ionicons name="car" size={20} color={COLORS.darkBg} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ─── ESTADO DE UBICACIÓN ───────────────────────────── */}
      <Animated.View
        entering={PANEL_IN}
        style={[styles.statusContainer, { top: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <View style={styles.statusRow}>
        <BlurContainer intensity={30} style={styles.statusPill}>
          <Ionicons
            name={currentSectorId ? 'location' : 'location-outline'}
            size={18}
            color={currentSectorId ? COLORS.primaryLight : COLORS.secondaryLight}
          />
          <Text style={styles.statusText} numberOfLines={1}>
            {statusText}
          </Text>
        </BlurContainer>
        <PressableScale
          onPress={() =>
            router.push(
              (session && authProfile
                ? rutaInicial(authProfile.rol, authVerification?.estado ?? null)
                : '/(auth)/login') as never
            )
          }
          accessibilityRole="button"
          accessibilityLabel={session ? 'Mi cuenta' : 'Iniciar sesión'}
          style={styles.accountButton}
        >
          <Ionicons name={session ? 'person-circle' : 'log-in'} size={20} color={COLORS.white} />
          <Text style={styles.accountText}>{session ? 'Mi cuenta' : 'Entrar'}</Text>
        </PressableScale>
        </View>
      </Animated.View>

      {/* ─── ELEGIR DESTINO U ORIGEN ───────────────────────── */}
      {!activeRide && panel !== 'ficha' && (
        <Animated.View
          key={panel}
          entering={PANEL_IN}
          exiting={PANEL_OUT}
          style={styles.destinationContainer}
        >
          <GlassCard
            style={styles.destinationCard}
            noPadding
          >
            <View style={[styles.sheetBody, { paddingBottom: insets.bottom + SPACING.md }]}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {panel === 'origen' ? '¿Desde dónde sales?' : '¿A dónde vas?'}
            </Text>
            {panel === 'destino' && filaOrigen}
            {panel === 'origen' && gps && (
              <GlassButton
                label={`Usar mi ubicación (${nombreSector(gps.sectorId)})`}
                onPress={() => elegirOrigen(null)}
                variant="ghost"
                size="md"
                leftIcon={<Ionicons name="navigate" size={18} color={COLORS.success} />}
                style={styles.destinationButton}
              />
            )}
            <GlassInput
              label="Busca un lugar"
              placeholder="Farmacia, muelle, letras…"
              value={busqueda.texto}
              onChangeText={busqueda.escribir}
              autoCorrect={false}
              returnKeyType="search"
              maxLength={80}
              accessibilityHint="Escribe al menos 2 letras"
            />
            {busqueda.cargando && (
              <Text style={styles.searchHint}>Buscando…</Text>
            )}
            {busqueda.error && (
              <Text style={styles.searchHint} accessibilityLiveRegion="polite">{busqueda.error}</Text>
            )}
            {busqueda.buscado && !busqueda.error && busqueda.resultados.length === 0 && (
              <Text style={styles.searchHint} accessibilityLiveRegion="polite">
                No encontramos «{busqueda.texto.trim()}». Elige el sector y escribe una referencia.
              </Text>
            )}
            {busqueda.resultados.length > 0 && (
              <>
                <ScrollView style={styles.placeList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {busqueda.resultados.map((lugar) => (
                    <PressableScale
                      key={lugar.id}
                      onPress={() => elegirLugar(lugar)}
                      accessibilityRole="button"
                      accessibilityLabel={`${lugar.nombre}, ${nombreSector(lugar.sector_id)}`}
                      style={styles.placeRow}
                    >
                      <Ionicons
                        name={ICONO_CATEGORIA[lugar.categoria] as keyof typeof Ionicons.glyphMap}
                        size={18}
                        color={COLORS.primaryLight}
                      />
                      <View style={styles.placeText}>
                        <Text style={styles.placeName} numberOfLines={1}>{lugar.nombre}</Text>
                        <Text style={styles.placeSector} numberOfLines={1}>{nombreSector(lugar.sector_id)}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </ScrollView>
                <Text style={styles.attribution}>{ATRIBUCION_OSM}</Text>
              </>
            )}
            <Text style={styles.sectorsTitle}>O elige un sector</Text>
            {sectoresDelPanel.map((sector) => (
              <GlassButton
                key={sector.id}
                label={sector.name}
                onPress={() => elegirSector(sector.id)}
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
            {panel === 'origen' && (
              <GlassButton
                label="Volver"
                onPress={() => abrirPanel(destino ? 'ficha' : 'destino')}
                variant="ghost"
                size="sm"
                style={styles.cancelButton}
              />
            )}
            </View>
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── BOTTOM SHEET: FICHA DE VIAJE ─────────────────── */}
      {!activeRide && panel === 'ficha' && (
        <Animated.View
          entering={PANEL_IN}
          exiting={PANEL_OUT}
          style={styles.rideSheetContainer}
        >
          <GlassCard style={styles.rideSheet} noPadding>
            <View style={[styles.sheetBody, { paddingBottom: insets.bottom + SPACING.md }]}>
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
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Quitar un pasajero"
                  disabled={passengers <= 1}
                  pressedScale={0.92}
                  onPress={() => setPassengers((n) => Math.max(1, n - 1))}
                  style={[styles.stepperButton, passengers <= 1 && styles.stepperDisabled]}
                >
                  <Ionicons name="remove" size={22} color={COLORS.white} />
                </PressableScale>
                <Text style={styles.stepperValue}>{passengers}</Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Agregar un pasajero"
                  disabled={passengers >= MAX_PASSENGERS}
                  pressedScale={0.92}
                  onPress={() => setPassengers((n) => Math.min(MAX_PASSENGERS, n + 1))}
                  style={[styles.stepperButton, passengers >= MAX_PASSENGERS && styles.stepperDisabled]}
                >
                  <Ionicons name="add" size={22} color={COLORS.white} />
                </PressableScale>
              </View>
              {filaOrigen}
              {origen?.tipo === 'sector' && (
                <TextInput
                  value={originNote}
                  onChangeText={setOriginNote}
                  placeholder="¿Dónde te recogen? (opcional)"
                  placeholderTextColor={COLORS.glassTextMutedDark}
                  maxLength={200}
                  accessibilityLabel="Referencia del punto de partida"
                  style={styles.noteInput}
                />
              )}
              <View style={styles.routeRow}>
                <Ionicons name="location" size={16} color={COLORS.secondary} />
                <Text style={styles.routeText} numberOfLines={1}>
                  Hasta: {nombreDestino(destino)}
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
            <GlassButton
              label="Solicitar Tricimoto"
              onPress={handleRequestRide}
              variant="secondary"
              size="lg"
              loading={isRequesting}
              disabled={!origen || !destino}
              leftIcon={
                <Ionicons name="car" size={20} color={COLORS.darkBg} />
              }
              style={styles.requestButton}
            />

            {/* Botón de cancelar */}
            <GlassButton
              label="Cancelar"
              onPress={reiniciarFicha}
              variant="ghost"
              size="sm"
              style={styles.cancelButton}
            />
            </View>
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── ESTADO DEL VIAJE ─────────────────────────────── */}
      {activeRide && (
        <Animated.View
          key={activeRide.status}
          entering={PANEL_IN}
          exiting={PANEL_OUT}
          style={styles.rideSheetContainer}
        >
          <GlassCard style={styles.rideSheet} noPadding>
            <View
              style={[styles.sheetBody, { paddingBottom: insets.bottom + SPACING.md }]}
              accessibilityLiveRegion="polite"
            >
              <EstadoViaje
                ride={activeRide}
                distanciaConductor={distanciaConductor}
                antiguedad={conductorDelViaje.antiguedad}
                isRequesting={isRequesting}
                cancelando={cancelando}
                onCancelar={handleCancelRequest}
                onVolverAPedir={handleRetry}
                onCambiar={() => {
                  viaje.descartar();
                  abrirPanel(destino ? 'ficha' : 'destino');
                }}
                onChat={() => router.push('/(app)/(passenger)/chat' as never)}
              />
            </View>
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── BOTÓN DE PÁNICO (SOS) ────────────────────────── */}
      <PanicButton onActivate={handlePanic} />
    </View>
  );
};

/** Ruta resumida del viaje: origen → destino. */
const Ruta: React.FC<{ ride: ActiveRide }> = ({ ride }) => (
  <View style={styles.routeRow}>
    <Ionicons name="location" size={16} color={COLORS.success} />
    <Text style={styles.routeText} numberOfLines={2}>
      {ride.originName || nombreSector(ride.originSectorId)} → {ride.destinationName || nombreSector(ride.destinationSectorId)}
    </Text>
  </View>
);

interface EstadoViajeProps {
  ride: ActiveRide;
  /** Metros en línea recta del conductor al punto de partida; null si aún no hay posición. */
  distanciaConductor: number | null;
  /** "Última posición hace X s" si los datos no son frescos (criterio 17). */
  antiguedad: string;
  isRequesting: boolean;
  cancelando: boolean;
  onCancelar: () => void;
  onVolverAPedir: () => void;
  onCambiar: () => void;
  onChat: () => void;
}

/**
 * Lo que ve el pasajero tras pedir (paso 003): buscando con Cancelar (criterios 12 y 16),
 * sin conductor con "Volver a pedir" (11) y aceptado con nombre, placa y teléfono (10).
 */
const EstadoViaje: React.FC<EstadoViajeProps> = ({
  ride, distanciaConductor, antiguedad, isRequesting, cancelando, onCancelar, onVolverAPedir, onCambiar, onChat,
}) => {
  if (ride.status === 'solicitado') {
    return (
      <>
        <LoadingSpinner message="Buscando tricimoto…" />
        <Ruta ride={ride} />
        <GlassButton
          label="Cancelar solicitud"
          onPress={onCancelar}
          variant="danger"
          size="lg"
          loading={cancelando}
          style={styles.stateButton}
        />
      </>
    );
  }

  if (ride.status === 'sin_conductor') {
    return (
      <>
        <View style={styles.stateHeader}>
          <Ionicons name="alert-circle" size={28} color={COLORS.secondaryLight} />
          <Text style={styles.stateTitle} accessibilityRole="header">
            No hay tricimotos disponibles ahora
          </Text>
        </View>
        <Ruta ride={ride} />
        <GlassButton
          label="Volver a pedir"
          onPress={onVolverAPedir}
          variant="secondary"
          size="lg"
          loading={isRequesting}
          leftIcon={<Ionicons name="refresh" size={20} color={COLORS.darkBg} />}
          style={styles.stateButton}
        />
        <GlassButton
          label="Cambiar el viaje"
          onPress={onCambiar}
          variant="ghost"
          size="sm"
          style={styles.cancelButton}
        />
      </>
    );
  }

  // aceptado o en_curso (las pantallas del viaje en curso son del paso 005).
  const conductor = ride.driver;
  return (
    <>
      <View style={styles.stateHeader}>
        <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
        <Text style={styles.stateTitle} accessibilityRole="header">
          {ride.status === 'en_curso' ? 'Viaje en curso' : 'Tu tricimoto va en camino'}
        </Text>
      </View>
      <View style={styles.routeRow}>
        <Ionicons name="person" size={16} color={COLORS.primaryLight} />
        <Text style={styles.routeText} numberOfLines={1}>{conductor?.nombre ?? 'Conductor asignado'}</Text>
      </View>
      {conductor?.placa && (
        <View style={styles.routeRow}>
          <Ionicons name="card" size={16} color={COLORS.primaryLight} />
          <Text style={styles.routeText}>Placa {conductor.placa}</Text>
        </View>
      )}
      {distanciaConductor !== null && ride.status === 'aceptado' && (
        <View style={styles.routeRow}>
          <Ionicons name="navigate" size={16} color={COLORS.secondaryLight} />
          <Text style={styles.routeText}>Tu conductor está {textoDistancia(distanciaConductor)}</Text>
        </View>
      )}
      {antiguedad !== '' && (
        <Text style={styles.staleText} accessibilityLiveRegion="polite">{antiguedad}</Text>
      )}
      <Ruta ride={ride} />
      {conductor?.telefono && (
        <GlassButton
          label={`Llamar ${conductor.telefono}`}
          onPress={() => void Linking.openURL(`tel:${conductor.telefono}`)}
          variant="secondary"
          size="lg"
          leftIcon={<Ionicons name="call" size={20} color={COLORS.darkBg} />}
          style={styles.stateButton}
        />
      )}
      {ride.chatThreadId && (
        <GlassButton
          label="Abrir chat"
          onPress={onChat}
          variant="ghost"
          size="md"
          leftIcon={<Ionicons name="chatbubbles" size={18} color={COLORS.white} />}
          style={styles.cancelButton}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  // ─── Buscador de lugares (paso 003) ─────────────────────
  searchHint: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginBottom: SPACING.sm,
  },
  placeList: {
    maxHeight: 220,
    marginBottom: SPACING.xs,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.glassBorderDark,
  },
  placeText: {
    flex: 1,
  },
  placeName: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
  },
  placeSector: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
  },
  attribution: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  sectorsTitle: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },

  // ─── Estado de ubicación ────────────────────────────────
  statusContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: Z_INDEX.searchBar,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: SHAPES.borderRadiusFull,
    borderWidth: 1,
    borderColor: COLORS.glassBorderDark,
  },
  statusText: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginLeft: SPACING.sm,
    flexShrink: 1,
  },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: SHAPES.borderRadiusFull,
    backgroundColor: COLORS.primary,
    gap: SPACING.xs,
  },
  accountText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
  },
  sheetBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // ─── Selector de destino ─────────────────────────────────
  destinationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: Z_INDEX.bottomSheet,
  },
  destinationCard: {
    width: '100%',
    maxWidth: 520,
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
    alignItems: 'center',
    zIndex: Z_INDEX.bottomSheet,
  },
  rideSheet: {
    width: '100%',
    maxWidth: 520,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
    fontVariant: ['tabular-nums'],
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
    fontVariant: ['tabular-nums'],
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
  routeTextMissing: {
    color: COLORS.secondaryLight,
  },
  linkButton: {
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
  },
  linkText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
  },

  // ─── Estado del viaje (paso 003) ────────────────────────
  stateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  stateTitle: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
  },
  stateButton: {
    alignSelf: 'stretch',
    marginTop: SPACING.md,
  },
  cancelButton: {
    marginTop: SPACING.sm,
    alignSelf: 'center',
  },

  // ─── Marcadores de conductores ──────────────────────────
  myDriverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  staleText: {
    color: COLORS.secondaryLight,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginBottom: SPACING.xs,
  },
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

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Alert,
  Linking,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import MapView, { Marker } from '../components/Map';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { PressableScale } from '../components/PressableScale';
import { PanicButton } from '../components/PanicButton';
import { TricimotoIcon } from '../components/TricimotoIcon';
import { AppMenuButton } from '../components/AppMenuButton';
import { CheckboxRow } from '../components/CheckboxRow';
import { useServiceStore } from '../store/useServiceStore';
import { validateParcel } from '../utils/encomienda';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useLocation } from '../hooks/useLocation';
import { useSocket } from '../hooks/useSocket';
import { useTariff } from '../hooks/useTariff';
import { useMapRegion } from '../hooks/useMapRegion';
import { useViajePasajero } from '../hooks/useViajePasajero';
import { useConductorDelViaje } from '../hooks/useConductorDelViaje';
import { puntoDeOrigen } from '../utils/conductorDelViaje';
import { distanciaMetros } from '../utils/geo';
import { useLocationStore, type NearbyDriver } from '../store/useLocationStore';
import { useRideStore, type ActiveRide } from '../store/useRideStore';
import { SECTORS, MAX_PASSENGERS } from '../constants/sectors';
import { COLORS, FONTS, SPACING, SHAPES, Z_INDEX } from '../constants/theme';
import { PANEL_IN, PANEL_OUT } from '../constants/motion';
import { AVISO_FUERA_ZONA, estadoZona, gpsDeServicio } from '../utils/zonaServicio';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { separacionInferior } from '../utils/barraPestanas';
import { altoMaximoHoja, esCompacta } from '../utils/compacto';
import { HojaDesplazable } from '../components/HojaDesplazable';
import { HojaCierreViaje } from '../components/HojaCierreViaje';
import { TarjetaViajePasajero } from '../components/TarjetaViajePasajero';
import { MotivoCancelacion } from '../components/MotivoCancelacion';
import { ADVERTENCIA_TERMINAR, TEXTO_CANCELAR_PASAJERO, textoSancion } from '../utils/viajePasajero';
import { motivosPara, type MotivoCancelacion as Motivo } from '../utils/viajeConductor';
import { GlassInput } from '../components/GlassInput';
import { useBuscarLugares } from '../hooks/useBuscarLugares';
import { ATRIBUCION_OSM, ICONO_CATEGORIA, type Lugar } from '../utils/lugares';
import {
  nombreDestino,
  nombreOrigen,
  nombreSector,
  nombreLibreValido,
  referenciaEnSector,
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
 * - Sector y SOS en la cabecera fija de la hoja inferior
 * - Elección de destino y de origen (GPS, lugar o sector; paso 003, criterio 21)
 * - Ficha con el total (0,50 USD por persona) y el estado de la solicitud:
 *   "Buscando tricimoto…", "sin conductor" con "Volver a pedir" y "aceptado" (criterios 10, 11, 16)
 *
 * Diseño: DESIGN.md §3.B — Panel del Mapa y Ficha de Destino
 */
export const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Con sesión hay barra de pestañas (absoluta): las hojas suben lo que ella mide.
  const conBarra = useAuthStore((st) => Boolean(st.session));
  const separacion = separacionInferior(conBarra, insets.bottom);
  const [safetyHeight, setSafetyHeight] = useState(96);
  const sheetMaxHeight = Math.max(120, height - insets.top - (conBarra ? separacion : insets.bottom) - 132 - safetyHeight);
  // Panel de destino u origen: deja a la vista al menos un 35 % del mapa (010, criterio 2).
  const panelMaxHeight = Math.max(120, altoMaximoHoja(height, conBarra ? separacion : insets.bottom) - safetyHeight);
  const compacta = esCompacta(height);
  const service = useServiceStore((s) => s.service);
  const selectService = useServiceStore((s) => s.selectService);
  const isParcel = service === 'encomienda';
  const [parcelDescription, setParcelDescription] = useState('');
  const [recipient, setRecipient] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [parcelError, setParcelError] = useState<string | null>(null);
  const router = useRouter();
  const session = useAuthStore((st) => st.session);
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
  const [referenciaLibre, setReferenciaLibre] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  // Origen elegido a mano; null = el GPS (criterio 21).
  const [origenElegido, setOrigenElegido] = useState<Origen | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [destinationNote, setDestinationNote] = useState('');
  const [originNote, setOriginNote] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [terminando, setTerminando] = useState(false);
  const busqueda = useBuscarLugares();

  const { formattedPrice, formattedPricePerPerson } = useTariff(passengers);

  const zona = estadoZona(userCoords);
  const fueraDeZona = zona === 'fuera';
  const gps: Gps = useMemo(
    () => gpsDeServicio(userCoords, currentSectorId),
    [userCoords, currentSectorId]
  );
  const origen = resolverOrigen(origenElegido, gps);

  // Distancia en línea recta del conductor al punto de partida (004, criterio 13; P17).
  const posicionConductor = conductorDelViaje.posicion;
  const distanciaConductor = useMemo(() => {
    const partida = puntoDeOrigen(ultimaSolicitud?.origen, gps);
    return posicionConductor && partida ? distanciaMetros(posicionConductor, partida) : null;
  }, [posicionConductor, ultimaSolicitud, gps]);

  const statusText = fueraDeZona ? AVISO_FUERA_ZONA : currentSectorId
    ? `Estás en ${nombreSector(currentSectorId)}`
    : hasPermission
      ? 'Buscando tu ubicación...'
      : 'Activa tu ubicación';

  // ─── Región inicial del mapa ───────────────────────────────
  const initialRegion = useMapRegion(zona === 'dentro' ? userCoords : null);

  // ─── Suscribirse al sector cuando se determina ────────────
  useEffect(() => {
    if (currentSectorId && !fueraDeZona) {
      joinSector(currentSectorId);
    }
  }, [currentSectorId, fueraDeZona, joinSector]);

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
    setReferenciaLibre(null);
    setPanel(siguiente);
  }, [busqueda]);

  // Con un lugar, el servidor toma sus coordenadas y su sector (criterio 19).
  const elegirDestino = useCallback((d: Destino) => {
    setDestino(d);
    setDestinationNote('');
    abrirPanel('ficha');
  }, [abrirPanel]);

  const elegirOrigen = useCallback((o: Origen | null) => {
    setOrigenElegido(o);
    setOriginNote('');
    abrirPanel(destino ? 'ficha' : 'destino');
  }, [abrirPanel, destino]);

  const elegirLugar = useCallback((lugar: Lugar) => {
    if (panel === 'origen') elegirOrigen({ tipo: 'lugar', lugar });
    else elegirDestino({ tipo: 'lugar', lugar });
  }, [panel, elegirOrigen, elegirDestino]);

  const elegirSector = useCallback((sectorId: string) => {
    const libre = referenciaLibre !== null ? referenciaEnSector(referenciaLibre, sectorId) : null;
    if (referenciaLibre !== null && !libre) return;
    if (panel === 'origen') {
      elegirOrigen(libre?.punto ?? { tipo: 'sector', sectorId });
      if (libre) setOriginNote(libre.nota);
    } else {
      elegirDestino(libre?.punto ?? { tipo: 'sector', sectorId });
      if (libre) setDestinationNote(libre.nota);
    }
  }, [panel, referenciaLibre, elegirOrigen, elegirDestino]);

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
    const parcel = { descripcion: parcelDescription.trim(), destinatario: recipient.trim(), autorizado: authorized };
    if (isParcel) {
      const error = validateParcel(parcel);
      setParcelError(error);
      if (error) return;
    }
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
        pasajeros: isParcel ? 1 : passengers,
        tipoServicio: service,
        ...(isParcel ? { encomienda: parcel } : {}),
        origenNota: origen.tipo === 'sector' ? originNote : '',
        destinoNota: destinationNote,
      })
    );
  }, [session, router, origen, destino, passengers, originNote, destinationNote, viaje, isParcel, service, parcelDescription, recipient, authorized]);

  const handleCancelRequest = useCallback(async () => {
    setCancelando(true);
    avisarSiFalla(await viaje.cancelar());
    setCancelando(false);
  }, [viaje]);

  /** Cancelar con el viaje ya aceptado: elegir el motivo es la confirmación (criterio 8). */
  const handleCancelarConMotivo = useCallback(async (motivo: Motivo) => {
    setEligiendoMotivo(false);
    setCancelando(true);
    avisarSiFalla(await viaje.cancelar(motivo));
    setCancelando(false);
  }, [viaje]);

  /** El pasajero termina el viaje él mismo: advertencia antes, y cuántas lleva después (5b y 5c). */
  const handleTerminar = useCallback(() => {
    Alert.alert('¿Terminar el viaje tú mismo?', ADVERTENCIA_TERMINAR, [
      { text: 'Seguir en el viaje', style: 'cancel' },
      {
        text: 'Terminar viaje',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setTerminando(true);
            const r = await viaje.terminarComoPasajero();
            setTerminando(false);
            if (!r.ok) avisarSiFalla(r);
            else Alert.alert('Terminaste el viaje', r.sancion ? textoSancion(r.sancion) : 'Queda registrado.');
          })();
        },
      },
    ]);
  }, [viaje]);

  const handleRetry = useCallback(async () => {
    avisarSiFalla(await viaje.volverAPedir(gps));
  }, [viaje, gps]);

  // ─── Activar botón de pánico ──────────────────────────────
  const handlePanic = useCallback(async () => {
    try {
      await Linking.openURL('tel:911');
    } catch (error) {
      console.error('[SOS] Error al activar pánico:', error);
      Alert.alert('Llama al 911', 'No se pudo abrir la llamada. Marca 911 desde tu teléfono.');
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
    () => (panel === 'origen' || referenciaLibre !== null ? SECTORS : SECTORS.filter((s) => s.id !== sectorOrigen)),
    [panel, sectorOrigen, referenciaLibre]
  );

  const filaOrigen = (
    <View style={styles.routeRow}>
      <Ionicons name={origen?.tipo === 'gps' ? 'navigate' : 'radio-button-on'} size={16} color={COLORS.success} />
      <Text style={[styles.routeText, !origen && styles.routeTextMissing]} numberOfLines={1}>
        {origen ? `Desde: ${nombreOrigen(origen, originNote)}` : fueraDeZona ? 'Elige un lugar o sector de salida' : 'Sin GPS: elige desde dónde sales'}
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

  const serviceSelector = <View style={[styles.serviceTabs, compacta && styles.serviceTabsCompact]}>
    {([{ id: 'viaje', label: 'Tricimoto', icon: 'navigate-outline' }, { id: 'encomienda', label: 'Encomienda', icon: 'cube-outline' }] as const).map((item) => <PressableScale key={item.id}
      onPress={() => { selectService(item.id); setParcelError(null); }} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: service === item.id }}
      style={[styles.serviceOption, compacta && styles.serviceOptionCompact, service === item.id && styles.serviceOptionActive]}>
      {item.id === 'viaje' ? <TricimotoIcon size={26} color={service === item.id ? COLORS.wine : COLORS.glassTextMutedDark} /> : <Ionicons name={item.icon} size={22} color={service === item.id ? COLORS.primaryLight : COLORS.glassTextMutedDark} />}
      <Text style={[styles.serviceText, service === item.id && styles.serviceTextActive]}>{item.label}</Text>
    </PressableScale>)}
  </View>;

  const safetyHeader = <View style={styles.safetyHeader} onLayout={(e) => setSafetyHeight(e.nativeEvent.layout.height)}>
    <View style={styles.safetyContext}>
      <View style={styles.safetyLocation}>
        <Ionicons name="location-outline" size={18} color={COLORS.wine} />
        <Text style={styles.statusText} accessibilityLiveRegion="polite">{statusText}</Text>
      </View>
      <Text style={styles.safetyHint}>Emergencia: mantén SOS 2 segundos</Text>
    </View>
    <PanicButton onActivate={handlePanic} />
  </View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ─── MAPA DE PANTALLA COMPLETA ──────────────────────── */}
      <MapView
        key={zona}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={!fueraDeZona}
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
                      ? COLORS.surface
                      : COLORS.glassBgDark,
                },
              ]}
            >
              <TricimotoIcon size={28} color={COLORS.wine} />
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
              <TricimotoIcon size={32} />
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
        <AppMenuButton />
        </View>
      </Animated.View>

      {/* ─── ELEGIR DESTINO U ORIGEN ───────────────────────── */}
      {!activeRide && panel !== 'ficha' && (
        <Animated.View
          key={panel}
          entering={PANEL_IN}
          exiting={PANEL_OUT}
          style={[styles.destinationContainer, { bottom: separacion }]}
        >
          <GlassCard
            style={styles.destinationCard}
            noPadding
          >
            {safetyHeader}
            <HojaDesplazable maxHeight={panelMaxHeight} contentContainerStyle={[styles.sheetBody, { paddingBottom: (conBarra ? 0 : insets.bottom) + SPACING.md }]} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {serviceSelector}
            <Text style={[styles.sectionTitle, compacta && styles.sectionTitleCompact]} accessibilityRole="header">
              {panel === 'origen' ? isParcel ? '¿Dónde la recogemos?' : '¿Desde dónde sales?' : isParcel ? '¿Dónde la entregamos?' : '¿A dónde vas?'}
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
            {referenciaLibre === null ? <>
            <GlassInput
              label={isParcel ? 'Lugar de recogida o entrega' : 'Busca o escribe un lugar'}
              placeholder="Farmacia, muelle, letras…"
              value={busqueda.texto}
              onChangeText={busqueda.escribir}
              autoCorrect={false}
              returnKeyType="search"
              maxLength={80}
              accessibilityHint="Escribe al menos 2 letras"
            />
            {nombreLibreValido(busqueda.texto) && <GlassButton
              label="Usar este nombre"
              variant="secondary"
              onPress={() => { setReferenciaLibre(busqueda.texto.trim()); busqueda.limpiar(); }}
              leftIcon={<Ionicons name="create-outline" size={20} color={COLORS.ink} />}
              style={styles.destinationButton}
            />}
            {busqueda.cargando && (
              <Text style={styles.searchHint}>Buscando…</Text>
            )}
            {busqueda.error && (
              <Text style={styles.searchHint} accessibilityLiveRegion="polite">{busqueda.error}</Text>
            )}
            {busqueda.buscado && !busqueda.error && busqueda.resultados.length === 0 && (
              <Text style={styles.searchHint} accessibilityLiveRegion="polite">
                No encontramos ese lugar. Puedes usar el nombre que escribiste y elegir su sector.
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
            </> : <>
              <GlassInput label="Nombre del lugar o referencia" value={referenciaLibre} onChangeText={setReferenciaLibre} maxLength={200} autoCorrect={false} required
                helperText="No necesita aparecer en el catálogo." />
              <Text style={styles.searchHint}>Elige en qué sector está. Usaremos una ubicación aproximada; el conductor verá el nombre que escribas.</Text>
              <GlassButton label="Volver al buscador" variant="ghost" size="sm" onPress={() => { busqueda.escribir(referenciaLibre); setReferenciaLibre(null); }} style={styles.destinationButton} />
              <Text style={styles.sectorsTitle}>Sector del lugar</Text>
            </>}
            {sectoresDelPanel.map((sector) => (
              <GlassButton
                key={sector.id}
                label={sector.name}
                onPress={() => elegirSector(sector.id)}
                disabled={referenciaLibre !== null && !nombreLibreValido(referenciaLibre)}
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
            </HojaDesplazable>
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── BOTTOM SHEET: FICHA DE VIAJE ─────────────────── */}
      {!activeRide && panel === 'ficha' && (
        <Animated.View
          entering={PANEL_IN}
          exiting={PANEL_OUT}
          style={[styles.rideSheetContainer, { bottom: separacion }]}
        >
          <GlassCard style={styles.rideSheet} noPadding>
            {safetyHeader}
            <HojaDesplazable maxHeight={sheetMaxHeight} contentContainerStyle={[styles.sheetBody, { paddingBottom: (conBarra ? 0 : insets.bottom) + SPACING.md }]} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {serviceSelector}
            {/* Encabezado con el total */}
            <View style={styles.rideHeader}>
              <Text style={styles.rideLabel}>{isParcel ? 'Encomienda' : 'Total'}</Text>
              <Text style={[styles.ridePrice, isParcel && styles.parcelPrice]}>{isParcel ? 'Precio a convenir' : formattedPrice}</Text>
              {!isParcel && <Text style={styles.rideCurrency}>USD</Text>}
            </View>

            {/* Detalles del viaje */}
            <View style={styles.routeDetails}>
              {!isParcel && <View style={styles.routeRow}>
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
              </View>}
              {filaOrigen}
              {origen?.tipo === 'sector' && (
                <TextInput
                  value={originNote}
                  onChangeText={setOriginNote}
                  placeholder="¿Dónde te recogen? (opcional)"
                  placeholderTextColor={COLORS.glassTextMutedDark}
                  maxLength={200}
                  accessibilityLabel="Nombre o referencia del punto de partida"
                  style={styles.noteInput}
                />
              )}
              <View style={styles.routeRow}>
                <Ionicons name="location" size={16} color={COLORS.secondary} />
                <Text style={styles.routeText} numberOfLines={1}>
                  Hasta: {nombreDestino(destino, destinationNote)}
                </Text>
              </View>
              <TextInput
                value={destinationNote}
                onChangeText={setDestinationNote}
                placeholder="¿Dónde exactamente? (opcional)"
                placeholderTextColor={COLORS.glassTextMutedDark}
                maxLength={200}
                accessibilityLabel="Nombre o referencia del destino"
                style={styles.noteInput}
              />
            </View>

            {isParcel && <View style={styles.parcelForm}>
              <Text style={styles.searchHint}>Acuerda el precio por chat antes de entregar el paquete. Los datos de entrega se comparten con el conductor solo cuando acepta.</Text>
              <GlassInput label="¿Qué vas a enviar?" leadingIcon="cube-outline" placeholder="Describe el contenido y tamaño" value={parcelDescription} onChangeText={setParcelDescription} maxLength={200} />
              <GlassInput label="¿Quién recibe?" leadingIcon="person-outline" placeholder="Nombre de la persona que recibe" value={recipient} onChangeText={setRecipient} maxLength={100} />
              <CheckboxRow label="Tengo autorización para compartir estos datos de entrega con el conductor asignado." checked={authorized} onChange={setAuthorized} />
              {parcelError && <Text style={styles.parcelError} accessibilityRole="alert">{parcelError}</Text>}
            </View>}
            {/* Botón de solicitud */}
            <GlassButton
              label={isParcel ? 'Solicitar encomienda' : 'Solicitar Tricimoto'}
              onPress={handleRequestRide}
              variant="secondary"
              size="lg"
              loading={isRequesting}
              disabled={!origen || !destino}
              leftIcon={
                <Ionicons name={isParcel ? 'cube-outline' : 'navigate-outline'} size={20} color={COLORS.ink} />
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
            </HojaDesplazable>
          </GlassCard>
        </Animated.View>
      )}

      {/* ─── ESTADO DEL VIAJE ─────────────────────────────── */}
      {activeRide && (
        <Animated.View
          key={activeRide.status}
          entering={PANEL_IN}
          exiting={PANEL_OUT}
          style={[styles.rideSheetContainer, { bottom: separacion }]}
        >
          <GlassCard style={styles.rideSheet} noPadding>
            {safetyHeader}
            {activeRide.status === 'finalizado' ? (
              <HojaCierreViaje
                ride={activeRide}
                conectado={socket.isConnected}
                onConfirmar={viaje.confirmarLlegada}
                onCalificar={viaje.calificar}
                onCerrar={viaje.cerrarSinResponder}
                onMostrarCalificacion={viaje.alMostrarCalificacion}
                altoMaximo={sheetMaxHeight}
                paddingInferior={(conBarra ? 0 : insets.bottom) + SPACING.md}
              />
            ) : activeRide.status === 'aceptado' || activeRide.status === 'en_curso' ? (
              <TarjetaViajePasajero
                ride={activeRide}
                distanciaConductor={distanciaConductor}
                antiguedad={conductorDelViaje.antiguedad}
                conectado={socket.isConnected}
                cancelando={cancelando}
                terminando={terminando}
                onLlamar={() => void Linking.openURL(`tel:${activeRide.driver?.telefono}`)}
                onChat={() => router.push('/(app)/(passenger)/chat' as never)}
                onCancelarConMotivo={() => setEligiendoMotivo(true)}
                onTerminar={handleTerminar}
                altoMaximo={sheetMaxHeight}
                paddingInferior={(conBarra ? 0 : insets.bottom) + SPACING.md}
              />
            ) : (
              <HojaDesplazable maxHeight={sheetMaxHeight} contentContainerStyle={[styles.sheetBody, { paddingBottom: (conBarra ? 0 : insets.bottom) + SPACING.md }]} keyboardShouldPersistTaps="handled">
                <EstadoViaje
                  ride={activeRide}
                  isRequesting={isRequesting}
                  cancelando={cancelando}
                  conectado={socket.isConnected}
                  puedeRepetir={ultimaSolicitud !== null}
                  onCancelar={handleCancelRequest}
                  onVolverAPedir={handleRetry}
                  onCambiar={() => {
                    viaje.descartar();
                    abrirPanel(destino ? 'ficha' : 'destino');
                  }}
                />
              </HojaDesplazable>
            )}
          </GlassCard>
        </Animated.View>
      )}

      <MotivoCancelacion
        visible={eligiendoMotivo}
        motivos={motivosPara('pasajero')}
        explicacion={TEXTO_CANCELAR_PASAJERO}
        onElegir={(motivo) => void handleCancelarConMotivo(motivo)}
        onCerrar={() => setEligiendoMotivo(false)}
      />
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
  isRequesting: boolean;
  cancelando: boolean;
  /** Sin conexión el botón no avanza y se dice por qué (005, criterio 20). */
  conectado: boolean;
  /** Hay una solicitud anterior para repetir con un toque. */
  puedeRepetir: boolean;
  onCancelar: () => void;
  onVolverAPedir: () => void;
  onCambiar: () => void;
}

/**
 * Lo que ve el pasajero mientras el viaje no tiene conductor o lo perdió: buscando con Cancelar
 * (003, criterios 12 y 16), y sin conductor o cancelado por el conductor con «Volver a pedir»
 * (003, criterio 11; 005, criterio 11). Aceptado y en curso: `TarjetaViajePasajero`.
 */
const EstadoViaje: React.FC<EstadoViajeProps> = ({
  ride, isRequesting, cancelando, conectado, puedeRepetir, onCancelar, onVolverAPedir, onCambiar,
}) => {
  if (ride.status === 'solicitado') {
    return (
      <>
        <LoadingSpinner message="Buscando tricimoto…" />
        <Ruta ride={ride} />
        {!conectado && <SinConexion />}
        <GlassButton
          label="Cancelar solicitud"
          onPress={onCancelar}
          variant="danger"
          size="lg"
          loading={cancelando}
          disabled={!conectado}
          style={styles.stateButton}
        />
      </>
    );
  }

  const cancelado = ride.status === 'cancelado';
  return (
    <>
      <View style={styles.stateHeader}>
        <Ionicons name="alert-circle" size={28} color={COLORS.secondaryLight} />
        <Text style={styles.stateTitle} accessibilityRole="header">
          {cancelado ? 'El conductor canceló el viaje' : 'No hay tricimotos disponibles ahora'}
        </Text>
      </View>
      <Ruta ride={ride} />
      {puedeRepetir ? (
        <GlassButton
          label="Volver a pedir"
          onPress={onVolverAPedir}
          variant="secondary"
          size="lg"
          loading={isRequesting}
          leftIcon={<Ionicons name="refresh" size={20} color={COLORS.ink} />}
          style={styles.stateButton}
        />
      ) : (
        <GlassButton label="Pedir otro viaje" onPress={onCambiar} variant="secondary" size="lg" style={styles.stateButton} />
      )}
      {puedeRepetir && (
        <GlassButton label="Cambiar el viaje" onPress={onCambiar} variant="ghost" size="sm" style={styles.cancelButton} />
      )}
    </>
  );
};

/** El estado «sin conexión» se ve siempre en el viaje (regla 6; 005, criterio 20). */
const SinConexion: React.FC = () => (
  <View style={styles.sinConexion} accessibilityRole="alert">
    <Ionicons name="cloud-offline" size={18} color={COLORS.danger} />
    <Text style={styles.sinConexionTexto}>Sin conexión: los botones del viaje se activan cuando vuelva la señal.</Text>
  </View>
);

const styles = StyleSheet.create({
  safetyHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.outline },
  safetyContext: { flex: 1, minWidth: 0 },
  safetyLocation: { flexDirection: 'row', alignItems: 'center' },
  safetyHint: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, lineHeight: 18, marginTop: SPACING.xs },
  serviceTabs: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  serviceOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: 56, borderRadius: 12, backgroundColor: COLORS.glassBgDark, padding: SPACING.sm },
  serviceTabsCompact: { marginBottom: SPACING.md },
  serviceOptionCompact: { minHeight: 48 },
  sectionTitleCompact: { marginBottom: SPACING.sm },
  serviceOptionActive: { backgroundColor: COLORS.wineSoft, borderWidth: 1, borderColor: COLORS.primaryLight },
  serviceText: { fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, color: COLORS.glassTextMutedDark },
  serviceTextActive: { color: COLORS.primaryLight },
  parcelPrice: { fontSize: FONTS.sizes.xxl, flexShrink: 1 },
  parcelForm: { marginBottom: SPACING.lg },
  parcelError: { fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, color: COLORS.dangerLight, marginTop: SPACING.sm },
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
  statusText: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginLeft: SPACING.sm,
    flexShrink: 1,
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
    color: COLORS.wine,
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
    borderRadius: SHAPES.borderRadiusSm,
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
    backgroundColor: COLORS.sand,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  sinConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORS.wineSoft,
  },
  sinConexionTexto: { flex: 1, color: COLORS.glassTextDark, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body },
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

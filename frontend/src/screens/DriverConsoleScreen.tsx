import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Switch,
  Modal,
  Alert,
  ActivityIndicator,
  AppState,
  Linking,
  useWindowDimensions,
} from 'react-native';
import MapView from '../components/Map';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AppMenuButton } from '../components/AppMenuButton';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { BlurContainer } from '../components/BlurContainer';
import { PressableScale } from '../components/PressableScale';
import { TarjetaOferta } from '../components/TarjetaOferta';
import { HojaDesplazable } from '../components/HojaDesplazable';
import { TarjetaViajeActivo } from '../components/TarjetaViajeActivo';
import { MotivoCancelacion } from '../components/MotivoCancelacion';
import { esCompacta } from '../utils/compacto';
import { separacionInferior } from '../utils/barraPestanas';
import { distanciaMetros } from '../utils/geo';
import {
  confirmacionDelPaso,
  enlaceComoLlegar,
  motivosPara,
  textoResenas,
  type MotivoCancelacion as Motivo,
  type PasoConductor,
} from '../utils/viajeConductor';
import { useViajeConductor } from '../hooks/useViajeConductor';
import { useResenasConductor } from '../hooks/useResenasConductor';
import { useLocation } from '../hooks/useLocation';
import { useSocket } from '../hooks/useSocket';
import { useMapRegion } from '../hooks/useMapRegion';
import { useConsolaConductor } from '../hooks/useConsolaConductor';
import { useSeguimientoFondo } from '../hooks/useSeguimientoFondo';
import { PermisoUbicacionScreen } from './PermisoUbicacionScreen';
import { ConsentimientoVigenteScreen } from './ConsentimientoVigenteScreen';
import { useFueraDelDespacho } from '../hooks/useFueraDelDespacho';
import { canalUbicacion } from '../servicios/ubicacion';
import { marcarConsola } from '../servicios/avisos';
import { OFERTA_NO_DISPONIBLE } from '../utils/avisoOferta';
import { debeSeguir } from '../utils/seguimiento';
import { AVISO_SEGUIMIENTO } from '../constants/permisoUbicacion';
import { useAuthStore } from '../store/useAuthStore';
import { COLORS, FONTS, SPACING, SHAPES } from '../constants/theme';
import { nombreSector } from '../utils/solicitud';
import {
  COLORES_OFERTA,
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
 * - Viaje aceptado (paso 005): tarjeta con recogida, «Cómo llegar», Llamar, Chat, el paso que
 *   sigue y cancelar con motivo (criterios 1 a 9)
 *
 * Diseño: DESIGN.md §3.C — Consola del Conductor
 */
export const DriverConsoleScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { height: alto } = useWindowDimensions();
  const profile = useAuthStore((s) => s.profile);
  const { userCoords, currentSectorId } = useLocation(true);
  const socket = useSocket();
  const { isConnected } = socket;
  const consola = useConsolaConductor(socket);
  const { estado, cambiando, ofertas, segundosDe, aceptando, parametros } = consola;
  const disponible = estado === 'disponible';
  const seguimiento = useSeguimientoFondo(estado, parametros);
  const router = useRouter();

  // ─── Viaje aceptado (paso 005) ─────────────────────────────
  const { leerEstado } = consola;
  const alCerrarViaje = useCallback((aviso: { titulo: string; texto: string } | null) => {
    // El trigger del 003 deja la tricimoto disponible: se vuelve a leer de la BD.
    void leerEstado();
    if (aviso) Alert.alert(aviso.titulo, aviso.texto);
  }, [leerEstado]);
  const viajeActivo = useViajeConductor(socket, estado, alCerrarViaje);
  const { viaje } = viajeActivo;
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const resenas = useResenasConductor();
  // La tarjeta ocupa lo que queda entre la cabecera y la barra de pestañas.
  const [bordeCabecera, setBordeCabecera] = useState(insets.top + 160);
  const separacion = separacionInferior(true, insets.bottom);
  const altoTarjeta = Math.max(220, alto - bordeCabecera - separacion - 2 * SPACING.sm);
  const distanciaRecogida = viaje?.recogida && userCoords ? distanciaMetros(userCoords, viaje.recogida) : null;

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

  // ─── Avisos de oferta (004, criterios 7 y 9) ──────────────
  // Con la consola en pantalla y conectada, el aviso de oferta no se muestra: ya está el modal.
  useFocusEffect(useCallback(() => {
    marcarConsola({ abierta: true });
    return () => marcarConsola({ abierta: false });
  }, []));
  useEffect(() => {
    marcarConsola({ conectada: isConnected });
  }, [isConnected]);

  // Al tocar el aviso: la oferta se abre solo si sigue viva en la BD.
  const { oferta: ofertaDeAviso } = useLocalSearchParams<{ oferta?: string }>();
  const { abrirOfertaDeAviso } = consola;
  useEffect(() => {
    if (!ofertaDeAviso) return;
    router.setParams({ oferta: undefined });
    void abrirOfertaDeAviso(ofertaDeAviso).then((abierta) => {
      if (!abierta) Alert.alert(OFERTA_NO_DISPONIBLE, 'Venció, la tomó otro conductor o el pasajero la canceló.');
    });
  }, [ofertaDeAviso, abrirOfertaDeAviso, router]);

  // ─── Interruptor de disponibilidad ────────────────────────
  // Con 428, antes de ponerse disponible acepta la versión vigente del aviso de privacidad (004, 5).
  const [pidiendoConsentimiento, setPidiendoConsentimiento] = useState(false);
  const [enviandoConsentimiento, setEnviandoConsentimiento] = useState(false);
  const [errorConsentimiento, setErrorConsentimiento] = useState<string | null>(null);

  const handleToggleAvailability = useCallback(async (value: boolean) => {
    const resultado = await consola.cambiarDisponibilidad(value);
    if (resultado.ok) return;
    if (resultado.consentimiento) {
      setErrorConsentimiento(null);
      setPidiendoConsentimiento(true);
      return;
    }
    Alert.alert('No se pudo cambiar', resultado.mensaje);
  }, [consola]);

  const handleAceptarConsentimiento = useCallback(async () => {
    setEnviandoConsentimiento(true);
    const registrado = await consola.aceptarConsentimiento();
    if (!registrado.ok) {
      setEnviandoConsentimiento(false);
      setErrorConsentimiento(registrado.mensaje);
      return;
    }
    const disponible = await consola.cambiarDisponibilidad(true);
    setEnviandoConsentimiento(false);
    setPidiendoConsentimiento(false);
    if (!disponible.ok) Alert.alert('No se pudo cambiar', disponible.mensaje);
  }, [consola]);

  // ─── "Estuviste fuera del despacho" (004, criterio 20) ────
  const fuera = useFueraDelDespacho(estado);
  useEffect(() => {
    // Sin permiso en segundo plano ya ve el aviso "solo con la app abierta" (criterio 4).
    if (!fuera.visible || seguimiento.aviso) {
      if (fuera.visible) fuera.cerrar();
      return;
    }
    Alert.alert(
      'Estuviste fuera del despacho',
      'Tu teléfono detuvo CruciDrive en segundo plano y no recibiste ofertas por un rato. '
        + 'En los ajustes de la app, quita el ahorro de batería para CruciDrive.',
      [
        { text: 'Entendido', style: 'cancel', onPress: fuera.cerrar },
        { text: 'Abrir ajustes', onPress: fuera.abrirAjustes },
      ],
      { onDismiss: fuera.cerrar },
    );
  }, [fuera.visible, fuera.cerrar, fuera.abrirAjustes, seguimiento.aviso]);

  // ─── Aceptar y rechazar ───────────────────────────────────
  const handleAcceptRide = useCallback(async (viajeId: string) => {
    const resultado = await consola.aceptar(viajeId);
    // Aceptado: aparece la tarjeta del viaje (005, criterio 1).
    if (!resultado.ok) Alert.alert('No se pudo aceptar', resultado.mensaje);
  }, [consola]);

  // ─── Pasos del viaje (005, criterios 3 a 5 y 20) ───────────
  const { darPaso, cancelar } = viajeActivo;
  const enviarPaso = useCallback(async (paso: PasoConductor) => {
    const resultado = await darPaso(paso);
    if (!resultado.ok) Alert.alert('No se pudo', resultado.mensaje);
  }, [darPaso]);

  const handlePaso = useCallback((paso: PasoConductor) => {
    const pregunta = viaje ? confirmacionDelPaso(paso, viaje.encomienda) : null;
    if (!pregunta) {
      void enviarPaso(paso);
      return;
    }
    Alert.alert(pregunta, undefined, [
      { text: 'Todavía no', style: 'cancel' },
      { text: 'Sí', onPress: () => void enviarPaso(paso) },
    ]);
  }, [viaje, enviarPaso]);

  const handleCancelar = useCallback(async (motivo: Motivo) => {
    setEligiendoMotivo(false);
    const resultado = await cancelar(motivo);
    if (!resultado.ok) Alert.alert('No se pudo cancelar', resultado.mensaje);
  }, [cancelar]);

  const abrirEnlace = useCallback((url: string, siFalla: string) => {
    void Linking.openURL(url).catch(() => Alert.alert('No se pudo abrir', siFalla));
  }, []);

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
        onLayout={(e) => setBordeCabecera(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        <BlurContainer intensity={30} style={styles.header}>
          <View style={styles.headerContent}>
            <AppMenuButton />
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
              <Text style={styles.statValue} numberOfLines={1}>
                {resenas.resumen ? textoResenas(resenas.resumen.promedio, resenas.resumen.total) : '--'}
              </Text>
              <Text style={styles.statLabel}>Calificación</Text>
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

      {/* ─── VIAJE ACEPTADO (paso 005) ─────────────────────── */}
      {viaje && (
        <View style={[styles.viajeContainer, { bottom: separacion + SPACING.sm }]}>
          <TarjetaViajeActivo
            viaje={viaje}
            distanciaM={distanciaRecogida}
            conectado={isConnected}
            enviando={viajeActivo.enviando}
            onPaso={handlePaso}
            onComoLlegar={() => {
              if (viaje.recogida) abrirEnlace(enlaceComoLlegar(viaje.recogida), 'Instala una app de mapas o abre Google Maps.');
            }}
            onLlamar={() => {
              if (viaje.pasajero.telefono) abrirEnlace(`tel:${viaje.pasajero.telefono}`, `Marca ${viaje.pasajero.telefono} desde el teléfono.`);
            }}
            onChat={() => router.push('/(app)/(driver)/chat' as never)}
            onCancelar={() => setEligiendoMotivo(true)}
            altoMaximo={altoTarjeta}
            compacta={esCompacta(alto)}
          />
        </View>
      )}
      <MotivoCancelacion
        visible={eligiendoMotivo}
        motivos={motivosPara('conductor')}
        explicacion="El viaje se cancela y le avisamos al pasajero."
        onElegir={(m) => void handleCancelar(m)}
        onCerrar={() => setEligiendoMotivo(false)}
      />

      {/* Aviso de privacidad vigente antes de ponerse disponible (004, criterio 5) */}
      <ConsentimientoVigenteScreen
        visible={pidiendoConsentimiento}
        enviando={enviandoConsentimiento}
        error={errorConsentimiento}
        onAceptar={handleAceptarConsentimiento}
        onAhoraNo={() => setPidiendoConsentimiento(false)}
      />

      {/* Explicación antes del permiso del sistema (004, criterio 5) */}
      <PermisoUbicacionScreen
        visible={seguimiento.explicando}
        onContinuar={seguimiento.continuar}
        onAhoraNo={seguimiento.ahoraNo}
      />

      {/* ─── MODAL: OFERTAS (una o varias, D-15) ─────────────── */}
      <Modal
        visible={ofertas.length > 0}
        transparent
        animationType="fade"
        statusBarTranslucent
        // Atrás rechaza la que vence antes, como con una sola oferta (003, criterio 6).
        onRequestClose={() => { if (ofertas[0]) consola.rechazar(ofertas[0].viajeId); }}
      >
        <View style={styles.modalOverlay}>
          {ofertas.length > 1 && (
            <Text style={styles.listaTitulo} accessibilityRole="header">
              {ofertas.length} solicitudes · la que vence antes, arriba
            </Text>
          )}
          <View style={styles.lista}>
            <HojaDesplazable maxHeight={Math.floor(alto * 0.86)} contentContainerStyle={styles.listaContenido}>
              {ofertas.map((o) => (
                <TarjetaOferta
                  key={o.viajeId}
                  oferta={o}
                  segundos={segundosDe(o)}
                  conectado={isConnected}
                  aceptando={aceptando === o.viajeId}
                  onAceptar={() => handleAcceptRide(o.viajeId)}
                  onRechazar={() => consola.rechazar(o.viajeId)}
                  compacta={esCompacta(alto)}
                />
              ))}
            </HojaDesplazable>
          </View>
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
  offlineText: {
    flex: 1,
    color: COLORES_OFERTA.avisoTexto,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
  },

  // ─── Viaje aceptado (paso 005) ─────────────────────────────
  viajeContainer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
  },

  // ─── Modal de oferta: opaco y sin blur (regla 6) ─────────
  lista: { width: '100%', maxWidth: 420 },
  listaContenido: { gap: SPACING.md },
  listaTitulo: {
    color: COLORS.white,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
});

export default DriverConsoleScreen;

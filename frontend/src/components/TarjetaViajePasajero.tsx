import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HojaDesplazable } from './HojaDesplazable';
import { PressableScale } from './PressableScale';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import type { ActiveRide } from '../store/useRideStore';
import { textoDistancia } from '../utils/oferta';
import { nombreSector } from '../utils/solicitud';
import {
  puedeCancelarConMotivo,
  puedeTerminarComoPasajero,
  textoResenasDelConductor,
  tituloDelViaje,
} from '../utils/viajePasajero';

interface Props {
  ride: ActiveRide;
  /** Metros en línea recta del conductor al punto de partida; null si aún no hay posición. */
  distanciaConductor: number | null;
  /** «Última posición hace X s» si los datos no son frescos (004, criterio 17). */
  antiguedad: string;
  conectado: boolean;
  cancelando: boolean;
  terminando: boolean;
  onLlamar: () => void;
  onChat: () => void;
  onCancelarConMotivo: () => void;
  onTerminar: () => void;
  /** Alto disponible: si el detalle no cabe se desplaza y las acciones quedan fijas. */
  altoMaximo: number;
  /** Aire inferior de la hoja (la barra de pestañas o el borde seguro). */
  paddingInferior: number;
}

/** Alto de Llamar, Chat y cancelar o terminar (regla 6: botones grandes). */
export const ALTO_ACCION_PASAJERO = 56;
const ALTO_AVISO_SIN_CONEXION = 52;

/**
 * Viaje aceptado o en curso visto por el pasajero (paso 005, plan P10; criterios 3, 4, 8, 9, 5b y
 * 18): estado, conductor con sus reseñas, placa y distancia, y abajo, siempre a la vista, Llamar,
 * Chat y Cancelar (aceptado) o Terminar (en curso). Cabe en 360 × 640 con el SOS de la cabecera.
 */
export const TarjetaViajePasajero: React.FC<Props> = ({
  ride, distanciaConductor, antiguedad, conectado, cancelando, terminando,
  onLlamar, onChat, onCancelarConMotivo, onTerminar, altoMaximo, paddingInferior,
}) => {
  const conductor = ride.driver;
  const resenas = textoResenasDelConductor(conductor);
  const puedeCancelar = puedeCancelarConMotivo(ride.status);
  const puedeTerminar = puedeTerminarComoPasajero(ride.status);
  const ocupado = cancelando || terminando;
  const bloqueado = ocupado || !conectado;
  const fijo = ALTO_ACCION_PASAJERO + SPACING.sm + (conectado ? 0 : ALTO_AVISO_SIN_CONEXION) + paddingInferior;
  const aunLejos = distanciaConductor !== null && ride.status === 'aceptado' && !ride.llegadoEn;

  return (
    <View>
      <HojaDesplazable
        maxHeight={Math.max(120, altoMaximo - fijo)}
        contentContainerStyle={styles.detalle}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.encabezado}>
          <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
          <Text style={styles.titulo} accessibilityRole="header" accessibilityLiveRegion="polite">{tituloDelViaje(ride)}</Text>
        </View>
        <Fila icono="person" texto={conductor?.nombre ?? 'Conductor asignado'} />
        {resenas !== '' && (
          <Fila
            icono="star"
            color={COLORS.primary}
            texto={resenas.replace('★ ', '')}
            etiqueta={`Calificación del conductor: ${resenas.replace('★ ', '')}`}
          />
        )}
        {conductor?.placa && <Fila icono="card" texto={`Placa ${conductor.placa}`} />}
        {aunLejos && <Fila icono="navigate" color={COLORS.secondaryLight} texto={`Tu conductor está ${textoDistancia(distanciaConductor)}`} />}
        {antiguedad !== '' && <Text style={styles.antiguedad} accessibilityLiveRegion="polite">{antiguedad}</Text>}
        <Fila
          icono="location"
          color={COLORS.success}
          texto={`${ride.originName || nombreSector(ride.originSectorId)} → ${ride.destinationName || nombreSector(ride.destinationSectorId)}`}
          lineas={2}
        />
        {ride.serviceType === 'encomienda' && (
          <Text style={styles.nota}>Encomienda · precio a convenir por el chat antes de entregar el paquete.</Text>
        )}
      </HojaDesplazable>

      {!conectado && (
        <View style={styles.sinConexion} accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={18} color={COLORS.danger} />
          <Text style={styles.sinConexionTexto}>Sin conexión: los botones del viaje se activan cuando vuelva la señal.</Text>
        </View>
      )}

      <View style={[styles.acciones, { paddingBottom: paddingInferior }]}>
        {conductor?.telefono && (
          <Accion icono="call" texto="Llamar" etiqueta={`Llamar al conductor, ${conductor.telefono}`} onPress={onLlamar} />
        )}
        {ride.chatThreadId && <Accion icono="chatbubbles" texto="Chat" etiqueta="Abrir el chat con el conductor" onPress={onChat} />}
        {puedeCancelar && (
          <Accion
            icono="close-circle"
            texto="Cancelar"
            etiqueta="Cancelar viaje"
            onPress={onCancelarConMotivo}
            peligro
            cargando={cancelando}
            deshabilitado={bloqueado}
          />
        )}
        {puedeTerminar && (
          <Accion
            icono="flag"
            texto="Terminar"
            etiqueta="Terminar el viaje tú mismo"
            onPress={onTerminar}
            peligro
            cargando={terminando}
            deshabilitado={bloqueado}
          />
        )}
      </View>
    </View>
  );
};

const Fila: React.FC<{ icono: keyof typeof Ionicons.glyphMap; texto: string; color?: string; lineas?: number; etiqueta?: string }> = ({
  icono, texto, color = COLORS.primaryLight, lineas = 1, etiqueta,
}) => (
  <View style={styles.fila}>
    <Ionicons name={icono} size={16} color={color} />
    <Text style={styles.filaTexto} numberOfLines={lineas} accessibilityLabel={etiqueta}>{texto}</Text>
  </View>
);

interface AccionProps {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  etiqueta: string;
  onPress: () => void;
  peligro?: boolean;
  cargando?: boolean;
  deshabilitado?: boolean;
}

const Accion: React.FC<AccionProps> = ({ icono, texto, etiqueta, onPress, peligro = false, cargando = false, deshabilitado = false }) => {
  const color = peligro ? COLORS.danger : COLORS.glassTextDark;
  return (
    <PressableScale
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: deshabilitado, busy: cargando }}
      style={[styles.accion, peligro && styles.accionPeligro, deshabilitado && styles.deshabilitado]}
    >
      {cargando ? <ActivityIndicator color={color} /> : <Ionicons name={icono} size={20} color={color} />}
      <Text style={[styles.accionTexto, { color }]} numberOfLines={1}>{texto}</Text>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  detalle: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  titulo: { flex: 1, fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.glassTextDark },
  fila: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  filaTexto: { flex: 1, fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  antiguedad: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark },
  nota: { marginTop: SPACING.xs, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark },
  sinConexion: {
    minHeight: ALTO_AVISO_SIN_CONEXION - SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORS.wineSoft,
  },
  sinConexionTexto: { flex: 1, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextDark },
  acciones: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  accion: {
    flex: 1,
    minHeight: ALTO_ACCION_PASAJERO,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: 1,
    borderColor: COLORS.outline,
    backgroundColor: COLORS.surface,
  },
  accionPeligro: { borderColor: COLORS.danger },
  accionTexto: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, fontWeight: FONTS.weights.semibold },
  deshabilitado: { opacity: 0.5 },
});

export default TarjetaViajePasajero;

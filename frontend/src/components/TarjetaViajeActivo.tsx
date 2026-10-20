import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { HojaDesplazable } from './HojaDesplazable';
import { FONTS, SHAPES, SPACING } from '../constants/theme';
import { COLORES_OFERTA, textoDistancia, textoPunto } from '../utils/oferta';
import { puedeCancelar, siguientePaso, type PasoConductor, type ViajeConductor } from '../utils/viajeConductor';

interface Props {
  viaje: ViajeConductor;
  /** Distancia en línea recta al punto de recogida; null si no se conoce. */
  distanciaM: number | null;
  conectado: boolean;
  enviando: PasoConductor | 'cancelar' | null;
  onPaso: (paso: PasoConductor) => void;
  onComoLlegar: () => void;
  onLlamar: () => void;
  onChat: () => void;
  onCancelar: () => void;
  /** Alto disponible para la tarjeta: si no cabe, el detalle se desplaza y el paso queda fijo. */
  altoMaximo: number;
  /** Pantalla baja (spec 010): menos aire; los botones no cambian de alto. */
  compacta?: boolean;
}

const titulo = (viaje: ViajeConductor): string => {
  if (viaje.estado === 'en_curso') return viaje.encomienda ? 'Llevando el paquete' : 'Viaje en curso';
  if (viaje.llegadoEn) return viaje.encomienda ? 'Llegaste: recoge el paquete' : 'Llegaste: espera al pasajero';
  return viaje.encomienda ? 'Encomienda aceptada' : 'Viaje aceptado';
};

/**
 * Viaje aceptado en la consola del conductor (paso 005, plan P9; criterios 1 a 9). Opaca y sin
 * blur, con el botón del paso de 64 px y los demás de 56 px (regla 6). Cabe en 360 × 640.
 */
export const TarjetaViajeActivo: React.FC<Props> = ({
  viaje, distanciaM, conectado, enviando, onPaso, onComoLlegar, onLlamar, onChat, onCancelar, altoMaximo, compacta = false,
}) => {
  const { paso, texto } = siguientePaso(viaje);
  const distancia = viaje.estado === 'aceptado' ? textoDistancia(distanciaM) : '';
  const ocupado = enviando !== null;
  const deshabilitado = ocupado || !conectado;
  const comoLlegar = viaje.estado === 'aceptado' && viaje.recogida !== null;
  const relleno = compacta ? SPACING.md : SPACING.lg;
  // Lo fijo, siempre a la vista: Cómo llegar, Llamar y Chat, el aviso sin conexión, el paso,
  // sus márgenes, el relleno y el borde. Lo demás se desplaza si no cabe (360 × 640).
  const hayAcciones = comoLlegar || Boolean(viaje.pasajero.telefono) || Boolean(viaje.threadId);
  const fijo = (hayAcciones ? ALTO_BOTON_ACCION + SPACING.sm : 0) + (conectado ? 0 : 48)
    + ALTO_BOTON_PASO + SPACING.sm + 2 * relleno + 4;

  return (
    <View style={[styles.tarjeta, { padding: relleno }]}>
      <HojaDesplazable maxHeight={Math.max(120, altoMaximo - fijo)} fondo="oscuro" nestedScrollEnabled>
        <Text style={[styles.titulo, compacta && styles.tituloCompacto]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {titulo(viaje)}
        </Text>
        {distancia !== '' && <Text style={styles.suave}>Recogida {distancia}</Text>}

        {/* Recogida y destino */}
        <View style={[styles.ruta, compacta && styles.rutaCompacta]}>
          <View style={styles.rutaFila}>
            <Ionicons name="radio-button-on" size={16} color={COLORES_OFERTA.origen} />
            <Text style={styles.rutaTexto} numberOfLines={compacta ? 1 : 2} accessibilityLabel={`Recogida: ${textoPunto(viaje.origen)}`}>
              {textoPunto(viaje.origen)}
            </Text>
          </View>
          <View style={styles.rutaLinea} />
          <View style={styles.rutaFila}>
            <Ionicons name="location" size={16} color={COLORES_OFERTA.cuenta} />
            <Text style={styles.rutaTexto} numberOfLines={compacta ? 1 : 2} accessibilityLabel={`Destino: ${textoPunto(viaje.destino)}`}>
              {textoPunto(viaje.destino)}
            </Text>
          </View>
        </View>

        {/* Total y personas, o la encomienda con su contenido (criterio 1; 009, criterio 6) */}
        {viaje.encomienda ? (
          <>
            <Text style={styles.detalle}>Encomienda · precio a convenir</Text>
            {viaje.paquete && (
              <Text style={styles.suave} numberOfLines={2}>
                {viaje.paquete.descripcion} · recibe {viaje.paquete.destinatario}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.detalle}>
            ${viaje.tarifa?.toFixed(2) ?? '—'} en efectivo · {viaje.pasajeros} {viaje.pasajeros === 1 ? 'persona' : 'personas'}
          </Text>
        )}
        {viaje.pasajero.nombre && <Text style={styles.suave}>Pasajero: {viaje.pasajero.nombre}</Text>}

        {/* Cancelar solo antes de empezar (criterios 8 y 9) */}
        {puedeCancelar(viaje.estado) && (
          <PressableScale
            onPress={onCancelar}
            disabled={deshabilitado}
            accessibilityRole="button"
            accessibilityLabel="Cancelar viaje"
            accessibilityState={{ disabled: deshabilitado, busy: enviando === 'cancelar' }}
            style={[styles.cancelar, deshabilitado && styles.deshabilitado]}
          >
            {enviando === 'cancelar' ? (
              <ActivityIndicator color={COLORES_OFERTA.texto} />
            ) : (
              <Text style={styles.cancelarTexto}>Cancelar viaje</Text>
            )}
          </PressableScale>
        )}
      </HojaDesplazable>

      {/* Cómo llegar, Llamar y Chat */}
      {hayAcciones && (
        <View style={styles.acciones}>
          {comoLlegar && (
            <Accion icono="navigate" texto="Cómo llegar" onPress={onComoLlegar} etiqueta="Cómo llegar al punto de recogida en la app de mapas" />
          )}
          {viaje.pasajero.telefono && (
            <Accion icono="call" texto="Llamar" onPress={onLlamar} etiqueta={`Llamar al pasajero, ${viaje.pasajero.telefono}`} />
          )}
          {viaje.threadId && <Accion icono="chatbubbles" texto="Chat" onPress={onChat} etiqueta="Abrir el chat con el pasajero" />}
        </View>
      )}

      {!conectado && (
        <View style={styles.sinConexion} accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={18} color={COLORES_OFERTA.avisoTexto} />
          <Text style={styles.sinConexionTexto}>Sin conexión: el paso no se puede enviar</Text>
        </View>
      )}

      {/* El paso que sigue (criterios 3 a 5) */}
      <PressableScale
        onPress={() => onPaso(paso)}
        disabled={deshabilitado}
        accessibilityRole="button"
        accessibilityLabel={texto}
        accessibilityState={{ disabled: deshabilitado, busy: enviando === paso }}
        style={[styles.paso, deshabilitado && styles.deshabilitado]}
      >
        {enviando === paso ? (
          <ActivityIndicator color={COLORES_OFERTA.aceptarTexto} />
        ) : (
          <Text style={styles.pasoTexto}>{texto}</Text>
        )}
      </PressableScale>
    </View>
  );
};

const Accion: React.FC<{ icono: keyof typeof Ionicons.glyphMap; texto: string; etiqueta: string; onPress: () => void }> = ({ icono, texto, etiqueta, onPress }) => (
  <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} style={styles.accion}>
    <Ionicons name={icono} size={20} color={COLORES_OFERTA.texto} />
    <Text style={styles.accionTexto} numberOfLines={1}>{texto}</Text>
  </PressableScale>
);

/** Alto del botón del paso (regla 6; como Aceptar en la oferta). */
export const ALTO_BOTON_PASO = 64;
/** Alto de Cómo llegar, Llamar, Chat y Cancelar. */
export const ALTO_BOTON_ACCION = 56;

const styles = StyleSheet.create({
  tarjeta: {
    borderRadius: SHAPES.borderRadiusLg,
    borderWidth: 2,
    borderColor: COLORES_OFERTA.cuenta,
    backgroundColor: COLORES_OFERTA.fondo,
  },
  titulo: { fontSize: FONTS.sizes.xxl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.texto },
  tituloCompacto: { fontSize: FONTS.sizes.xl },
  suave: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORES_OFERTA.textoSuave, marginTop: SPACING.xs },
  ruta: { marginVertical: SPACING.md },
  rutaCompacta: { marginVertical: SPACING.sm },
  rutaFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  rutaLinea: { width: 2, height: 12, backgroundColor: COLORES_OFERTA.textoSuave, marginLeft: 7 },
  rutaTexto: { flex: 1, fontSize: FONTS.sizes.lg, fontFamily: FONTS.body, color: COLORES_OFERTA.texto, marginLeft: SPACING.sm },
  detalle: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.cuenta },
  acciones: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  accion: {
    flex: 1,
    minHeight: ALTO_BOTON_ACCION,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: 1,
    borderColor: COLORES_OFERTA.textoSuave,
  },
  accionTexto: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, fontWeight: FONTS.weights.semibold, color: COLORES_OFERTA.texto },
  sinConexion: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORES_OFERTA.avisoFondo,
  },
  sinConexionTexto: { flex: 1, color: COLORES_OFERTA.avisoTexto, fontSize: FONTS.sizes.base, fontFamily: FONTS.body, fontWeight: FONTS.weights.semibold },
  paso: {
    minHeight: ALTO_BOTON_PASO,
    marginTop: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SHAPES.borderRadiusFull,
    backgroundColor: COLORES_OFERTA.aceptarFondo,
  },
  pasoTexto: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.aceptarTexto },
  cancelar: { minHeight: ALTO_BOTON_ACCION, marginTop: SPACING.xs, alignItems: 'center', justifyContent: 'center' },
  cancelarTexto: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, fontWeight: FONTS.weights.semibold, color: COLORES_OFERTA.texto, textDecorationLine: 'underline' },
  deshabilitado: { opacity: 0.5 },
});

export default TarjetaViajeActivo;

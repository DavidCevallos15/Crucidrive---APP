import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import { COLORES_OFERTA, textoDistancia, textoPunto, type OfertaViaje } from '../utils/oferta';

interface Props {
  oferta: OfertaViaje;
  segundos: number;
  conectado: boolean;
  aceptando: boolean;
  onAceptar: () => void;
  onRechazar: () => void;
  /** Pantalla baja (spec 010): cuenta atrás y textos más chicos; los botones no cambian. */
  compacta?: boolean;
}

/**
 * Oferta de viaje o encomienda para el conductor (pasos 003 y 009). Opaca, sin blur y con
 * botones de al menos 56 px (regla 6). En una pantalla de 360 × 640 cabe entera (010, 4).
 */
export const TarjetaOferta: React.FC<Props> = ({ oferta, segundos, conectado, aceptando, onAceptar, onRechazar, compacta = false }) => {
  const encomienda = oferta.tipoServicio === 'encomienda';
  const distancia = textoDistancia(oferta.distanciaM);
  return (
    <View style={[styles.tarjeta, compacta && styles.tarjetaCompacta]} accessibilityViewIsModal>
      {/* Cuenta regresiva según el servidor */}
      <View style={styles.cuenta}>
        <Text style={[styles.cuentaNumero, compacta && styles.cuentaNumeroCompacta]} accessibilityLabel={`Quedan ${segundos} segundos`}>
          {segundos}
        </Text>
        <Text style={styles.cuentaTexto}>segundos</Text>
      </View>

      <Text style={[styles.titulo, compacta && styles.tituloCompacto]} accessibilityRole="header">{encomienda ? 'Nueva encomienda' : '¡Nuevo viaje!'}</Text>
      {oferta.fase === 'abierta' && <Text style={styles.subtitulo}>Aviso a varios: gana el primero que acepte</Text>}
      {distancia !== '' && <Text style={styles.subtitulo}>El pasajero está {distancia}</Text>}

      {/* Detalles de la ruta */}
      <View style={[styles.ruta, compacta && styles.rutaCompacta]}>
        <View style={styles.rutaFila}>
          <Ionicons name="radio-button-on" size={16} color={COLORS.primaryLight} />
          <Text style={[styles.rutaTexto, compacta && styles.rutaTextoCompacto]} numberOfLines={compacta ? 2 : 3}>{textoPunto(oferta.origen)}</Text>
        </View>
        <View style={styles.rutaLinea} />
        <View style={styles.rutaFila}>
          <Ionicons name="location" size={16} color={COLORES_OFERTA.cuenta} />
          <Text style={[styles.rutaTexto, compacta && styles.rutaTextoCompacto]} numberOfLines={compacta ? 2 : 3}>{textoPunto(oferta.destino)}</Text>
        </View>
      </View>

      {/* Total (lo fija la BD) y personas */}
      <Text style={[styles.precio, compacta && styles.precioCompacto]}>{encomienda ? 'Precio a convenir' : `$${oferta.tarifa?.toFixed(2) ?? '—'}`}</Text>
      <Text style={styles.subtitulo}>
        {encomienda ? 'Encomienda · acuerda el precio por chat' : `${oferta.pasajeros} ${oferta.pasajeros === 1 ? 'persona' : 'personas'}`}
      </Text>

      {!conectado && (
        <View style={styles.sinConexion} accessibilityRole="alert">
          <Ionicons name="cloud-offline" size={18} color={COLORES_OFERTA.avisoTexto} />
          <Text style={styles.sinConexionTexto}>Sin conexión: no se puede aceptar</Text>
        </View>
      )}

      {/* Botones grandes para tocarlos sin mirar dos veces */}
      <View style={[styles.botones, compacta && styles.botonesCompactos]}>
        <PressableScale onPress={onRechazar} accessibilityRole="button" accessibilityLabel="Rechazar viaje" style={[styles.boton, styles.rechazar]}>
          <Ionicons name="close" size={24} color={COLORES_OFERTA.rechazarTexto} />
          <Text style={[styles.botonTexto, { color: COLORES_OFERTA.rechazarTexto }]}>Rechazar</Text>
        </PressableScale>
        <PressableScale
          onPress={onAceptar}
          disabled={aceptando || !conectado}
          accessibilityRole="button"
          accessibilityLabel="Aceptar viaje"
          accessibilityState={{ disabled: aceptando || !conectado, busy: aceptando }}
          style={[styles.boton, styles.aceptar, !conectado && styles.deshabilitado]}
        >
          {aceptando ? (
            <ActivityIndicator color={COLORES_OFERTA.aceptarTexto} />
          ) : (
            <>
              <Ionicons name="checkmark" size={24} color={COLORES_OFERTA.aceptarTexto} />
              <Text style={[styles.botonTexto, { color: COLORES_OFERTA.aceptarTexto }]}>Aceptar</Text>
            </>
          )}
        </PressableScale>
      </View>
    </View>
  );
};

/** Alto mínimo de Aceptar y Rechazar (regla 6; spec 010, criterio 4: al menos 56). */
export const ALTO_BOTON_OFERTA = 64;

const styles = StyleSheet.create({
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: SHAPES.borderRadiusLg,
    borderWidth: 2,
    borderColor: COLORES_OFERTA.cuenta,
    backgroundColor: COLORES_OFERTA.fondo,
  },
  tarjetaCompacta: { padding: SPACING.md },
  cuenta: { alignItems: 'center', marginBottom: SPACING.sm },
  cuentaNumero: { fontSize: 56, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.cuenta, fontVariant: ['tabular-nums'] },
  cuentaNumeroCompacta: { fontSize: 44 },
  cuentaTexto: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORES_OFERTA.textoSuave },
  titulo: { fontSize: FONTS.sizes.xxl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.texto },
  tituloCompacto: { fontSize: FONTS.sizes.xl },
  subtitulo: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORES_OFERTA.textoSuave, marginTop: SPACING.xs, textAlign: 'center' },
  ruta: { marginVertical: SPACING.md, alignSelf: 'stretch' },
  rutaCompacta: { marginVertical: SPACING.sm },
  rutaFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs },
  rutaLinea: { width: 2, height: 14, backgroundColor: COLORES_OFERTA.textoSuave, marginLeft: 7 },
  rutaTexto: { flex: 1, fontSize: FONTS.sizes.lg, fontFamily: FONTS.body, color: COLORES_OFERTA.texto, marginLeft: SPACING.sm },
  rutaTextoCompacto: { fontSize: FONTS.sizes.base },
  precio: { fontSize: FONTS.sizes.title, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.cuenta },
  precioCompacto: { fontSize: FONTS.sizes.xxl },
  sinConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORES_OFERTA.avisoFondo,
  },
  sinConexionTexto: { flex: 1, color: COLORES_OFERTA.avisoTexto, fontSize: FONTS.sizes.base, fontFamily: FONTS.body, fontWeight: FONTS.weights.semibold },
  botones: { flexDirection: 'row', gap: SPACING.md, alignSelf: 'stretch', marginTop: SPACING.lg },
  botonesCompactos: { marginTop: SPACING.md },
  boton: { flex: 1, minHeight: ALTO_BOTON_OFERTA, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, borderRadius: SHAPES.borderRadiusFull },
  rechazar: { backgroundColor: COLORES_OFERTA.rechazarFondo },
  aceptar: { backgroundColor: COLORES_OFERTA.aceptarFondo },
  deshabilitado: { opacity: 0.5 },
  botonTexto: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold },
});

export default TarjetaOferta;

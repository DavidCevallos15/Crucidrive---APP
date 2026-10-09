import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../components/PressableScale';
import { PERMISO_UBICACION } from '../constants/permisoUbicacion';
import { COLORES_OFERTA } from '../utils/oferta';
import { FONTS, SHAPES, SPACING } from '../constants/theme';

interface Props {
  visible: boolean;
  onContinuar: () => void;
  onAhoraNo: () => void;
}

/**
 * Explicación propia antes del diálogo de permiso de ubicación en segundo plano (paso 004,
 * criterio 5, P19). Opaca y sin blur, con botones grandes, como la oferta (regla 6).
 */
export const PermisoUbicacionScreen: React.FC<Props> = ({ visible, onContinuar, onAhoraNo }) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onAhoraNo}>
    <View style={styles.overlay}>
      <View style={styles.card} accessibilityViewIsModal>
        <Text style={styles.titulo} accessibilityRole="header">{PERMISO_UBICACION.titulo}</Text>
        {PERMISO_UBICACION.puntos.map((punto) => (
          <View key={punto.icono} style={styles.punto}>
            <Ionicons name={punto.icono} size={22} color={COLORES_OFERTA.cuenta} />
            <Text style={styles.texto}>{punto.texto}</Text>
          </View>
        ))}
        <Text style={styles.indicacion}>{PERMISO_UBICACION.indicacion}</Text>
        <View style={styles.botones}>
          <PressableScale
            onPress={onAhoraNo}
            accessibilityRole="button"
            style={[styles.boton, styles.botonSecundario]}
          >
            <Text style={[styles.textoBoton, { color: COLORES_OFERTA.texto }]}>{PERMISO_UBICACION.ahoraNo}</Text>
          </PressableScale>
          <PressableScale
            onPress={onContinuar}
            accessibilityRole="button"
            style={[styles.boton, { backgroundColor: COLORES_OFERTA.aceptarFondo }]}
          >
            <Text style={[styles.textoBoton, { color: COLORES_OFERTA.aceptarTexto }]}>{PERMISO_UBICACION.continuar}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: SPACING.lg,
    borderRadius: SHAPES.borderRadiusLg,
    backgroundColor: COLORES_OFERTA.fondo,
  },
  titulo: {
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORES_OFERTA.texto,
    marginBottom: SPACING.md,
  },
  punto: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  texto: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORES_OFERTA.texto,
  },
  indicacion: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
    color: COLORES_OFERTA.cuenta,
  },
  botones: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  boton: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SHAPES.borderRadiusFull,
  },
  botonSecundario: {
    borderWidth: 2,
    borderColor: COLORES_OFERTA.textoSuave,
  },
  textoBoton: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
  },
});

export default PermisoUbicacionScreen;

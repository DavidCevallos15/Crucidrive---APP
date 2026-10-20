import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { FONTS, SHAPES, SPACING } from '../constants/theme';
import { COLORES_OFERTA } from '../utils/oferta';
import { TEXTO_MOTIVO, type MotivoCancelacion as Motivo } from '../utils/viajeConductor';

interface Props {
  visible: boolean;
  motivos: Motivo[];
  /** Qué pasa al cancelar, para que la confirmación diga lo que hace (criterio 8). */
  explicacion: string;
  onElegir: (motivo: Motivo) => void;
  onCerrar: () => void;
}

/**
 * Confirmación y motivo de la cancelación de un viaje aceptado (paso 005, criterio 8). Elegir
 * el motivo es la confirmación; «Volver» no cancela. Opaco y con botones de 56 px (regla 6).
 */
export const MotivoCancelacion: React.FC<Props> = ({ visible, motivos, explicacion, onElegir, onCerrar }) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCerrar}>
    <View style={styles.fondo}>
      <View style={styles.hoja} accessibilityViewIsModal>
        <Text style={styles.titulo} accessibilityRole="header">¿Por qué cancelas?</Text>
        <Text style={styles.texto}>{explicacion}</Text>
        {motivos.map((m) => (
          <PressableScale key={m} onPress={() => onElegir(m)} accessibilityRole="button" accessibilityLabel={`Cancelar: ${TEXTO_MOTIVO[m]}`} style={styles.motivo}>
            <Text style={styles.motivoTexto}>{TEXTO_MOTIVO[m]}</Text>
          </PressableScale>
        ))}
        <PressableScale onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Volver sin cancelar" style={styles.volver}>
          <Text style={styles.volverTexto}>Volver sin cancelar</Text>
        </PressableScale>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', paddingHorizontal: SPACING.md },
  hoja: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: SPACING.lg,
    borderRadius: SHAPES.borderRadiusLg,
    backgroundColor: COLORES_OFERTA.fondo,
    gap: SPACING.sm,
  },
  titulo: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.texto },
  texto: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORES_OFERTA.textoSuave, marginBottom: SPACING.xs },
  motivo: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: 1,
    borderColor: COLORES_OFERTA.textoSuave,
  },
  motivoTexto: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.body, fontWeight: FONTS.weights.semibold, color: COLORES_OFERTA.texto },
  volver: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: SHAPES.borderRadiusFull, backgroundColor: COLORES_OFERTA.aceptarFondo, marginTop: SPACING.xs },
  volverTexto: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORES_OFERTA.aceptarTexto },
});

export default MotivoCancelacion;

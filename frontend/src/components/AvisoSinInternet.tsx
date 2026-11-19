import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { TEXTO_SIN_INTERNET } from '../utils/conexion';

/** Píldora «Sin internet», siempre visible mientras dure (regla 6; 017, P2 y criterio 2). */
export const AvisoSinInternet: React.FC = () => (
  <View
    style={styles.pildora}
    accessible
    accessibilityRole="alert"
    accessibilityLiveRegion="polite"
    accessibilityLabel={`${TEXTO_SIN_INTERNET.titulo}. ${TEXTO_SIN_INTERNET.detalle}.`}
  >
    <Ionicons name="cloud-offline" size={18} color={COLORS.danger} />
    <View style={styles.textos}>
      <Text style={styles.titulo} numberOfLines={1}>{TEXTO_SIN_INTERNET.titulo}</Text>
      <Text style={styles.detalle} numberOfLines={1}>{TEXTO_SIN_INTERNET.detalle}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.surface,
  },
  textos: { flexShrink: 1 },
  titulo: { fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.danger },
  detalle: { fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, color: COLORS.glassTextDark },
});

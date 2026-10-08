import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import { PressableScale } from './PressableScale';

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Mensaje de error debajo de la casilla */
  error?: string;
}

/**
 * Casilla con texto. Toda la fila es el área táctil (mínimo 48 px) y se anuncia como
 * casilla al lector de pantalla.
 */
export const CheckboxRow: React.FC<CheckboxRowProps> = ({ label, checked, onChange, error }) => (
  <View style={styles.wrapper}>
    <PressableScale
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      pressedScale={0.98}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.boxChecked, !!error && !checked && styles.boxError]}>
        {checked && <Ionicons name="checkmark" size={18} color={COLORS.white} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
    {error ? (
      <Text style={styles.error} accessibilityRole="alert">
        {error}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.glassTextMutedDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  boxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  boxError: { borderColor: COLORS.danger },
  label: {
    flex: 1,
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.normal,
  },
  error: {
    color: COLORS.danger,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    marginTop: SPACING.xs,
    borderRadius: SHAPES.borderRadiusSm,
  },
});

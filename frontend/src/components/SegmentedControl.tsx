import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import { PressableScale } from './PressableScale';

interface Opcion<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  /** Etiqueta visible del grupo (accesibilidad) */
  label: string;
  opciones: Opcion<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Selector de una opción entre pocas (p. ej. Pasajero / Conductor). Cada opción mide
 * al menos 48 px de alto para tocarla cómodamente con el pulgar.
 */
export function SegmentedControl<T extends string>({
  label,
  opciones,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {opciones.map((op) => {
          const activa = op.value === value;
          return (
            <PressableScale
              key={op.value}
              onPress={() => onChange(op.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: activa }}
              accessibilityLabel={op.label}
              pressedScale={0.97}
              style={[styles.opcion, activa && styles.opcionActiva]}
            >
              <Text style={[styles.texto, activa && styles.textoActivo]}>{op.label}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.md },
  label: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.xs,
  },
  row: { flexDirection: 'row', gap: SPACING.sm },
  opcion: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SHAPES.borderRadiusSm,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: COLORS.surface,
  },
  opcionActiva: {
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.wineSoft,
  },
  texto: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
  },
  textoActivo: { color: COLORS.wine },
});

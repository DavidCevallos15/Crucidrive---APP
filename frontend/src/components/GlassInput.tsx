import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS, SHAPES, SPACING, ANIMATION } from '../constants/theme';

/**
 * Props del campo de entrada Glassmorphic.
 */
interface GlassInputProps extends Omit<TextInputProps, 'style'> {
  /** Etiqueta visible del campo (accesibilidad: no usar solo placeholder) */
  label: string;
  /** Mensaje de error del campo */
  error?: string;
  /** Texto de ayuda debajo del campo */
  helperText?: string;
  /** Indica si el campo es obligatorio */
  required?: boolean;
  /** Estilos adicionales del contenedor exterior */
  containerStyle?: ViewStyle;
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Campo de entrada Glassmorphic con label, validación y animación de borde.
 *
 * El borde cambia de color al enfocar (cian activo) y al tener error (rojo).
 * Siempre muestra una etiqueta visible (no depende solo del placeholder).
 *
 * @example
 * <GlassInput
 *   label="Número de teléfono"
 *   placeholder="+593 99 123 4567"
 *   keyboardType="phone-pad"
 *   error={errors.phone}
 * />
 */
export const GlassInput: React.FC<GlassInputProps> = ({
  label,
  error,
  helperText,
  required = false,
  containerStyle,
  onFocus,
  onBlur,
  ...inputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const borderProgress = useSharedValue(0);

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      borderProgress.value = withTiming(1, {
        duration: ANIMATION.durationFast,
      });
      onFocus?.(e);
    },
    [onFocus, borderProgress]
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      borderProgress.value = withTiming(0, {
        duration: ANIMATION.durationFast,
      });
      onBlur?.(e);
    },
    [onBlur, borderProgress]
  );

  /**
   * Determina el color del borde según el estado del campo.
   */
  const getBorderColor = (): string => {
    if (error) return COLORS.danger;
    if (isFocused) return COLORS.primaryLight;
    return COLORS.glassBorderDark;
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {/* Etiqueta visible — accesibilidad */}
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      {/* Campo de entrada */}
      <View
        style={[
          styles.inputContainer,
          { borderColor: getBorderColor() },
          isFocused && styles.inputFocused,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.glassTextMutedDark}
          selectionColor={COLORS.primaryLight}
          accessibilityLabel={label}
          accessibilityHint={helperText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...inputProps}
        />
      </View>

      {/* Texto de error o ayuda */}
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  label: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.xs,
  },
  required: {
    color: COLORS.danger,
  },
  inputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: SHAPES.glassBorderWidth,
    borderRadius: SHAPES.borderRadiusSm,
    overflow: 'hidden',
  },
  inputFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    height: 48,
    paddingHorizontal: SPACING.md,
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    marginTop: SPACING.xs,
  },
  helperText: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    marginTop: SPACING.xs,
  },
});

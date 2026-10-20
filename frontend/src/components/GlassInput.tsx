import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';

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
  leadingIcon?: keyof typeof Ionicons.glyphMap;
}

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
  leadingIcon,
  secureTextEntry,
  ...inputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleFocus = useCallback(
    (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  /**
   * Determina el color del borde según el estado del campo.
   */
  const getBorderColor = (): string => {
    if (error) return COLORS.dangerLight;
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
        {leadingIcon && <Ionicons name={leadingIcon} size={20} color={isFocused ? COLORS.primaryLight : COLORS.glassTextMutedDark} style={styles.leadingIcon} />}
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.glassTextMutedDark}
          selectionColor={COLORS.primaryLight}
          accessibilityLabel={label}
          accessibilityHint={helperText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={Boolean(secureTextEntry && !passwordVisible)}
          {...inputProps}
        />
        {secureTextEntry && <PressableScale onPress={() => setPasswordVisible((visible) => !visible)}
          accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          accessibilityState={{ expanded: passwordVisible }} style={styles.visibility}>
          <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.glassTextMutedDark} />
        </PressableScale>}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: SHAPES.glassBorderWidth,
    borderRadius: SHAPES.borderRadiusSm,
    overflow: 'hidden',
  },
  inputFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: SPACING.md,
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
  },
  errorText: {
    color: COLORS.dangerLight,
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
  leadingIcon: { marginLeft: SPACING.md },
  visibility: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});

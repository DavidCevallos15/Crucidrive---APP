import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  type TextStyle,
  type ViewStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { COLORS, FONTS, SHAPES, ANIMATION, SPACING } from '../constants/theme';

/**
 * Variantes visuales del botón.
 */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * Tamaños del botón.
 */
type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props del botón Glassmorphic con micro-animación.
 */
interface GlassButtonProps {
  /** Texto del botón */
  label: string;
  /** Callback al pulsar */
  onPress: () => void;
  /** Variante visual */
  variant?: ButtonVariant;
  /** Tamaño del botón */
  size?: ButtonSize;
  /** Deshabilitar interacciones */
  disabled?: boolean;
  /** Mostrar indicador de carga */
  loading?: boolean;
  /** Icono a la izquierda del texto (componente React) */
  leftIcon?: React.ReactNode;
  /** Estilos adicionales del contenedor */
  style?: ViewStyle;
}

/**
 * Mapeo de colores de fondo por variante.
 */
const VARIANT_COLORS: Record<ButtonVariant, string> = {
  primary: COLORS.primary,
  secondary: COLORS.secondary,
  danger: COLORS.danger,
  ghost: COLORS.glassBgDark,
};

/**
 * Mapeo de colores de texto por variante.
 */
const VARIANT_TEXT_COLORS: Record<ButtonVariant, string> = {
  primary: COLORS.white,
  secondary: COLORS.darkBg,
  danger: COLORS.white,
  ghost: COLORS.glassTextDark,
};

/**
 * Mapeo de dimensiones por tamaño.
 */
const SIZE_CONFIG: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 40, paddingHorizontal: SPACING.md, fontSize: FONTS.sizes.sm },
  md: { height: 48, paddingHorizontal: SPACING.lg, fontSize: FONTS.sizes.base },
  lg: { height: 56, paddingHorizontal: SPACING.xl, fontSize: FONTS.sizes.lg },
};

/**
 * Botón Glassmorphic con micro-animación de escala.
 *
 * Al pulsar, el botón reduce su escala a 0.97 usando react-native-reanimated
 * con una curva spring natural, siguiendo las directrices de DESIGN.md.
 *
 * @example
 * <GlassButton
 *   label="Solicitar Tricimoto"
 *   onPress={handleRequest}
 *   variant="secondary"
 *   size="lg"
 * />
 */
export const GlassButton: React.FC<GlassButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  style,
}) => {
  const scale = useSharedValue(1);
  const sizeConfig = SIZE_CONFIG[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tapGesture = Gesture.Tap()
    .enabled(!disabled && !loading)
    .onBegin(() => {
      scale.value = withSpring(ANIMATION.pressScale, ANIMATION.spring);
    })
    .onFinalize(() => {
      scale.value = withSpring(1, ANIMATION.spring);
    })
    .onEnd(() => {
      onPress();
    });

  const containerStyle: ViewStyle = {
    height: sizeConfig.height,
    paddingHorizontal: sizeConfig.paddingHorizontal,
    backgroundColor: VARIANT_COLORS[variant],
    borderRadius: SHAPES.borderRadiusFull,
    opacity: disabled ? 0.4 : 1,
    ...(variant === 'ghost' && {
      borderWidth: SHAPES.glassBorderWidth,
      borderColor: COLORS.glassBorderDark,
    }),
  };

  const textStyle: TextStyle = {
    color: VARIANT_TEXT_COLORS[variant],
    fontSize: sizeConfig.fontSize,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
  };

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={[styles.container, containerStyle, animatedStyle, style]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator
            color={VARIANT_TEXT_COLORS[variant]}
            size="small"
          />
        ) : (
          <>
            {leftIcon && (
              <Animated.View style={styles.iconContainer}>
                {leftIcon}
              </Animated.View>
            )}
            <Text style={textStyle}>{label}</Text>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
});

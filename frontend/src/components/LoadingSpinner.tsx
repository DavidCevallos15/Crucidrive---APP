import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, FONTS, SPACING } from '../constants/theme';

/**
 * Props del spinner de carga.
 */
interface LoadingSpinnerProps {
  /** Tamaño del spinner en píxeles */
  size?: number;
  /** Color del spinner */
  color?: string;
  /** Mensaje de carga opcional */
  message?: string;
  /** Si es true, muestra sobre un fondo oscuro translúcido */
  overlay?: boolean;
}

/**
 * Spinner de carga animado con rotación y pulso.
 *
 * Diseñado para integrarse con el estilo Glassmorphic de la app.
 * Usa react-native-reanimated para rotación continua suave.
 *
 * @example
 * <LoadingSpinner message="Buscando conductor..." />
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 48,
  color = COLORS.primaryLight,
  message,
  overlay = false,
}) => {
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Rotación continua
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Pulso suave
    pulseScale.value = withRepeat(
      withTiming(1.1, { duration: 800 }),
      -1,
      true // reverse
    );
  }, [rotation, pulseScale]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: pulseScale.value },
    ],
  }));

  const content = (
    <View style={styles.center}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderTopColor: color,
            borderRightColor: color,
          },
          rotationStyle,
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel={message ?? 'Cargando'}
      />
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  );

  if (overlay) {
    return <View style={styles.overlay}>{content}</View>;
  }

  return content;
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  spinner: {
    borderWidth: 3,
  },
  message: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 15, 25, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});

import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, EFFECTS } from '../constants/theme';

/**
 * Props del wrapper de blur genérico.
 */
interface BlurContainerProps extends ViewProps {
  /** Intensidad del desenfoque (0-100) */
  intensity?: number;
  /** Tinte del blur: dark, light o default */
  tint?: 'dark' | 'light' | 'default';
  /** Si es true, elimina el fondo semitransparente base */
  transparent?: boolean;
}

/**
 * Contenedor genérico que aplica efecto de desenfoque a cualquier contenido hijo.
 *
 * A diferencia de GlassCard, BlurContainer no agrega bordes ni sombras;
 * es un wrapper puro de blur para composición flexible.
 *
 * @example
 * <BlurContainer intensity={30}>
 *   <MapView />
 *   <OverlayContent />
 * </BlurContainer>
 */
export const BlurContainer: React.FC<BlurContainerProps> = ({
  children,
  intensity = EFFECTS.blurIntensity,
  tint = 'dark',
  transparent = false,
  style,
  ...rest
}) => {
  return (
    <View
      style={[
        styles.container,
        !transparent && styles.background,
        style,
      ]}
      {...rest}
    >
      <BlurView
        intensity={intensity}
        tint={tint}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  background: {
    backgroundColor: COLORS.glassBgDark,
  },
});

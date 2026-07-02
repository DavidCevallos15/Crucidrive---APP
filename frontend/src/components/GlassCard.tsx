import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, SHAPES, EFFECTS } from '../constants/theme';

/**
 * Props del contenedor Glassmorphic reutilizable.
 */
interface GlassCardProps extends ViewProps {
  /** Intensidad del efecto de desenfoque (0-100). Por defecto usa el valor del tema. */
  blurIntensity?: number;
  /** Variante de color del borde */
  variant?: 'default' | 'highlight' | 'danger';
  /** Radio de bordes personalizado */
  borderRadius?: number;
  /** Si es true, no aplica padding interno */
  noPadding?: boolean;
}

/**
 * Contenedor Glassmorphic reutilizable.
 *
 * Aplica fondo semitransparente con desenfoque de fondo (backdrop blur),
 * bordes de cristal sutiles y sombra suave según el sistema de diseño
 * de CruciDrive (DESIGN.md).
 *
 * @example
 * <GlassCard>
 *   <Text>Contenido dentro del cristal</Text>
 * </GlassCard>
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  blurIntensity = EFFECTS.blurIntensity,
  variant = 'default',
  borderRadius = SHAPES.borderRadiusMd,
  noPadding = false,
  style,
  ...rest
}) => {
  const borderColor = {
    default: COLORS.glassBorderDark,
    highlight: COLORS.primaryLight,
    danger: COLORS.danger,
  }[variant];

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          borderColor,
        },
        EFFECTS.shadowDark,
        style,
      ]}
      {...rest}
    >
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={[
          styles.blurView,
          { borderRadius },
          !noPadding && styles.padding,
        ]}
      >
        {children}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: SHAPES.glassBorderWidth,
    backgroundColor: COLORS.glassBgDark,
  },
  blurView: {
    overflow: 'hidden',
  },
  padding: {
    padding: 16,
  },
});

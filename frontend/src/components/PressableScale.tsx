import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ANIMATION } from '../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** Escala al pulsar. Sutil: 0.95 a 0.98 */
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pressable con respuesta táctil: al pulsar se encoge un poco y al soltar vuelve
 * rápido. Es la confirmación visual de que la interfaz "escuchó" el toque.
 * Asimétrico a propósito: bajar es 100 ms, soltar es 160 ms, ambos ease-out.
 * Respeta "reducir movimiento" del sistema.
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  pressedScale = ANIMATION.pressScale,
  style,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      scale.value = withTiming(pressedScale, {
        duration: 100,
        easing: Easing.bezier(...ANIMATION.easeOut),
        reduceMotion: ReduceMotion.System,
      });
      onPressIn?.(event);
    },
    [scale, pressedScale, onPressIn]
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.value = withTiming(1, {
        duration: 160,
        easing: Easing.bezier(...ANIMATION.easeOut),
        reduceMotion: ReduceMotion.System,
      });
      onPressOut?.(event);
    },
    [scale, onPressOut]
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};

import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ANIMATION, FONTS, Z_INDEX } from '../constants/theme';

/**
 * Props del botón de pánico (SOS).
 */
interface PanicButtonProps {
  /** Callback ejecutado tras mantener presionado el tiempo requerido */
  onActivate: () => void;
  /** Si es true, el botón muestra estado activado */
  isActivated?: boolean;
  /** Si es true, deshabilita la interacción */
  disabled?: boolean;
}

/** Tamaño del botón principal (toque cómodo con el pulgar, mínimo 48) */
const BUTTON_SIZE = 64;

/**
 * Botón de Pánico (SOS).
 *
 * - Hay que mantenerlo presionado 2 s: evita activaciones accidentales.
 * - Mientras se mantiene, un relleno claro crece de forma lineal: el usuario ve
 *   cuánto falta. Al soltar antes, el relleno retrocede rápido (200 ms).
 * - Un solo anillo de latido lento y discreto lo mantiene localizable sin
 *   competir con el resto de la pantalla; se apaga con "reducir movimiento".
 * - Flota arriba a la derecha, bajo la barra de estado: nunca queda tapado por
 *   la ficha del viaje que sube desde abajo.
 */
export const PanicButton: React.FC<PanicButtonProps> = ({
  onActivate,
  isActivated = false,
  disabled = false,
}) => {
  const insets = useSafeAreaInsets();
  const buttonScale = useSharedValue(1);
  const hold = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.45);

  useEffect(() => {
    ringScale.value = withRepeat(
      withTiming(1.9, {
        duration: 2200,
        easing: Easing.bezier(...ANIMATION.easeOut),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.System
    );
    ringOpacity.value = withRepeat(
      withTiming(0, { duration: 2200, reduceMotion: ReduceMotion.System }),
      -1,
      false,
      undefined,
      ReduceMotion.System
    );
    return () => {
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
    };
  }, [ringScale, ringOpacity]);

  const handleActivation = useCallback(() => {
    onActivate();
  }, [onActivate]);

  const longPress = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(ANIMATION.panicHoldDuration)
    .onBegin(() => {
      buttonScale.value = withTiming(ANIMATION.pressScale, { duration: 100 });
      // Lento y lineal mientras el usuario decide: el relleno es el contador.
      hold.value = withTiming(1, {
        duration: ANIMATION.panicHoldDuration,
        easing: Easing.linear,
      });
    })
    .onStart(() => {
      runOnJS(handleActivation)();
    })
    .onFinalize(() => {
      buttonScale.value = withTiming(1, { duration: 160 });
      // Rápido al soltar: el sistema responde enseguida.
      hold.value = withTiming(0, {
        duration: 200,
        easing: Easing.bezier(...ANIMATION.easeOut),
      });
    });

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hold.value }],
    opacity: hold.value > 0 ? 1 : 0,
  }));

  return (
    <View style={[styles.wrapper, { top: insets.top + 76 }]} pointerEvents="box-none">
      {!isActivated && <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />}

      <GestureDetector gesture={longPress}>
        <Animated.View
          style={[styles.button, isActivated && styles.buttonActivated, buttonStyle]}
          accessibilityRole="button"
          accessibilityLabel="Botón de emergencia SOS. Mantén presionado 2 segundos para activar."
          accessibilityHint="Envía una alerta de emergencia con tu ubicación actual"
        >
          <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />
          <Ionicons name={isActivated ? 'alert' : 'alert-outline'} size={26} color={COLORS.white} />
          <Text style={styles.label}>SOS</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 16,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z_INDEX.panicButton,
  },
  ring: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  buttonActivated: {
    backgroundColor: COLORS.dangerLight,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  label: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    marginTop: -2,
    letterSpacing: 0.5,
  },
});

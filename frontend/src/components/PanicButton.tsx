import React, { useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ANIMATION, Z_INDEX } from '../constants/theme';

/**
 * Props del botón de pánico (SOS).
 */
interface PanicButtonProps {
  /** Callback ejecutado tras mantener presionado por 2 segundos */
  onActivate: () => void;
  /** Si es true, el botón muestra estado activado */
  isActivated?: boolean;
  /** Si es true, deshabilita la interacción */
  disabled?: boolean;
}

/** Tamaño del botón principal */
const BUTTON_SIZE = 64;
/** Número de anillos de la onda sonar */
const RING_COUNT = 3;

/**
 * Botón de Pánico (SOS) con efecto de pulso concéntrico tipo sonar.
 *
 * - Requiere pulsación sostenida de 2 segundos para activarse (previene activaciones accidentales).
 * - Muestra anillos concéntricos rojos que se expanden continuamente como ondas de sonar.
 * - Posición flotante fija en la esquina inferior izquierda sobre todos los demás elementos.
 *
 * @example
 * <PanicButton onActivate={handlePanic} />
 */
export const PanicButton: React.FC<PanicButtonProps> = ({
  onActivate,
  isActivated = false,
  disabled = false,
}) => {
  const buttonScale = useSharedValue(1);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Anillos de pulso sonar ──────────────────────────────
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.5);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.5);
  const ring3Scale = useSharedValue(1);
  const ring3Opacity = useSharedValue(0.5);

  /**
   * Inicia la animación de pulso sonar en los anillos concéntricos.
   */
  const startSonarAnimation = useCallback(() => {
    const animateRing = (
      scaleValue: Animated.SharedValue<number>,
      opacityValue: Animated.SharedValue<number>,
      delay: number
    ) => {
      scaleValue.value = withDelay(
        delay,
        withRepeat(
          withTiming(2.5, { duration: 1500 }),
          -1, // infinito
          false
        )
      );
      opacityValue.value = withDelay(
        delay,
        withRepeat(
          withTiming(0, { duration: 1500 }),
          -1,
          false
        )
      );
    };

    animateRing(ring1Scale, ring1Opacity, 0);
    animateRing(ring2Scale, ring2Opacity, 500);
    animateRing(ring3Scale, ring3Opacity, 1000);
  }, [ring1Scale, ring1Opacity, ring2Scale, ring2Opacity, ring3Scale, ring3Opacity]);

  /**
   * Detiene todas las animaciones sonar y restaura los valores iniciales.
   */
  const stopSonarAnimation = useCallback(() => {
    [ring1Scale, ring2Scale, ring3Scale].forEach((s) => {
      cancelAnimation(s);
      s.value = 1;
    });
    [ring1Opacity, ring2Opacity, ring3Opacity].forEach((o) => {
      cancelAnimation(o);
      o.value = 0.5;
    });
  }, [ring1Scale, ring1Opacity, ring2Scale, ring2Opacity, ring3Scale, ring3Opacity]);

  // Iniciar animación sonar al montar
  useEffect(() => {
    startSonarAnimation();
    return () => stopSonarAnimation();
  }, [startSonarAnimation, stopSonarAnimation]);

  // ─── Gestión del gesto de pulsación larga ───────────────
  const handleActivation = useCallback(() => {
    onActivate();
  }, [onActivate]);

  const longPressGesture = Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(ANIMATION.panicHoldDuration)
    .onStart(() => {
      buttonScale.value = withTiming(0.9, { duration: 200 });
    })
    .onEnd((_event, success) => {
      buttonScale.value = withTiming(1, { duration: 150 });
      if (success) {
        runOnJS(handleActivation)();
      }
    })
    .onFinalize(() => {
      buttonScale.value = withTiming(1, { duration: 150 });
    });

  // ─── Estilos animados ───────────────────────────────────
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const createRingStyle = (
    scaleValue: Animated.SharedValue<number>,
    opacityValue: Animated.SharedValue<number>
  ) =>
    useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
      opacity: opacityValue.value,
    }));

  const ring1Style = createRingStyle(ring1Scale, ring1Opacity);
  const ring2Style = createRingStyle(ring2Scale, ring2Opacity);
  const ring3Style = createRingStyle(ring3Scale, ring3Opacity);

  return (
    <View style={styles.wrapper}>
      {/* Anillos sonar */}
      {[ring1Style, ring2Style, ring3Style].map((ringStyle, index) => (
        <Animated.View
          key={`sonar-ring-${index}`}
          style={[styles.sonarRing, ringStyle]}
        />
      ))}

      {/* Botón principal */}
      <GestureDetector gesture={longPressGesture}>
        <Animated.View
          style={[
            styles.button,
            isActivated && styles.buttonActivated,
            buttonAnimatedStyle,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Botón de emergencia SOS. Mantén presionado 2 segundos para activar."
          accessibilityHint="Envía una alerta de emergencia con tu ubicación actual"
        >
          <Ionicons
            name={isActivated ? 'alert' : 'alert-outline'}
            size={28}
            color={COLORS.white}
          />
          <Text style={styles.label}>SOS</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z_INDEX.panicButton,
  },
  sonarRing: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.danger,
    backgroundColor: 'transparent',
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  buttonActivated: {
    backgroundColor: COLORS.dangerLight,
  },
  label: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },
});

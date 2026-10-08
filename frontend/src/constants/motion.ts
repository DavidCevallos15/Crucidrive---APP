import { Easing, FadeInUp, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { ANIMATION } from './theme';

/**
 * Entradas y salidas de paneles de la app (DESIGN.md, "Legibilidad y movimiento").
 * Entrada corta con ease-out, salida más rápida, y respeto a "reducir movimiento".
 */
export const PANEL_IN = FadeInUp.duration(ANIMATION.enterDuration)
  .easing(Easing.bezier(...ANIMATION.easeOut))
  .reduceMotion(ReduceMotion.System);

export const PANEL_OUT = FadeOut.duration(ANIMATION.exitDuration).reduceMotion(ReduceMotion.System);

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withTiming, ReduceMotion } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { ANIMATION, COLORS, FONTS } from '../constants/theme';
import { BrandLockup } from './BrandLockup';
import { PressableScale } from './PressableScale';

/** Una sola pasada de espuma; la animación vive en UI y solo finaliza una vez en React. */
export function CoastalIntro({ onFinish }: { onFinish(): void }) {
  const { height, width } = useWindowDimensions();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: ANIMATION.welcomeDuration, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System }));
    const timer = setTimeout(onFinish, ANIMATION.welcomeDuration);
    return () => { clearTimeout(timer); cancelAnimation(progress); };
  }, [onFinish, progress]);
  const wave = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(progress.get(), [0, 1], [height, -height * 1.7]) }] }));
  const curtain = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.78, 1], [1, 1, 0]) }));
  return <Animated.View style={[styles.overlay, curtain]} accessibilityViewIsModal testID="coastal-intro">
    <View style={styles.brand}><BrandLockup /><Text style={styles.caption}>Tu camino empieza en la costa.</Text></View>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width, height: height * 1.8 }, wave]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 1500" preserveAspectRatio="none">
        <Path fill={COLORS.blue} d="M0 70C80 140 120 0 220 65S330 130 400 50V1500H0Z" />
        <Path fill="none" stroke={COLORS.blueLight} strokeWidth="32" d="M-10 74C80 144 120 4 220 69S330 134 410 54" />
        <Path fill="none" stroke={COLORS.white} strokeWidth="10" d="M-10 64C80 134 120-6 220 59S330 124 410 44" />
        <Circle cx="60" cy="109" r="5" fill={COLORS.white} /><Circle cx="267" cy="106" r="8" fill={COLORS.white} /><Circle cx="319" cy="116" r="4" fill={COLORS.white} />
      </Svg>
    </Animated.View>
    <PressableScale onPress={onFinish} accessibilityRole="button" accessibilityLabel="Omitir animación" style={styles.skip}><Text style={styles.skipText}>Omitir</Text></PressableScale>
  </Animated.View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.sand, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  brand: { alignItems: 'center' },
  caption: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ink, marginTop: 16 },
  skip: { position: 'absolute', bottom: 48, right: 24, minWidth: 88, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderRadius: 16 },
  skipText: { color: COLORS.wine, fontFamily: 'Inter-Medium', fontSize: 14 },
});

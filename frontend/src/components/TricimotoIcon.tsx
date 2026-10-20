import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

/** Silueta frontal propia: techo, parabrisas, dos ruedas traseras y rueda delantera. */
export function TricimotoIcon({ size = 32, color = COLORS.wine, background = COLORS.sand }: { size?: number; color?: string; background?: string }) {
  return <View accessible={false} style={{ width: size, height: size }}>
    <View style={[styles.base, { transform: [{ scale: size / 48 }] }]}>
      <View style={[styles.roof, { backgroundColor: color }]} />
      <View style={[styles.body, { backgroundColor: color }]} />
      <View style={[styles.window, { backgroundColor: COLORS.blueLight, borderColor: background }]} />
      <View style={[styles.band, { backgroundColor: background }]} />
      <View style={[styles.light, styles.left, { backgroundColor: background }]} />
      <View style={[styles.light, styles.right, { backgroundColor: background }]} />
      <View style={[styles.wheel, styles.rearLeft]} /><View style={[styles.wheel, styles.rearRight]} />
      <View style={[styles.front, { borderColor: background }]} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  base: { width: 48, height: 48, position: 'absolute', left: '50%', top: '50%', marginLeft: -24, marginTop: -24 },
  roof: { position: 'absolute', left: 8, right: 8, top: 4, height: 9, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  body: { position: 'absolute', left: 6, right: 6, top: 13, height: 26, borderRadius: 8 },
  window: { position: 'absolute', left: 12, right: 12, top: 13, height: 13, borderWidth: 1.5, borderRadius: 4 },
  band: { position: 'absolute', left: 9, right: 9, top: 28, height: 2 },
  light: { position: 'absolute', top: 32, width: 6, height: 4, borderRadius: 2 },
  left: { left: 10 }, right: { right: 10 },
  wheel: { position: 'absolute', bottom: 5, width: 5, height: 12, borderRadius: 2, backgroundColor: COLORS.ink },
  rearLeft: { left: 5 }, rearRight: { right: 5 },
  front: { position: 'absolute', bottom: 1, left: 20, width: 8, height: 14, backgroundColor: COLORS.ink, borderWidth: 1, borderRadius: 4 },
});

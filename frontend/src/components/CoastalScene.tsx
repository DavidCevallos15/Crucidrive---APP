import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS } from '../constants/theme';

/** Escena de marca, sin coordenadas, tiempos o conductores ficticios. */
export function CoastalScene() {
  return <View style={styles.scene} accessible={false}>
    <Svg width="100%" height="100%" viewBox="0 0 500 400" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Path fill={COLORS.sand} d="M0 0h500v400H0z" />
      <Path fill={COLORS.blue} d="M0 0h500v95c-95 80-105 68-185 108C180 272 131 187 0 287z" />
      <Path fill={COLORS.blueLight} d="M0 272c131-95 184-23 306-80 81-38 104-27 194-98v15c-87 75-117 69-196 105C176 274 115 212 0 296z" />
      <Path fill={COLORS.white} d="M0 292c113-88 177-19 303-78 80-36 110-30 197-105v9c-87 78-120 73-198 107C178 282 114 222 0 304z" />
      <Path d="M55 360c65-20 125-19 188 0" fill="none" stroke={COLORS.wine} strokeOpacity=".15" strokeWidth="2" strokeDasharray="5 8" />
      <Circle cx="409" cy="38" r="25" fill={COLORS.sand} />
    </Svg>
    <Image source={require('../../assets/premium/tricimoto-hero.png')} resizeMode="contain" style={styles.vehicle} />
  </View>;
}
const styles = StyleSheet.create({
  scene: { width: '100%', aspectRatio: 1.3, backgroundColor: COLORS.sand, overflow: 'hidden', borderRadius: 32 },
  vehicle: { width: '86%', height: '90%', position: 'absolute', bottom: '-6%', right: '3%' },
});

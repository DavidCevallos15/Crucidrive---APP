import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel="CruciDrive">
      <Image source={require('../../assets/brand-mark.png')} style={compact ? styles.small : styles.mark} accessible={false} />
      <View>
        <Text style={[styles.name, compact && styles.compactName]}>Cruci<Text style={styles.accent}>Drive</Text></Text>
        {!compact && <Text style={styles.caption}>Tu camino por Crucita.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  mark: { width: 64, height: 64 },
  small: { width: 44, height: 44 },
  name: { fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.title, color: COLORS.white, letterSpacing: -0.7 },
  compactName: { fontSize: FONTS.sizes.xxl },
  accent: { color: COLORS.primaryLight },
  caption: { fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, color: COLORS.glassTextMutedDark, marginTop: SPACING.xs },
});

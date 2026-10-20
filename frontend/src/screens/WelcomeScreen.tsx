import React, { useCallback, useState, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BrandLockup } from '../components/BrandLockup';
import { CoastalScene } from '../components/CoastalScene';
import { CoastalIntro } from '../components/CoastalIntro';
import { GlassButton } from '../components/GlassButton';
import { TricimotoIcon } from '../components/TricimotoIcon';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { useServiceStore } from '../store/useServiceStore';

export function WelcomeScreen({ onContinue, onPresented }: { onContinue(): void; onPresented(): void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [intro, setIntro] = useState(!reduced);
  useEffect(() => { if (reduced) onPresented(); }, [reduced, onPresented]);
  const finishIntro = useCallback(() => { setIntro(false); onPresented(); }, [onPresented]);
  const select = (service: 'viaje' | 'encomienda') => { useServiceStore.getState().selectService(service); onContinue(); };
  const wide = width >= 900;
  return <View style={styles.screen}>
    <StatusBar style="dark" />
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}><BrandLockup compact /><Text style={styles.place}>Crucita, Ecuador</Text></View>
      <View style={[styles.layout, wide && styles.wide]} aria-hidden={intro} accessibilityElementsHidden={intro} importantForAccessibility={intro ? 'no-hide-descendants' : 'auto'}>
        <View style={[styles.art, wide && styles.wideArt]}><CoastalScene /></View>
        <View style={[styles.copy, wide && styles.wideCopy]}>
          <Text accessibilityRole="header" style={[styles.title, wide && styles.wideTitle]}>Bienvenido a{wide ? '\n' : ' '}<Text style={styles.accent}>CruciDrive.</Text></Text>
          <Text style={styles.description}>Tu destino está cerca. Muévete en tricimoto o envía una encomienda por Crucita.</Text>
          <View style={styles.actions}>
            <GlassButton label="Vamos a viajar" disabled={intro} onPress={() => select('viaje')} size="lg" leftIcon={<TricimotoIcon size={28} color={COLORS.white} background={COLORS.wine} />} />
            <GlassButton label="Enviar una encomienda" disabled={intro} onPress={() => select('encomienda')} variant="ghost" size="lg" leftIcon={<Ionicons name="cube-outline" size={22} color={COLORS.wine} />} />
          </View>
          <View style={styles.account}><Text style={styles.muted}>¿Ya tienes una cuenta?</Text><GlassButton label="Iniciar sesión" disabled={intro} variant="ghost" size="sm" onPress={() => { onPresented(); router.push('/(auth)/login'); }} /></View>
        </View>
      </View>
      <View style={styles.footer}><Ionicons name="location-outline" size={16} color={COLORS.wine} /><Text style={styles.footerText}>De aquí. Para movernos aquí.</Text></View>
    </ScrollView>
    {intro && <CoastalIntro onFinish={finishIntro} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.paper, overflow: 'hidden' },
  content: { flexGrow: 1, paddingHorizontal: SPACING.lg, width: '100%', maxWidth: 1248, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 },
  place: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.glassTextMutedDark, flexShrink: 1, textAlign: 'right' },
  layout: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center' },
  wide: { flexDirection: 'row', alignItems: 'center', gap: 72, maxWidth: 1200 },
  art: { width: '100%', marginBottom: 24 }, wideArt: { flex: 1.2, marginBottom: 0 },
  copy: { width: '100%' }, wideCopy: { flex: 1 },
  title: { fontFamily: 'Outfit-SemiBold', fontSize: 36, lineHeight: 41, letterSpacing: -0.9, color: COLORS.ink },
  wideTitle: { fontSize: 56, lineHeight: 60, letterSpacing: -1.4 }, accent: { color: COLORS.wine },
  description: { fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, fontSize: 15, lineHeight: 24, marginTop: 12, maxWidth: 400 },
  actions: { gap: 12, marginTop: 28 },
  account: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  muted: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.glassTextMutedDark },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 20 },
  footerText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.glassTextMutedDark },
});

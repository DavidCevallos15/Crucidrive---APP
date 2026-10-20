import React from 'react';
import { ImageBackground, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CoastalScene } from './CoastalScene';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { PANEL_IN } from '../constants/motion';
import { BrandLockup } from './BrandLockup';

interface AuthScaffoldProps {
  children: React.ReactNode;
  showBrand?: boolean;
  welcome?: boolean;
}

export const AuthScaffold: React.FC<AuthScaffoldProps> = ({ children, showBrand = true, welcome = false }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = welcome && width >= 900;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg }, wide && styles.wideContent]}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        >
          <View style={[styles.layout, wide && styles.wideLayout]}>
            {showBrand && (
              <View style={[styles.brand, wide && styles.wideBrand]}>
                <BrandLockup />
                {welcome && (
                  <View style={[styles.story, wide && styles.wideStory]}>
                    <Text style={[styles.headline, wide && styles.wideHeadline]} accessibilityRole="header">El siguiente destino{wide ? '\n' : ' '}está cerca.</Text>
                    <Text style={styles.description}>Muévete en tricimoto por Crucita. Pide tu viaje, encuentra tu ruta y sigue tu camino.</Text>
                    {wide && <View style={{ marginTop: 32, maxWidth: 480 }}><CoastalScene /></View>}
                    {wide && <View style={styles.local}><Ionicons name="location-outline" size={20} color={COLORS.wine} /><Text style={styles.localText}>Hecho para movernos en Crucita.</Text></View>}
                  </View>
                )}
              </View>
            )}
            <Animated.View entering={PANEL_IN} style={[styles.body, wide && styles.wideBody]}>{children}</Animated.View>
          </View>
          <View style={styles.footer}>
            <Ionicons name="location-outline" size={14} color={COLORS.glassTextMutedDark} />
            <Text style={styles.footerText}>Crucita · Manabí · Ecuador</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg, overflow: 'hidden' },
  backgroundImage: { width: '100%', height: '100%' },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  wideContent: { paddingHorizontal: SPACING.xxl },
  layout: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  wideLayout: { maxWidth: 1200, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.xxl },
  brand: { marginBottom: SPACING.lg },
  wideBrand: { flex: 1, alignSelf: 'stretch', justifyContent: 'space-between', paddingVertical: SPACING.lg, marginBottom: 0 },
  story: { marginTop: SPACING.lg },
  wideStory: { marginTop: 40, marginBottom: SPACING.xl },
  headline: { fontFamily: 'Outfit-SemiBold', color: COLORS.ink, fontSize: FONTS.sizes.title, lineHeight: 38, letterSpacing: -0.6 },
  wideHeadline: { fontSize: 56, lineHeight: 60, letterSpacing: -1.4 },
  description: { fontFamily: FONTS.body, color: COLORS.glassTextDark, fontSize: FONTS.sizes.sm, lineHeight: 22, marginTop: SPACING.sm, maxWidth: 360 },
  local: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl },
  localText: { fontFamily: FONTS.body, color: COLORS.glassTextDark, fontSize: FONTS.sizes.sm },
  body: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  wideBody: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.lg },
  footerText: { fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, color: COLORS.glassTextMutedDark },
});

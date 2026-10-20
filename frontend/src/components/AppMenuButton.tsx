import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useServiceStore, type ServiceType } from '../store/useServiceStore';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { rutaInicial } from '../utils/routing';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { TricimotoIcon } from './TricimotoIcon';
import { BrandLockup } from './BrandLockup';
import { PressableScale } from './PressableScale';

export function AppMenuButton() {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, session, verification } = useAuthStore();
  const { signOut, authError, isLoading } = useSupabaseAuth();
  const service = useServiceStore((s) => s.service);
  const selectService = useServiceStore((s) => s.selectService);
  const passenger = !profile || profile.rol === 'pasajero';
  const home = profile ? rutaInicial(profile.rol, verification?.estado ?? null) : '/';
  const go = (route: string) => { setOpen(false); router.push(route as never); };
  const choose = (next: ServiceType) => { selectService(next); go(home); };
  const row = (label: string, icon: keyof typeof Ionicons.glyphMap, action: () => void, selected = false) => (
    <PressableScale onPress={action} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} style={[styles.row, selected && styles.selected]}>
      {label === 'Viajar en tricimoto' ? <TricimotoIcon size={26} color={selected ? COLORS.wine : COLORS.glassTextMutedDark} /> : <Ionicons name={icon} size={22} color={selected ? COLORS.primaryLight : COLORS.glassTextMutedDark} />}
      <Text style={[styles.rowText, selected && styles.selectedText]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.glassTextMutedDark} />
    </PressableScale>
  );
  return <>
    <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Abrir menú de CruciDrive" accessibilityState={{ expanded: open }} style={styles.trigger}>
      <Ionicons name="menu-outline" size={26} color={COLORS.glassTextDark} />
    </PressableScale>
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessible={false} focusable={false} />
        <View style={[styles.drawer, { width: Math.min(width - 36, 360), paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md }]} accessibilityViewIsModal>
          <View style={styles.heading}><BrandLockup compact /><PressableScale accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setOpen(false)} style={styles.close}><Ionicons name="close" size={24} color={COLORS.glassTextDark} /></PressableScale></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.account}><View style={styles.avatar}><Ionicons name="person-outline" size={24} color={COLORS.primaryLight} /></View><View style={styles.flex}><Text style={styles.name}>{profile?.nombre ?? 'Hola, te damos la bienvenida'}</Text><Text style={styles.muted}>{profile?.rol === 'conductor' ? 'Conductor de tricimoto' : profile?.rol === 'admin' ? 'Administración' : session ? 'Tu cuenta CruciDrive' : 'Inicia sesión para solicitar'}</Text></View></View>
            <Text style={styles.group}>Servicios</Text>
            {passenger ? <>
              {row('Viajar en tricimoto', 'navigate-outline', () => choose('viaje'), service === 'viaje')}
              {row('Enviar una encomienda', 'cube-outline', () => choose('encomienda'), service === 'encomienda')}
            </> : row(profile?.rol === 'admin' ? 'Administración' : 'Consola del conductor', 'map-outline', () => go(home))}
            {session && profile && row('Mi cuenta', 'person-circle-outline', () => go('/(settings)/cuenta'))}
            <Text style={styles.group}>Tu app</Text>
            {row('Configuración', 'settings-outline', () => go('/(settings)/configuracion'))}
            {row('Seguridad y emergencias', 'shield-checkmark-outline', () => go('/(settings)/seguridad'))}
            {row('Ayuda', 'help-circle-outline', () => go('/(settings)/ayuda'))}
            {row('Privacidad y mis datos', 'lock-closed-outline', () => go('/(settings)/privacidad'))}
            {row('Acerca de CruciDrive', 'information-circle-outline', () => go('/(settings)/acerca'))}
          </ScrollView>
          <View style={styles.bottom}>
            {session ? row(isLoading ? 'Cerrando sesión…' : 'Cerrar sesión', 'log-out-outline', async () => { if (isLoading) return; await signOut(); if (!useAuthStore.getState().session) { setOpen(false); router.replace('/'); } }) : row('Iniciar sesión o crear cuenta', 'log-in-outline', () => go('/(auth)/login'))}
            {authError && <Text style={styles.error} accessibilityRole="alert">{authError}</Text>}
            <Text style={styles.footer}>Crucita · Solo tricimotos</Text>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.darkBg, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: COLORS.overlay },
  drawer: { flex: 1, backgroundColor: COLORS.darkBg, paddingHorizontal: SPACING.md },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 12, marginBottom: SPACING.xs },
  selected: { backgroundColor: COLORS.wineSoft },
  rowText: { flex: 1, color: COLORS.glassTextDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm },
  selectedText: { color: COLORS.primaryLight },
  group: { fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.sm, color: COLORS.glassTextMutedDark, marginTop: SPACING.lg, marginBottom: SPACING.sm, paddingLeft: SPACING.md },
  account: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorderDark },
  avatar: { width: 48, height: 48, backgroundColor: COLORS.glassBgDark, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { color: COLORS.glassTextDark, fontFamily: 'Outfit-SemiBold', fontSize: FONTS.sizes.base },
  muted: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, lineHeight: 18, marginTop: SPACING.xs },
  flex: { flex: 1 },
  bottom: { borderTopWidth: 1, borderTopColor: COLORS.glassBorderDark, paddingTop: SPACING.sm },
  footer: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, textAlign: 'center' },
  error: { color: COLORS.dangerLight, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, padding: SPACING.sm },
});

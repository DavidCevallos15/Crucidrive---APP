import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { abrirTrasDeslizar, BORDE_MENU, cerrarTrasDeslizar } from '../utils/menuGesture';

const MenuContext = createContext({ open: false, abrir: () => {}, registrar: (_delta: number) => {} });

/** Solo reserva el borde en pantallas que tienen un botón de menú montado. */
/** Margen para que el menú termine de cerrarse antes de empezar a cerrar la sesión. */
const MENU_CERRADO_MS = 150;

export function AppMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [triggers, setTriggers] = useState(0);
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const insets = useSafeAreaInsets();
  const abrir = useCallback(() => setOpen(true), []);
  const registrar = useCallback((delta: number) => setTriggers((n) => Math.max(0, n + delta)), []);
  const context = useMemo(() => ({ open, abrir, registrar }), [open, abrir, registrar]);
  useEffect(() => setOpen(false), [pathname, userId]);
  const borde = Gesture.Pan().maxPointers(1).activeOffsetX(18).failOffsetX(-10).failOffsetY([-12, 12])
    .onEnd((e) => { if (abrirTrasDeslizar(e.translationX, e.velocityX)) runOnJS(abrir)(); });
  return <MenuContext.Provider value={context}>
    {children}
    {triggers > 0 && !open && <GestureDetector gesture={borde}>
      <View accessible={false} style={[styles.edge, { top: insets.top + 64, bottom: insets.bottom + 85 }]} />
    </GestureDetector>}
    <MenuDrawer open={open} setOpen={setOpen} />
  </MenuContext.Provider>;
}

export function AppMenuButton({ edgeSwipe = true }: { edgeSwipe?: boolean }) {
  const { open, abrir, registrar } = useContext(MenuContext);
  useFocusEffect(useCallback(() => {
    if (!edgeSwipe) return;
    registrar(1);
    return () => registrar(-1);
  }, [registrar, edgeSwipe]));
  return <PressableScale onPress={abrir} accessibilityRole="button" accessibilityLabel="Abrir menú de CruciDrive" accessibilityState={{ expanded: open }} style={styles.trigger}>
    <Ionicons name="menu-outline" size={26} color={COLORS.glassTextDark} />
  </PressableScale>;
}

function MenuDrawer({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width - 36, 360);
  const offset = useSharedValue(-drawerWidth);
  const cerrado = useCallback(() => setOpen(false), [setOpen]);
  const cerrar = useCallback(() => {
    offset.set(withSpring(-drawerWidth, { duration: 300, dampingRatio: 1, overshootClamping: true, reduceMotion: ReduceMotion.System }, (finished) => {
      if (finished) runOnJS(cerrado)();
    }));
  }, [offset, drawerWidth, cerrado]);
  useEffect(() => {
    offset.set(open ? withSpring(0, { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System }) : -drawerWidth);
  }, [open, drawerWidth, offset]);
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const closeGesture = Gesture.Pan().maxPointers(1).activeOffsetX(-16).failOffsetY([-12, 12])
    .onUpdate((e) => offset.set(Math.max(-drawerWidth, Math.min(0, e.translationX))))
    .onEnd((e) => {
      if (cerrarTrasDeslizar(e.translationX, e.velocityX, drawerWidth)) runOnJS(cerrar)();
      else offset.set(withSpring(0, { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
    })
    .onFinalize((_e, success) => {
      if (!success) offset.set(withSpring(0, { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System }));
    });
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, session, verification } = useAuthStore();
  const { signOut, authError, isSigningOut } = useSupabaseAuth();
  const service = useServiceStore((s) => s.service);
  const selectService = useServiceStore((s) => s.selectService);
  const passenger = !profile || profile.rol === 'pasajero';
  const home = profile ? rutaInicial(profile.rol, verification?.estado ?? null) : '/';
  const go = (route: string) => { setOpen(false); router.push(route as never); };
  // Primero se cierra el menú y después empieza la salida (campo, 21 oct 2026): así el menú no
  // se desmonta en el mismo instante que el mapa. El progreso y el error los muestra la
  // pantalla de salida del layout privado.
  const salir = () => { setOpen(false); setTimeout(() => { void signOut(); }, MENU_CERRADO_MS); };
  const choose = (next: ServiceType) => { selectService(next); go(home); };
  const row = (label: string, icon: keyof typeof Ionicons.glyphMap, action: () => void, selected = false, busy = false) => (
    <PressableScale onPress={action} disabled={isSigningOut} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: isSigningOut, busy }} style={[styles.row, selected && styles.selected]}>
      {busy ? <ActivityIndicator color={COLORS.wine} /> : label === 'Viajar en tricimoto' ? <TricimotoIcon size={26} color={selected ? COLORS.wine : COLORS.glassTextMutedDark} /> : <Ionicons name={icon} size={22} color={selected ? COLORS.primaryLight : COLORS.glassTextMutedDark} />}
      <Text style={[styles.rowText, selected && styles.selectedText]}>{label}</Text>
      {!busy && <Ionicons name="chevron-forward" size={16} color={COLORS.glassTextMutedDark} />}
    </PressableScale>
  );
  return <Modal visible={open} transparent animationType="none" onRequestClose={cerrar} statusBarTranslucent>
      <GestureHandlerRootView style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} accessible={false} focusable={false} />
        <GestureDetector gesture={closeGesture}>
        <Animated.View style={[styles.drawer, { width: drawerWidth, paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.md }, panelStyle]} accessibilityViewIsModal>
          <View style={styles.heading}><BrandLockup compact /><PressableScale accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={cerrar} style={styles.close}><Ionicons name="close" size={24} color={COLORS.glassTextDark} /></PressableScale></View>
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
            {session ? row(isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión', 'log-out-outline', salir, false, isSigningOut) : row('Iniciar sesión o crear cuenta', 'log-in-outline', () => go('/(auth)/login'))}
            {isSigningOut && <Text style={styles.footer} accessibilityLiveRegion="polite">Estamos cerrando tu sesión. Puede tardar unos segundos.</Text>}
            {authError && <Text style={styles.error} accessibilityRole="alert">{authError}</Text>}
            <Text style={styles.footer}>Crucita · Solo tricimotos</Text>
          </View>
        </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>;
}

const styles = StyleSheet.create({
  trigger: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.darkBg, alignItems: 'center', justifyContent: 'center' },
  edge: { position: 'absolute', top: 72, bottom: 0, left: 0, width: BORDE_MENU, zIndex: 100 },
  overlay: { flex: 1, backgroundColor: COLORS.overlay },
  drawer: { flex: 1, backgroundColor: COLORS.darkBg, paddingHorizontal: SPACING.md },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
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

import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import { useSupabaseAuth } from '../src/hooks/useSupabaseAuth';
import { COLORS } from '../src/constants/theme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();
import { COLORS } from '../src/constants/theme';

/**
 * Layout raíz de la aplicación CruciDrive.
 *
 * Responsabilidades:
 * 1. Proveer GestureHandlerRootView (requerido por react-native-gesture-handler)
 * 2. Verificar la sesión de autenticación al iniciar
 * 3. Redirigir al login o a la app según el estado de la sesión
 */
export default function RootLayout() {
  const { isLoading, isInitialized, session, profile } = useSupabaseAuth();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'Outfit-Regular': Outfit_400Regular,
    'Outfit-Medium': Outfit_500Medium,
    'Outfit-SemiBold': Outfit_600SemiBold,
    'Outfit-Bold': Outfit_700Bold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // ─── Redirección basada en autenticación ──────────────────
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const hasSession = session !== null;

    if (!hasSession && !inAuthGroup) {
      // Sin sesión, redirigir al login
      router.replace('/(auth)/login');
    } else if (hasSession && inAuthGroup) {
      // Con sesión, redirigir según el rol del usuario
      if (profile?.rol === 'conductor') {
        router.replace('/(app)/(driver)');
      } else {
        router.replace('/(app)/(passenger)');
      }
    }
  }, [isInitialized, session, profile, segments]);

  // ─── Pantalla de carga mientras se verifica la sesión o cargan fuentes ─────
  if (!isInitialized || isLoading || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Slot />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkBg,
  },
});

import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
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
import { destinoGuardia, mostrarCargaInicial } from '../src/utils/routing';
import { useRespuestaAvisos } from '../src/hooks/useRespuestaAvisos';
import { variablesFaltantes } from '../src/constants/config';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Se calcula una vez: las variables quedan fijas al compilar.
const FALTANTES = variablesFaltantes();

/**
 * Un APK compilado sin las variables EXPO_PUBLIC_* no puede conectarse a nada. En vez de
 * cerrarse sin explicación, la app dice cuáles faltan (solo los nombres, nunca valores).
 */
export default function RootLayout() {
  if (FALTANTES.length > 0) return <ConfiguracionFaltante faltantes={FALTANTES} />;
  return <AppRaiz />;
}

function ConfiguracionFaltante({ faltantes }: { faltantes: string[] }) {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={styles.loadingContainer} accessibilityRole="alert">
      <StatusBar style="light" />
      <Text style={styles.configTitulo}>Falta configurar esta versión de la app</Text>
      <Text style={styles.configTexto}>
        Estas variables de entorno faltan o tienen un valor inválido (por ejemplo, una clave copiada con puntos ••• de un panel). Corrígelas en EAS (entorno de este perfil) y vuelve a compilar:
      </Text>
      {faltantes.map((nombre) => (
        <Text key={nombre} style={styles.configVariable}>{nombre}</Text>
      ))}
    </View>
  );
}

/**
 * Layout raíz de la aplicación CruciDrive.
 *
 * Responsabilidades:
 * 1. Proveer GestureHandlerRootView (requerido por react-native-gesture-handler)
 * 2. Verificar la sesión de autenticación al iniciar
 * 3. Redirigir según sesión y rol; la ruta raíz muestra el mapa del pasajero
 */
function AppRaiz() {
  const {
    isInitialized, session, profile, profileChecked, verification, verificationChecked,
  } = useSupabaseAuth({ bootstrap: true });
  const segments = useSegments() as string[];
  const router = useRouter();

  // Tocar un aviso (paso 004): con la cuenta lista, para que la guardia no deshaga la navegación.
  const cuentaLista = Boolean(session && profile && (profile.rol !== 'conductor' || verificationChecked));
  useRespuestaAvisos(cuentaLista ? profile?.rol ?? null : null);

  const [fontsLoaded, fontError] = useFonts({
    // Alias con el nombre que usan los estilos (FONTS.heading / FONTS.body). Sin ellos,
    // 'Outfit' e 'Inter' no existen y el texto cae a la tipografía serif del navegador.
    Outfit: Outfit_600SemiBold,
    Inter: Inter_400Regular,
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

  // ─── Guardia de navegación por sesión, perfil y rol (spec 002) ─────
  useEffect(() => {
    const destino = destinoGuardia(segments, {
      isInitialized,
      hasSession: Boolean(session),
      profileChecked,
      rol: profile?.rol ?? null,
      verificationChecked,
      verificacion: verification?.estado ?? null,
    });
    if (destino) router.replace(destino as never);
  }, [isInitialized, session, profile, profileChecked, verification, verificationChecked, segments, router]);

  // ─── Pantalla de carga mientras se verifica la sesión o cargan fuentes ─────
  if (mostrarCargaInicial(isInitialized, fontsLoaded, Boolean(fontError))) {
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
  configTitulo: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  configTexto: {
    color: COLORS.glassTextMutedDark,
    fontSize: 15,
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  configVariable: {
    color: COLORS.secondaryLight,
    fontSize: 15,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});

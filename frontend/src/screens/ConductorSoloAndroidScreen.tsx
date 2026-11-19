import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassButton } from '../components/GlassButton';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { TEXTO_INSTALAR } from '../utils/instalarIphone';

/**
 * Un conductor que entra desde la web (iPhone u otro navegador) ve esto en lugar de la consola
 * y de la verificación (spec 018, criterio 11; W2). En la web no hay ubicación con la pantalla
 * apagada, así que un botón «Disponible» no le traería ofertas.
 */
export default function ConductorSoloAndroidScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSupabaseAuth();
  const [saliendo, setSaliendo] = useState(false);

  const salir = async () => {
    setSaliendo(true);
    try {
      await signOut();
    } finally {
      setSaliendo(false);
    }
  };

  return (
    <View style={[styles.pantalla, { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.xl }]}>
      <Ionicons name="logo-android" size={56} color={COLORS.success} accessibilityElementsHidden />
      <Text style={styles.titulo} accessibilityRole="header">Usa la app de Android para conducir</Text>
      <Text style={styles.texto}>{TEXTO_INSTALAR.conductor}</Text>
      <Text style={styles.texto}>Pide el enlace de instalación a CruciDrive. Con esta cuenta entras igual en Android.</Text>
      <GlassButton label={saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'} onPress={() => { void salir(); }} size="lg" variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    backgroundColor: '#FFFCF7',
  },
  titulo: { fontFamily: FONTS.heading, fontSize: FONTS.sizes.xxl, fontWeight: '700', color: COLORS.glassTextDark, textAlign: 'center' },
  texto: { fontFamily: FONTS.body, fontSize: FONTS.sizes.base, lineHeight: 24, color: COLORS.glassTextDark, textAlign: 'center', maxWidth: 420 },
});

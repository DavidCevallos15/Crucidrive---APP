import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { PANEL_IN } from '../constants/motion';

interface AuthScaffoldProps {
  children: React.ReactNode;
  /** Muestra la marca arriba. Se oculta en pantallas largas para ganar espacio. */
  showBrand?: boolean;
}

/**
 * Fondo y estructura común de las pantallas de cuenta (inicio de sesión, perfil,
 * verificación): gradiente marino, contenido centrado con ancho máximo y desplazamiento
 * con teclado, para que ningún campo quede tapado en teléfonos pequeños.
 */
export const AuthScaffold: React.FC<AuthScaffoldProps> = ({ children, showBrand = true }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[COLORS.primary, '#0A2F42', COLORS.darkBg]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + SPACING.lg, paddingBottom: insets.bottom + SPACING.lg },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showBrand && (
            <Animated.View entering={PANEL_IN} style={styles.brand}>
              <Text style={styles.appName}>CruciDrive</Text>
              <Text style={styles.tagline}>Transporte hiperlocal, claro como el océano.</Text>
            </Animated.View>
          )}
          <Animated.View entering={PANEL_IN} style={styles.body}>
            {children}
          </Animated.View>
          <Text style={styles.footer}>Crucita, Manabí, Ecuador</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  brand: { alignItems: 'center', marginBottom: SPACING.lg },
  appName: {
    fontSize: FONTS.sizes.title,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  body: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  footer: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});

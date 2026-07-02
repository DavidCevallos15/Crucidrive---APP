import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { GlassCard } from '../../components/GlassCard';
import { GlassButton } from '../../components/GlassButton';
import { GlassInput } from '../../components/GlassInput';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useSupabaseAuth } from '../../hooks/useSupabaseAuth';
import { COLORS, FONTS, SPACING } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Pantalla de Autenticación con SMS/OTP.
 *
 * Flujo:
 * 1. El usuario ingresa su número de teléfono
 * 2. Se envía un código OTP por SMS vía Supabase Auth
 * 3. El usuario ingresa el código de 6 dígitos
 * 4. Se verifica y se redirige según su rol
 *
 * Diseño: Tarjeta Glassmorphic central sobre gradiente
 * radial azul océano → cian marino (DESIGN.md §3.A).
 */
export const LoginScreen: React.FC = () => {
  const {
    isLoading,
    otpSent,
    authError,
    sendOtp,
    verifyOtp,
    setAuthError,
    setOtpSent,
  } = useSupabaseAuth();

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');

  /**
   * Formatea el teléfono para Ecuador (+593).
   * Agrega el prefijo si el usuario no lo incluye.
   */
  const formatPhone = useCallback((raw: string): string => {
    const cleaned = raw.replace(/\D/g, '');
    if (cleaned.startsWith('593')) return `+${cleaned}`;
    if (cleaned.startsWith('0')) return `+593${cleaned.slice(1)}`;
    return `+593${cleaned}`;
  }, []);

  /**
   * Maneja el envío del código OTP.
   */
  const handleSendOtp = useCallback(async () => {
    if (!phone.trim()) {
      setAuthError('Ingresa tu número de teléfono.');
      return;
    }

    const formattedPhone = formatPhone(phone);
    await sendOtp(formattedPhone);
  }, [phone, formatPhone, sendOtp, setAuthError]);

  /**
   * Maneja la verificación del código OTP.
   */
  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      setAuthError('El código debe ser de 6 dígitos.');
      return;
    }

    const formattedPhone = formatPhone(phone);
    await verifyOtp(formattedPhone, otpCode);
  }, [otpCode, phone, formatPhone, verifyOtp, setAuthError]);

  /**
   * Vuelve al paso de ingreso de teléfono.
   */
  const handleGoBack = useCallback(() => {
    setOtpSent(false);
    setOtpCode('');
    setAuthError(null);
  }, [setOtpSent, setAuthError]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Fondo gradiente radial marino */}
      <LinearGradient
        colors={[COLORS.primary, '#0A2F42', COLORS.darkBg]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Branding */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(600)}
          style={styles.brandingContainer}
        >
          <Text style={styles.appName}>CruciDrive</Text>
          <Text style={styles.tagline}>
            Transporte hiperlocal, claro como el océano.
          </Text>
        </Animated.View>

        {/* Tarjeta Glassmorphic de Login */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <GlassCard style={styles.loginCard}>
            <Text style={styles.cardTitle}>
              {otpSent ? 'Verificar código' : 'Iniciar sesión'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {otpSent
                ? `Ingresa el código de 6 dígitos enviado a ${phone}`
                : 'Ingresa tu número de teléfono para recibir un código por SMS'}
            </Text>

            {!otpSent ? (
              // ─── Paso 1: Ingreso de teléfono ────────────────
              <>
                <GlassInput
                  label="Número de teléfono"
                  placeholder="+593 99 123 4567"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={phone}
                  onChangeText={setPhone}
                  error={authError ?? undefined}
                  required
                />
                <GlassButton
                  label="Enviar código"
                  onPress={handleSendOtp}
                  variant="secondary"
                  size="lg"
                  loading={isLoading}
                  style={styles.mainButton}
                />
              </>
            ) : (
              // ─── Paso 2: Verificación OTP ────────────────────
              <>
                <GlassInput
                  label="Código de verificación"
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  error={authError ?? undefined}
                  required
                />
                <GlassButton
                  label="Verificar"
                  onPress={handleVerifyOtp}
                  variant="secondary"
                  size="lg"
                  loading={isLoading}
                  style={styles.mainButton}
                />
                <GlassButton
                  label="Cambiar número"
                  onPress={handleGoBack}
                  variant="ghost"
                  size="sm"
                  style={styles.backButton}
                />
              </>
            )}
          </GlassCard>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(600)}
          style={styles.footer}
        >
          <Text style={styles.footerText}>
            Crucita, Manabí — Ecuador
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  appName: {
    fontSize: FONTS.sizes.display,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.white,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.sm,
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  loginCard: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  cardTitle: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginBottom: SPACING.lg,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.normal,
  },
  mainButton: {
    marginTop: SPACING.sm,
    alignSelf: 'stretch',
  },
  backButton: {
    marginTop: SPACING.sm,
    alignSelf: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  footerText: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
  },
});

export default LoginScreen;

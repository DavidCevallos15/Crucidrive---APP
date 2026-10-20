import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScaffold } from '../components/AuthScaffold';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { PressableScale } from '../components/PressableScale';
import { Ionicons } from '@expo/vector-icons';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { validarEmail, validarPassword, PASSWORD_MIN } from '../utils/validators';

type Modo = 'entrar' | 'crear';

/**
 * Inicio de sesión y creación de cuenta con correo y contraseña (spec 002, D-04: sin SMS).
 *
 * Crear la cuenta solo registra el correo y la contraseña. El perfil (nombre, teléfono, rol)
 * y el consentimiento se completan después, en la pantalla "Completa tu perfil", porque
 * Supabase puede pedir confirmar el correo antes de dar una sesión.
 */
export const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { isLoading, signIn, signUp } = useSupabaseAuth();

  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<{ email?: string; password?: string; general?: string }>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const enviando = useRef(false);

  const cambiarModo = useCallback((nuevo: Modo) => {
    if (enviando.current) return;
    setModo(nuevo);
    setErrores({});
    setAviso(null);
  }, []);

  const enviar = useCallback(async () => {
    if (enviando.current || isLoading) return;
    const nuevos = {
      email: validarEmail(email) ?? undefined,
      password: validarPassword(password) ?? undefined,
    };
    // En "entrar" basta con que haya contraseña; el mínimo solo se exige al crearla.
    if (modo === 'entrar' && password) nuevos.password = undefined;
    setErrores(nuevos);
    setAviso(null);
    if (nuevos.email || nuevos.password) return;

    enviando.current = true;
    try {
    if (modo === 'entrar') {
      const r = await signIn(email, password);
      if (!r.ok) setErrores({ general: r.error });
      return; // el layout raíz lleva al usuario a su pantalla
    }

    const r = await signUp(email, password);
    if (!r.ok) {
      setErrores({ general: r.error });
    } else if (r.requiereConfirmarCorreo) {
      setAviso(`Te enviamos un correo a ${email.trim()}. Confírmalo y luego inicia sesión.`);
      setModo('entrar');
      setPassword('');
    }
    } finally {
      enviando.current = false;
    }
  }, [modo, email, password, signIn, signUp, isLoading]);

  return (
    <AuthScaffold welcome>
      <GlassCard>
        <View style={styles.formContent}>
        <View style={styles.modes}>
          {(['entrar', 'crear'] as const).map((item) => (
            <PressableScale key={item} onPress={() => cambiarModo(item)} disabled={isLoading}
              accessibilityRole="button" accessibilityState={{ selected: modo === item, disabled: isLoading }}
              style={[styles.mode, modo === item && styles.modeActive]}>
              <Text style={[styles.modeText, modo === item && styles.modeTextActive]}>{item === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>
            </PressableScale>
          ))}
        </View>
        <Text style={styles.titulo} accessibilityRole="header">
          {modo === 'entrar' ? 'Qué bueno verte.' : 'Empieza tu camino.'}
        </Text>
        <Text style={styles.subtitulo}>
          {modo === 'entrar'
            ? 'Entra a tu cuenta y nos ponemos en marcha.'
            : `Usa un correo que puedas abrir y una contraseña de al menos ${PASSWORD_MIN} caracteres.`}
        </Text>

        {aviso ? (
          <View style={styles.aviso} accessibilityRole="alert">
            <Text style={styles.avisoTexto}>{aviso}</Text>
          </View>
        ) : null}

        <GlassInput
          label="Correo electrónico"
          leadingIcon="mail-outline"
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={(value) => { setEmail(value); setErrores((e) => ({ ...e, email: undefined, general: undefined })); }}
          editable={!isLoading}
          maxLength={254}
          error={errores.email}
          required
        />
        <GlassInput
          label="Contraseña"
          leadingIcon="lock-closed-outline"
          placeholder={modo === 'crear' ? `Mínimo ${PASSWORD_MIN} caracteres` : 'Tu contraseña'}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          textContentType={modo === 'crear' ? 'newPassword' : 'password'}
          value={password}
          onChangeText={(value) => { setPassword(value); setErrores((e) => ({ ...e, password: undefined, general: undefined })); }}
          editable={!isLoading}
          onSubmitEditing={enviar}
          error={errores.password}
          required
        />

        {errores.general ? (
          <Text style={styles.errorGeneral} accessibilityRole="alert">
            {errores.general}
          </Text>
        ) : null}

        <GlassButton
          label={modo === 'entrar' ? 'Entrar a CruciDrive' : 'Crear mi cuenta'}
          leftIcon={<Ionicons name="arrow-forward" size={20} color={COLORS.darkBg} />}
          onPress={enviar}
          variant="secondary"
          size="lg"
          loading={isLoading}
          style={styles.principal}
        />
        <View style={styles.privacy}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.primaryLight} />
          <Text style={styles.privacyText}>Tu ubicación se comparte durante el viaje. Si conduces, también cuando estás disponible.</Text>
        </View>
        </View>
      </GlassCard>

      <GlassButton
        label="Explorar el mapa"
        leftIcon={<Ionicons name="map-outline" size={18} color={COLORS.glassTextDark} />}
        onPress={() => router.replace('/')}
        variant="ghost"
        size="sm"
        style={styles.volver}
      />
    </AuthScaffold>
  );
};

const styles = StyleSheet.create({
  formContent: { padding: SPACING.sm },
  modes: { flexDirection: 'row', backgroundColor: COLORS.darkBg, borderRadius: 12, padding: SPACING.xs, marginBottom: SPACING.lg },
  mode: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 8, paddingHorizontal: SPACING.xs },
  modeActive: { backgroundColor: COLORS.primary },
  modeText: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm },
  modeTextActive: { color: COLORS.white },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginTop: SPACING.md },
  privacyText: { flex: 1, color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, lineHeight: 18 },
  titulo: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.xs,
  },
  subtitulo: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginBottom: SPACING.lg,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.normal,
  },
  aviso: {
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  avisoTexto: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.normal,
  },
  errorGeneral: {
    color: COLORS.dangerLight,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginBottom: SPACING.sm,
  },
  principal: { marginTop: SPACING.sm, alignSelf: 'stretch' },
  volver: { marginTop: SPACING.md, alignSelf: 'center' },
});

export default LoginScreen;

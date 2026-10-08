import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScaffold } from '../components/AuthScaffold';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
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

  const cambiarModo = useCallback((nuevo: Modo) => {
    setModo(nuevo);
    setErrores({});
    setAviso(null);
  }, []);

  const enviar = useCallback(async () => {
    const nuevos = {
      email: validarEmail(email) ?? undefined,
      password: validarPassword(password) ?? undefined,
    };
    // En "entrar" basta con que haya contraseña; el mínimo solo se exige al crearla.
    if (modo === 'entrar' && password) nuevos.password = undefined;
    setErrores(nuevos);
    setAviso(null);
    if (nuevos.email || nuevos.password) return;

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
  }, [modo, email, password, signIn, signUp]);

  return (
    <AuthScaffold>
      <GlassCard>
        <Text style={styles.titulo} accessibilityRole="header">
          {modo === 'entrar' ? 'Iniciar sesión' : 'Crear cuenta'}
        </Text>
        <Text style={styles.subtitulo}>
          {modo === 'entrar'
            ? 'Entra con tu correo y tu contraseña.'
            : `Usa un correo que puedas abrir. La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`}
        </Text>

        {aviso ? (
          <View style={styles.aviso} accessibilityRole="alert">
            <Text style={styles.avisoTexto}>{aviso}</Text>
          </View>
        ) : null}

        <GlassInput
          label="Correo"
          placeholder="nombre@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          error={errores.email}
          required
        />
        <GlassInput
          label="Contraseña"
          placeholder={modo === 'crear' ? `Mínimo ${PASSWORD_MIN} caracteres` : 'Tu contraseña'}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
          textContentType={modo === 'crear' ? 'newPassword' : 'password'}
          value={password}
          onChangeText={setPassword}
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
          label={modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          onPress={enviar}
          variant="secondary"
          size="lg"
          loading={isLoading}
          style={styles.principal}
        />
        <GlassButton
          label={modo === 'entrar' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
          onPress={() => cambiarModo(modo === 'entrar' ? 'crear' : 'entrar')}
          variant="ghost"
          size="md"
          style={styles.secundario}
        />
      </GlassCard>

      <GlassButton
        label="Volver al mapa"
        onPress={() => router.replace('/')}
        variant="ghost"
        size="sm"
        style={styles.volver}
      />
    </AuthScaffold>
  );
};

const styles = StyleSheet.create({
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
  secundario: { marginTop: SPACING.sm, alignSelf: 'stretch' },
  volver: { marginTop: SPACING.md, alignSelf: 'center' },
});

export default LoginScreen;

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthScaffold } from '../components/AuthScaffold';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { SegmentedControl } from '../components/SegmentedControl';
import { CheckboxRow } from '../components/CheckboxRow';
import { PressableScale } from '../components/PressableScale';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { CONSENTIMIENTO, CONSENT_VERSION, TEXTO_ACEPTACION } from '../constants/consentimiento';
import {
  normalizarNombre,
  normalizarPlaca,
  normalizarTelefono,
  validarNombre,
  validarPlaca,
  validarTelefono,
} from '../utils/validators';

type Rol = 'pasajero' | 'conductor';

interface Errores {
  nombre?: string;
  telefono?: string;
  placa?: string;
  consentimiento?: string;
  general?: string;
}

/**
 * "Completa tu perfil": nombre, teléfono, rol (y placa si es conductor) y consentimiento
 * LOPDP. Sin aceptar el consentimiento el servidor no crea el perfil (spec 002, criterio 1).
 */
export const CompleteProfileScreen: React.FC = () => {
  const { completeProfile, signOut, user } = useSupabaseAuth();

  const [rol, setRol] = useState<Rol>('pasajero');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [placa, setPlaca] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [verTexto, setVerTexto] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);

  const enviar = useCallback(async () => {
    const nuevos: Errores = {
      nombre: validarNombre(nombre) ?? undefined,
      telefono: validarTelefono(telefono) ?? undefined,
      placa: rol === 'conductor' ? validarPlaca(placa) ?? undefined : undefined,
      consentimiento: acepta ? undefined : 'Debes aceptar para crear tu cuenta.',
    };
    setErrores(nuevos);
    if (nuevos.nombre || nuevos.telefono || nuevos.placa || nuevos.consentimiento) return;

    setEnviando(true);
    const r = await completeProfile({
      rol,
      nombre: normalizarNombre(nombre),
      telefono: normalizarTelefono(telefono),
      ...(rol === 'conductor' ? { placa: normalizarPlaca(placa) } : {}),
      consentimiento: true,
    });
    setEnviando(false);
    if (!r.ok) setErrores({ general: r.error });
    // Si salió bien, el layout raíz detecta el perfil y lleva al usuario a su pantalla.
  }, [rol, nombre, telefono, placa, acepta, completeProfile]);

  return (
    <AuthScaffold showBrand={false}>
      <GlassCard>
        <Text style={styles.titulo} accessibilityRole="header">
          Completa tu perfil
        </Text>
        <Text style={styles.subtitulo}>
          {user?.email ? `Cuenta: ${user.email}. ` : ''}Faltan unos datos para empezar.
        </Text>

        <SegmentedControl<Rol>
          label="Quiero usar CruciDrive como"
          value={rol}
          onChange={setRol}
          opciones={[
            { value: 'pasajero', label: 'Pasajero' },
            { value: 'conductor', label: 'Conductor' },
          ]}
        />

        <GlassInput
          label="Nombre y apellido"
          placeholder="María Alcívar"
          autoCapitalize="words"
          autoComplete="name"
          value={nombre}
          onChangeText={setNombre}
          error={errores.nombre}
          required
        />
        <GlassInput
          label="Teléfono"
          placeholder="0991234567"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={telefono}
          onChangeText={setTelefono}
          error={errores.telefono}
          helperText="El conductor o el pasajero de tu viaje lo verá para coordinarse."
          required
        />
        {rol === 'conductor' && (
          <GlassInput
            label="Placa de tu tricimoto"
            placeholder="ABC-123"
            autoCapitalize="characters"
            autoCorrect={false}
            value={placa}
            onChangeText={setPlaca}
            error={errores.placa}
            helperText="Después te pediremos tu cédula y 3 fotos para aprobarte."
            required
          />
        )}

        <CheckboxRow
          label={TEXTO_ACEPTACION}
          checked={acepta}
          onChange={setAcepta}
          error={errores.consentimiento}
        />
        <PressableScale
          onPress={() => setVerTexto((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={verTexto ? 'Ocultar el aviso de privacidad' : 'Leer el aviso de privacidad'}
          style={styles.enlace}
        >
          <Text style={styles.enlaceTexto}>
            {verTexto ? 'Ocultar aviso de privacidad' : `Leer aviso de privacidad (versión ${CONSENT_VERSION})`}
          </Text>
        </PressableScale>

        {verTexto && (
          <View style={styles.texto}>
            {CONSENTIMIENTO.map((s) => (
              <View key={s.titulo} style={styles.seccion}>
                <Text style={styles.seccionTitulo}>{s.titulo}</Text>
                <Text style={styles.seccionTexto}>{s.texto}</Text>
              </View>
            ))}
            <Text style={styles.borrador}>
              Texto en revisión legal; puede cambiar y se te volverá a pedir tu consentimiento.
            </Text>
          </View>
        )}

        {errores.general ? (
          <Text style={styles.errorGeneral} accessibilityRole="alert">
            {errores.general}
          </Text>
        ) : null}

        <GlassButton
          label="Crear mi perfil"
          onPress={enviar}
          variant="secondary"
          size="lg"
          loading={enviando}
          style={styles.principal}
        />
        <GlassButton
          label="Cerrar sesión"
          onPress={signOut}
          variant="ghost"
          size="sm"
          style={styles.salir}
        />
      </GlassCard>
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
  enlace: { minHeight: 44, justifyContent: 'center', marginBottom: SPACING.sm },
  enlaceTexto: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    textDecorationLine: 'underline',
  },
  texto: {
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  seccion: { marginBottom: SPACING.md },
  seccionTitulo: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.xs,
  },
  seccionTexto: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    lineHeight: FONTS.sizes.xs * FONTS.lineHeights.relaxed,
  },
  borrador: {
    color: COLORS.secondaryLight,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
  },
  errorGeneral: {
    color: COLORS.dangerLight,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginBottom: SPACING.sm,
  },
  principal: { marginTop: SPACING.sm, alignSelf: 'stretch' },
  salir: { marginTop: SPACING.md, alignSelf: 'center' },
});

export default CompleteProfileScreen;

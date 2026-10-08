import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthScaffold } from '../components/AuthScaffold';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { PhotoSlot } from '../components/PhotoSlot';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { authFetch } from '../utils/authFetch';
import { subirFoto, type TipoFoto } from '../utils/subirFoto';
import { normalizarCedula, validarCedula } from '../utils/validators';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SPACING } from '../constants/theme';

type Fotos = Record<TipoFoto, string | null>;

const FOTOS: { tipo: TipoFoto; titulo: string; ayuda: string }[] = [
  { tipo: 'conductor', titulo: 'Tu foto', ayuda: 'Tu rostro, de frente y con buena luz' },
  { tipo: 'cedula', titulo: 'Tu cédula', ayuda: 'Por el lado de la foto, sin reflejos, que se lea todo' },
  { tipo: 'vehiculo', titulo: 'Tu tricimoto', ayuda: 'De frente, con la placa a la vista' },
];

/**
 * Verificación del conductor (spec 002): cédula y 3 fotos. Mientras no esté aprobado,
 * esta es la única pantalla que ve. Estados: sin enviar, pendiente (espera), rechazado
 * (ve el motivo y corrige) y aprobado (el layout raíz lo lleva a su consola).
 */
export const VerificationScreen: React.FC = () => {
  const { user, verification, verificationChecked, fetchVerification, signOut } = useSupabaseAuth();

  const [cedula, setCedula] = useState('');
  const [fotos, setFotos] = useState<Fotos>({ conductor: null, cedula: null, vehiculo: null });
  const [errores, setErrores] = useState<{ cedula?: string; fotos?: Partial<Record<TipoFoto, string>>; general?: string }>({});
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState(false);

  const estado = verification?.estado ?? 'sin_enviar';

  const actualizar = useCallback(async () => {
    setActualizando(true);
    await fetchVerification();
    setActualizando(false);
  }, [fetchVerification]);

  const enviar = useCallback(async () => {
    const faltan: Partial<Record<TipoFoto, string>> = {};
    FOTOS.forEach(({ tipo }) => {
      if (!fotos[tipo]) faltan[tipo] = 'Falta esta foto.';
    });
    const errCedula = validarCedula(cedula) ?? undefined;
    setErrores({ cedula: errCedula, fotos: faltan });
    if (errCedula || Object.keys(faltan).length > 0 || !user) return;

    setEnviando(true);
    try {
      for (const { tipo } of FOTOS) {
        await subirFoto(user.id, tipo, fotos[tipo] as string);
      }
      const respuesta = await authFetch(API_CONFIG.endpoints.driver.verification, {
        method: 'POST',
        body: JSON.stringify({ cedula: normalizarCedula(cedula) }),
      });
      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        setErrores({ general: cuerpo?.message ?? 'No se pudo enviar tu solicitud.' });
        return;
      }
      await fetchVerification();
    } catch (e) {
      setErrores({ general: e instanceof Error ? e.message : 'No se pudo enviar tu solicitud.' });
    } finally {
      setEnviando(false);
    }
  }, [cedula, fotos, user, fetchVerification]);

  // ─── Pendiente: solo esperar ──────────────────────────────
  if (verificationChecked && estado === 'pendiente') {
    return (
      <AuthScaffold showBrand={false}>
        <GlassCard>
          <Text style={styles.titulo} accessibilityRole="header">
            Estamos revisando tu solicitud
          </Text>
          <Text style={styles.texto}>
            Un administrador revisará tu cédula y tus fotos. Cuando te aprueben podrás ponerte disponible y recibir viajes.
          </Text>
          <GlassButton
            label="Actualizar estado"
            onPress={actualizar}
            variant="secondary"
            size="lg"
            loading={actualizando}
            style={styles.principal}
          />
          <GlassButton label="Cerrar sesión" onPress={signOut} variant="ghost" size="sm" style={styles.salir} />
        </GlassCard>
      </AuthScaffold>
    );
  }

  // ─── Sin enviar o rechazado: formulario ───────────────────
  return (
    <AuthScaffold showBrand={false}>
      <GlassCard>
        <Text style={styles.titulo} accessibilityRole="header">
          Verifica tu identidad
        </Text>
        <Text style={styles.texto}>
          Para recibir viajes necesitamos tu cédula y 3 fotos. Solo las ven los administradores. Cada foto se reduce antes de subirla para gastar pocos datos.
        </Text>

        {estado === 'rechazado' && (
          <View style={styles.rechazo} accessibilityRole="alert">
            <Text style={styles.rechazoTitulo}>Tu solicitud fue rechazada</Text>
            <Text style={styles.rechazoTexto}>{verification?.motivo_rechazo ?? 'Corrige tus datos y envíalos de nuevo.'}</Text>
          </View>
        )}

        <GlassInput
          label="Número de cédula"
          placeholder="1710034065"
          keyboardType="number-pad"
          maxLength={10}
          value={cedula}
          onChangeText={setCedula}
          error={errores.cedula}
          required
        />

        {FOTOS.map(({ tipo, titulo, ayuda }) => (
          <PhotoSlot
            key={tipo}
            titulo={titulo}
            ayuda={ayuda}
            uri={fotos[tipo]}
            onChange={(uri) => setFotos((f) => ({ ...f, [tipo]: uri }))}
            error={errores.fotos?.[tipo]}
            disabled={enviando}
          />
        ))}

        {errores.general ? (
          <Text style={styles.errorGeneral} accessibilityRole="alert">
            {errores.general}
          </Text>
        ) : null}

        <GlassButton
          label={estado === 'rechazado' ? 'Reenviar solicitud' : 'Enviar solicitud'}
          onPress={enviar}
          variant="secondary"
          size="lg"
          loading={enviando}
          style={styles.principal}
        />
        <GlassButton label="Cerrar sesión" onPress={signOut} variant="ghost" size="sm" style={styles.salir} />
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
  texto: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginBottom: SPACING.lg,
    lineHeight: FONTS.sizes.sm * FONTS.lineHeights.normal,
  },
  rechazo: {
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  rechazoTitulo: {
    color: COLORS.dangerLight,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    marginBottom: SPACING.xs,
  },
  rechazoTexto: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
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

export default VerificationScreen;

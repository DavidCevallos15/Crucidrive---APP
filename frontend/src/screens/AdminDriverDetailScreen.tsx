import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { authFetch } from '../utils/authFetch';
import { validarMotivo } from '../utils/validators';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';

interface DetalleConductor {
  conductor_id: string;
  cedula: string;
  estado: string;
  perfiles: { nombre: string; telefono: string } | null;
  fotos: { conductor: string | null; cedula: string | null; vehiculo: string | null };
}

type Accion = 'ninguna' | 'confirmar-aprobar' | 'rechazar';

const FOTOS: { clave: 'conductor' | 'cedula' | 'vehiculo'; titulo: string }[] = [
  { clave: 'conductor', titulo: 'Foto del conductor' },
  { clave: 'cedula', titulo: 'Cédula' },
  { clave: 'vehiculo', titulo: 'Tricimoto y placa' },
];

/**
 * Detalle de una solicitud: datos, 3 fotos (enlaces firmados que caducan a los 5 min) y
 * las acciones. Aprobar pide una confirmación; rechazar exige un motivo, que verá el conductor.
 */
export const AdminDriverDetailScreen: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [detalle, setDetalle] = useState<DetalleConductor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion>('ninguna');
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const r = await authFetch(API_CONFIG.endpoints.admin.driver(String(id)));
        const cuerpo = await r.json().catch(() => null);
        if (!activo) return;
        if (!r.ok) {
          setError(cuerpo?.message ?? 'No se pudo cargar la solicitud.');
          return;
        }
        setDetalle(cuerpo.data as DetalleConductor);
      } catch {
        if (activo) setError('Sin conexión con el servidor.');
      }
    })();
    return () => { activo = false; };
  }, [id]);

  const revisar = useCallback(async (tipo: 'aprobar' | 'rechazar') => {
    if (tipo === 'rechazar') {
      const err = validarMotivo(motivo) ?? undefined;
      setErrorMotivo(err);
      if (err) return;
    }
    setEnviando(true);
    setError(null);
    try {
      const endpoint = tipo === 'aprobar'
        ? API_CONFIG.endpoints.admin.approve(String(id))
        : API_CONFIG.endpoints.admin.reject(String(id));
      const r = await authFetch(endpoint, {
        method: 'POST',
        body: tipo === 'rechazar' ? JSON.stringify({ motivo: motivo.trim() }) : undefined,
      });
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => null);
        setError(cuerpo?.message ?? 'No se pudo registrar la revisión.');
        return;
      }
      router.back();
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setEnviando(false);
    }
  }, [id, motivo, router]);

  if (!detalle && !error) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contenido, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      <GlassButton label="Volver" onPress={() => router.back()} variant="ghost" size="sm" style={styles.volver} />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {detalle && (
        <>
          <Text style={styles.titulo} accessibilityRole="header">
            {detalle.perfiles?.nombre ?? 'Conductor'}
          </Text>
          <Text style={styles.dato}>Teléfono: {detalle.perfiles?.telefono ?? 'sin teléfono'}</Text>
          <Text style={styles.dato}>Cédula: {detalle.cedula}</Text>

          {FOTOS.map(({ clave, titulo }) => (
            <View key={clave} style={styles.fotoBloque}>
              <Text style={styles.fotoTitulo}>{titulo}</Text>
              {detalle.fotos[clave] ? (
                <Image
                  source={{ uri: detalle.fotos[clave] as string }}
                  style={styles.foto}
                  accessibilityLabel={titulo}
                />
              ) : (
                <View style={[styles.foto, styles.sinFoto]}>
                  <Text style={styles.sinFotoTexto}>La foto no está disponible</Text>
                </View>
              )}
            </View>
          ))}

          {accion === 'rechazar' && (
            <GlassInput
              label="Motivo del rechazo"
              placeholder="Ej.: la foto de la cédula no se lee"
              multiline
              value={motivo}
              onChangeText={setMotivo}
              error={errorMotivo}
              helperText="El conductor verá este mensaje y podrá corregir sus datos."
              maxLength={300}
              required
            />
          )}

          {accion === 'confirmar-aprobar' && (
            <Text style={styles.confirmar} accessibilityRole="alert">
              ¿Confirmas que la cédula y las fotos corresponden a {detalle.perfiles?.nombre ?? 'este conductor'}? Podrá recibir viajes.
            </Text>
          )}

          {accion === 'ninguna' ? (
            <View style={styles.acciones}>
              <GlassButton
                label="Aprobar"
                onPress={() => setAccion('confirmar-aprobar')}
                variant="primary"
                size="lg"
                style={styles.accion}
              />
              <GlassButton
                label="Rechazar"
                onPress={() => setAccion('rechazar')}
                variant="danger"
                size="lg"
                style={styles.accion}
              />
            </View>
          ) : (
            <View style={styles.acciones}>
              <GlassButton
                label={accion === 'rechazar' ? 'Confirmar rechazo' : 'Sí, aprobar'}
                onPress={() => revisar(accion === 'rechazar' ? 'rechazar' : 'aprobar')}
                variant={accion === 'rechazar' ? 'danger' : 'primary'}
                size="lg"
                loading={enviando}
                style={styles.accion}
              />
              <GlassButton
                label="Cancelar"
                onPress={() => { setAccion('ninguna'); setErrorMotivo(undefined); }}
                variant="ghost"
                size="lg"
                disabled={enviando}
                style={styles.accion}
              />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.darkBg },
  contenido: { paddingHorizontal: SPACING.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  volver: { alignSelf: 'flex-start', marginBottom: SPACING.md },
  titulo: {
    fontSize: FONTS.sizes.title,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.sm,
  },
  dato: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.xs,
    fontVariant: ['tabular-nums'],
  },
  fotoBloque: { marginTop: SPACING.md },
  fotoTitulo: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    color: COLORS.glassTextMutedDark,
    marginBottom: SPACING.xs,
  },
  foto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: SHAPES.borderRadiusMd,
    backgroundColor: COLORS.glassSurface,
    resizeMode: 'contain',
  },
  sinFoto: { alignItems: 'center', justifyContent: 'center' },
  sinFotoTexto: { color: COLORS.glassTextMutedDark, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body },
  confirmar: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    marginTop: SPACING.lg,
    lineHeight: FONTS.sizes.base * FONTS.lineHeights.normal,
  },
  acciones: { marginTop: SPACING.lg, gap: SPACING.sm },
  accion: { alignSelf: 'stretch' },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.md },
});

export default AdminDriverDetailScreen;

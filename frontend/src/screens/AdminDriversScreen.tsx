import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from '../components/GlassButton';
import { PressableScale } from '../components/PressableScale';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';

export interface SolicitudConductor {
  conductor_id: string;
  cedula: string;
  estado: string;
  creado_en: string;
  placa: string | null;
  perfiles: { nombre: string; telefono: string } | null;
}

const formatearFecha = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Panel del administrador: solicitudes de conductores pendientes de revisión,
 * las más antiguas primero. Toca una para ver sus fotos y aprobarla o rechazarla.
 */
export const AdminDriversScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useSupabaseAuth();

  const [solicitudes, setSolicitudes] = useState<SolicitudConductor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await authFetch(`${API_CONFIG.endpoints.admin.drivers}?estado=pendiente`);
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => null);
        setError(cuerpo?.message ?? 'No se pudo cargar la lista.');
        return;
      }
      setSolicitudes((await r.json()).data as SolicitudConductor[]);
    } catch {
      setError('Sin conexión con el servidor. Desliza hacia abajo para reintentar.');
    }
  }, []);

  // Recarga al volver desde el detalle (así desaparece la solicitud ya revisada).
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = useCallback(async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }, [cargar]);

  return (
    <View style={styles.container}>
      <View style={[styles.cabecera, { paddingTop: insets.top + SPACING.md }]}>
        <View style={styles.cabeceraTexto}>
          <Text style={styles.titulo} accessibilityRole="header">
            Conductores por revisar
          </Text>
          <Text style={styles.subtitulo}>{profile ? `Administrador: ${profile.nombre}` : 'Administrador'}</Text>
        </View>
        <GlassButton label="Salir" onPress={signOut} variant="ghost" size="sm" />
      </View>

      {solicitudes === null && !error ? (
        <View style={styles.centro}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={solicitudes ?? []}
          keyExtractor={(s) => s.conductor_id}
          contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + SPACING.lg }]}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={COLORS.primaryLight} />
          }
          ListHeaderComponent={
            error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            error ? null : (
              <View style={styles.vacio}>
                <Ionicons name="checkmark-done-circle" size={40} color={COLORS.success} />
                <Text style={styles.vacioTitulo}>No hay solicitudes pendientes</Text>
                <Text style={styles.vacioTexto}>Cuando un conductor envíe su cédula y sus fotos, aparecerá aquí.</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <PressableScale
              onPress={() => router.push(`/(app)/(admin)/${item.conductor_id}` as never)}
              accessibilityRole="button"
              accessibilityLabel={`Revisar a ${item.perfiles?.nombre ?? 'conductor'}`}
              pressedScale={0.98}
              style={styles.tarjeta}
            >
              <View style={styles.tarjetaTexto}>
                <Text style={styles.nombre}>{item.perfiles?.nombre ?? 'Sin nombre'}</Text>
                <Text style={styles.detalle}>
                  Placa {item.placa ?? 'sin registrar'}  ·  {item.perfiles?.telefono ?? 'sin teléfono'}
                </Text>
                <Text style={styles.fecha}>Enviada {formatearFecha(item.creado_en)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.glassTextMutedDark} />
            </PressableScale>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.glassBorderDark,
  },
  cabeceraTexto: { flex: 1, marginRight: SPACING.md },
  titulo: {
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  subtitulo: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginTop: 2 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lista: { padding: SPACING.md, flexGrow: 1 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: SHAPES.borderRadiusMd,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: COLORS.glassSurface,
  },
  tarjetaTexto: { flex: 1 },
  nombre: { fontSize: FONTS.sizes.base, fontFamily: FONTS.heading, fontWeight: FONTS.weights.semibold, color: COLORS.glassTextDark },
  detalle: { fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, color: COLORS.glassTextDark, marginTop: 2 },
  fecha: { fontSize: FONTS.sizes.xs, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, marginTop: 2 },
  vacio: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.lg },
  vacioTitulo: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
    marginTop: SPACING.md,
  },
  vacioTexto: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  error: { color: COLORS.dangerLight, fontSize: FONTS.sizes.sm, fontFamily: FONTS.body, marginBottom: SPACING.md },
});

export default AdminDriversScreen;

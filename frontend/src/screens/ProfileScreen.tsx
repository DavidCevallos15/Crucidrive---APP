import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PANEL_IN } from '../constants/motion';
import { BrandLockup } from '../components/BrandLockup';
import { AppMenuButton } from '../components/AppMenuButton';
import { GlassCard } from '../components/GlassCard';
import { GlassButton } from '../components/GlassButton';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { useResenasConductor } from '../hooks/useResenasConductor';
import { ResenasDelConductor } from '../components/ResenasDelConductor';
import { textoResenas } from '../utils/viajeConductor';
import { COLORS, FONTS, SPACING } from '../constants/theme';

/**
 * Pantalla de Perfil unificada.
 *
 * Se adapta automáticamente al rol del usuario (pasajero o conductor),
 * mostrando el avatar, estadísticas y secciones relevantes para cada rol.
 */
export default function ProfileScreen() {
  const { profile, signOut, authError, isLoading } = useSupabaseAuth();
  const insets = useSafeAreaInsets();

  const isDriver = profile?.rol === 'conductor';
  // Estrellas, reseñas y comentarios del conductor (paso 005, criterio 17).
  const resenas = useResenasConductor(isDriver);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}><AppMenuButton /><BrandLockup compact /></View>
        {/* Avatar y nombre */}
        <Animated.View
          entering={PANEL_IN}
          style={styles.header}
        >
          <View
            style={[
              styles.avatar,
              { borderColor: isDriver ? COLORS.success : COLORS.primary },
            ]}
          >
            <Ionicons
              name={isDriver ? 'car' : 'person'}
              size={40}
              color={isDriver ? COLORS.success : COLORS.glassTextDark}
            />
          </View>
          <Text style={styles.name}>
            {profile?.nombre ?? (isDriver ? 'Conductor' : 'Usuario')}
          </Text>
          <Text
            style={[
              styles.role,
              { color: isDriver ? COLORS.successLight : COLORS.primaryLight },
            ]}
          >
            {isDriver ? 'Conductor' : 'Pasajero'}
          </Text>
          <Text style={styles.phone}>{profile?.telefono ?? ''}</Text>
        </Animated.View>

        {/* Información / Estadísticas */}
        <View>
          <GlassCard style={styles.infoCard}>
            {isDriver && (
              <>
                <Text style={styles.statsTitle}>Estadísticas</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit>
                      {resenas.resumen ? textoResenas(resenas.resumen.promedio, resenas.resumen.total) : '--'}
                    </Text>
                    <Text style={styles.statLabel}>Calificación</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>Tricimoto</Text>
                    <Text style={styles.statLabel}>Tu transporte</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.success} />
                  <Text style={styles.infoLabel}>Estado de operación</Text>
                  <Text
                    style={[
                      styles.infoValue,
                      {
                        color:
                          profile?.estado_operativo === 'disponible'
                            ? COLORS.success
                            : COLORS.glassTextMutedDark,
                      },
                    ]}
                  >
                    {profile?.estado_operativo === 'disponible'
                      ? 'Disponible'
                      : 'No disponible'}
                  </Text>
                </View>
              </>
            )}

            {!isDriver && (
              <>
                <View style={styles.infoRow}>
                  <Ionicons name="star" size={20} color={COLORS.primary} />
                  <Text style={styles.infoLabel}>Calificación</Text>
                  <Text style={styles.infoValue}>
                    {profile?.calificacion?.toFixed(1) ?? 'Sin datos'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="person-circle-outline" size={20} color={COLORS.primaryLight} />
                  <Text style={styles.infoLabel}>Cuenta</Text>
                  <Text style={[styles.infoValue, { color: COLORS.primaryLight }]}>
                    {profile?.activo === false ? 'Inactiva' : 'Registrada'}
                  </Text>
                </View>
              </>
            )}
          </GlassCard>
        </View>

        {isDriver && (
          <ResenasDelConductor
            resumen={resenas.resumen}
            error={resenas.error}
            cargando={resenas.cargando}
            onReintentar={() => void resenas.recargar()}
          />
        )}

        {/* Cerrar sesión */}
        <View>
          <GlassButton
            label="Cerrar sesión"
            onPress={signOut}
            loading={isLoading}
            variant="danger"
            size="lg"
            leftIcon={<Ionicons name="log-out-outline" size={20} color={COLORS.white} />}
            style={styles.logoutButton}
          />
          {authError && <Text style={styles.authError} accessibilityRole="alert">{authError}</Text>}
        </View>

        {/* Footer */}
        <Text style={styles.version}>CruciDrive v1.0.0</Text>
        <Text style={styles.location}>Crucita, Manabí, Ecuador</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBg,
  },
  content: {
    paddingTop: 80,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  brand: { marginBottom: SPACING.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authError: { color: COLORS.dangerLight, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, lineHeight: 22, marginTop: SPACING.md },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.glassBgDark,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  name: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  role: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    marginTop: 4,
  },
  phone: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginTop: 4,
  },
  infoCard: {
    marginBottom: SPACING.xl,
  },
  statsTitle: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.glassBorderDark,
  },
  statNumber: {
    fontSize: FONTS.sizes.xxl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORS.glassTextDark,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.glassBorderDark,
  },
  infoLabel: {
    flex: 1,
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    marginLeft: SPACING.sm,
  },
  infoValue: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.glassTextDark,
  },
  logoutButton: {
    alignSelf: 'stretch',
  },
  version: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  location: {
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

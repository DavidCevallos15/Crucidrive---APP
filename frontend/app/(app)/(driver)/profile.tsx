import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../../src/components/GlassCard';
import { GlassButton } from '../../../src/components/GlassButton';
import { useSupabaseAuth } from '../../../src/hooks/useSupabaseAuth';
import { COLORS, FONTS, SPACING } from '../../../src/constants/theme';

/**
 * Pantalla de Perfil del Conductor.
 *
 * Muestra información del perfil, estadísticas de operación
 * y opción de cerrar sesión.
 */
export default function DriverProfileScreen() {
  const { profile, signOut } = useSupabaseAuth();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar y nombre */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={styles.header}
        >
          <View style={styles.avatar}>
            <Ionicons name="car" size={40} color={COLORS.success} />
          </View>
          <Text style={styles.name}>{profile?.nombre ?? 'Conductor'}</Text>
          <Text style={styles.role}>Conductor</Text>
          <Text style={styles.phone}>{profile?.telefono ?? ''}</Text>
        </Animated.View>

        {/* Estadísticas del conductor */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <GlassCard style={styles.statsCard}>
            <Text style={styles.statsTitle}>Estadísticas</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>
                  {profile?.calificacion?.toFixed(1) ?? '5.0'}
                </Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Viajes hoy</Text>
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
          </GlassCard>
        </Animated.View>

        {/* Cerrar sesión */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <GlassButton
            label="Cerrar sesión"
            onPress={signOut}
            variant="danger"
            size="lg"
            leftIcon={<Ionicons name="log-out-outline" size={20} color={COLORS.white} />}
            style={styles.logoutButton}
          />
        </Animated.View>

        <Text style={styles.version}>CruciDrive v1.0.0</Text>
        <Text style={styles.location}>Crucita, Manabí — Ecuador</Text>
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
  },
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
    borderColor: COLORS.success,
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
    color: COLORS.success,
    fontWeight: FONTS.weights.medium,
    marginTop: 4,
  },
  phone: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextMutedDark,
    marginTop: 4,
  },
  statsCard: {
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
  },
  infoLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORS.glassTextDark,
    marginLeft: SPACING.sm,
  },
  infoValue: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.semibold,
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

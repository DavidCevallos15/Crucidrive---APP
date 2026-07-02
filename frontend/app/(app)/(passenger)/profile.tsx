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
 * Pantalla de Perfil del usuario.
 *
 * Muestra información del perfil, estadísticas básicas
 * y opción de cerrar sesión.
 */
export default function ProfileScreen() {
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
            <Ionicons name="person" size={40} color={COLORS.glassTextDark} />
          </View>
          <Text style={styles.name}>{profile?.nombre ?? 'Usuario'}</Text>
          <Text style={styles.role}>
            {profile?.rol === 'conductor' ? 'Conductor' : 'Pasajero'}
          </Text>
          <Text style={styles.phone}>{profile?.telefono ?? ''}</Text>
        </Animated.View>

        {/* Información */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <GlassCard style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="star" size={20} color={COLORS.secondary} />
              <Text style={styles.infoLabel}>Calificación</Text>
              <Text style={styles.infoValue}>
                {profile?.calificacion?.toFixed(1) ?? '5.0'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
              <Text style={styles.infoLabel}>Estado</Text>
              <Text style={[styles.infoValue, { color: COLORS.success }]}>
                Verificado
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

        {/* Footer */}
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
    borderColor: COLORS.primary,
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
    color: COLORS.primary,
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

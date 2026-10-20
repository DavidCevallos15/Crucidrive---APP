import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { textoFecha, textoResenas, type ResenasConductor } from '../utils/viajeConductor';

interface Props {
  resumen: ResenasConductor | null;
  error: string | null;
  cargando: boolean;
  onReintentar: () => void;
}

const Estrellas: React.FC<{ n: number }> = ({ n }) => (
  <View style={styles.estrellas} accessibilityLabel={`${n} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={16} color={COLORS.secondary} />
    ))}
  </View>
);

/**
 * Reseñas del conductor en su perfil (paso 005, criterio 17): promedio, número y comentarios,
 * del más reciente al más antiguo, solo con la fecha. Nunca hay nombre ni teléfono de quien
 * calificó: la BD ni siquiera los entrega (LOPDP).
 */
export const ResenasDelConductor: React.FC<Props> = ({ resumen, error, cargando, onReintentar }) => (
  <GlassCard style={styles.tarjeta}>
    <Text style={styles.titulo} accessibilityRole="header">Tus reseñas</Text>
    {resumen && <Text style={styles.resumen}>{textoResenas(resumen.promedio, resumen.total)}</Text>}
    {cargando && !resumen && <ActivityIndicator color={COLORS.primaryLight} style={styles.cargando} />}
    {error && !resumen && (
      <>
        <Text style={styles.error} accessibilityRole="alert">{error}</Text>
        <GlassButton label="Reintentar" onPress={onReintentar} variant="ghost" size="md" />
      </>
    )}
    {resumen && resumen.resenas.length === 0 && (
      <Text style={styles.vacio}>Aún no tienes reseñas. Aparecen cuando un pasajero califica un viaje terminado.</Text>
    )}
    {resumen?.resenas.map((r, i) => (
      <View key={`${r.fecha}-${i}`} style={styles.resena}>
        <View style={styles.cabecera}>
          <Estrellas n={r.estrellas} />
          <Text style={styles.fecha}>{textoFecha(r.fecha)}</Text>
        </View>
        {r.comentario && <Text style={styles.comentario}>{r.comentario}</Text>}
      </View>
    ))}
  </GlassCard>
);

const styles = StyleSheet.create({
  tarjeta: { marginBottom: SPACING.xl },
  titulo: { fontSize: FONTS.sizes.lg, fontFamily: FONTS.heading, fontWeight: FONTS.weights.semibold, color: COLORS.glassTextDark },
  resumen: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.secondary, marginTop: SPACING.xs, marginBottom: SPACING.sm },
  cargando: { marginVertical: SPACING.md },
  error: { color: COLORS.dangerLight, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, marginVertical: SPACING.sm },
  vacio: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, lineHeight: 20 },
  resena: { paddingVertical: SPACING.sm, borderTopWidth: 0.5, borderTopColor: COLORS.glassBorderDark },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estrellas: { flexDirection: 'row', gap: 2 },
  fecha: { color: COLORS.glassTextMutedDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.xs },
  comentario: { color: COLORS.glassTextDark, fontFamily: FONTS.body, fontSize: FONTS.sizes.base, lineHeight: 22, marginTop: SPACING.xs },
});

export default ResenasDelConductor;

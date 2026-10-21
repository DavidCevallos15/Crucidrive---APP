import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GlassButton } from './GlassButton';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface Props {
  /** Mensaje si el cierre falló; null mientras se está cerrando. */
  error: string | null;
  onReintentar: () => void;
  onVolver: () => void;
}

/**
 * Pantalla del cierre de sesión (campo, 21 oct 2026). Sin mapa ni animaciones a propósito:
 * reemplaza a las pantallas privadas mientras se cierra la sesión, para que el mapa y el menú
 * se desmonten antes y por separado. Si el cierre falla, deja reintentar o volver a la app.
 */
export const PantallaSalida: React.FC<Props> = ({ error, onReintentar, onVolver }) => (
  <View style={styles.contenedor}>
    <StatusBar style="dark" />
    {error ? (
      <>
        <Text style={styles.titulo} accessibilityRole="header">No se pudo cerrar tu sesión</Text>
        <Text style={styles.texto} accessibilityRole="alert">{error}</Text>
        <GlassButton label="Reintentar" onPress={onReintentar} size="lg" style={styles.boton} />
        <GlassButton label="Volver a la app" onPress={onVolver} variant="ghost" size="md" style={styles.boton} />
      </>
    ) : (
      <>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.titulo} accessibilityLiveRegion="polite">Cerrando sesión…</Text>
        <Text style={styles.texto}>Puede tardar unos segundos si la señal es débil.</Text>
      </>
    )}
  </View>
);

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: COLORS.darkBg, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
  titulo: { fontSize: FONTS.sizes.xl, fontFamily: FONTS.heading, fontWeight: FONTS.weights.bold, color: COLORS.glassTextDark, textAlign: 'center' },
  texto: { fontSize: FONTS.sizes.base, fontFamily: FONTS.body, color: COLORS.glassTextMutedDark, textAlign: 'center' },
  boton: { alignSelf: 'stretch' },
});

export default PantallaSalida;

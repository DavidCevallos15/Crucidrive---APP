import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from './GlassButton';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import {
  TEXTO_INSTALAR,
  guardarGuiaCerrada,
  leerEntorno,
  leerGuiaCerrada,
  pasosInstalar,
  tocaGuiaInstalacion,
} from '../utils/instalarIphone';

/**
 * Aviso de la primera vez en el iPhone (spec 018, criterio 1; W4): cómo agregar CruciDrive a la
 * pantalla de inicio. No sale fuera de la web, si ya está instalada o si la persona lo cerró.
 */
export const AvisoInstalarIphone: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [pasos, setPasos] = useState<string[] | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const entorno = leerEntorno();
    if (tocaGuiaInstalacion(entorno, leerGuiaCerrada())) setPasos(pasosInstalar(entorno));
  }, []);

  if (!pasos) return null;
  const cerrar = () => {
    guardarGuiaCerrada();
    setPasos(null);
  };

  return (
    <View style={[styles.caja, { bottom: insets.bottom + SPACING.md }]} accessibilityRole="summary">
      <Text style={styles.titulo} accessibilityRole="header">{TEXTO_INSTALAR.titulo}</Text>
      {pasos.map((paso, i) => (
        <Text key={paso} style={styles.paso}>{`${i + 1}. ${paso}`}</Text>
      ))}
      <GlassButton label={TEXTO_INSTALAR.cerrar} onPress={cerrar} size="md" variant="primary" />
    </View>
  );
};

const styles = StyleSheet.create({
  caja: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 50,
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  titulo: { fontFamily: FONTS.heading, fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.glassTextDark },
  paso: { fontFamily: FONTS.body, fontSize: FONTS.sizes.base, lineHeight: 22, color: COLORS.glassTextDark },
});

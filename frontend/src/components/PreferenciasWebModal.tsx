import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassButton } from './GlassButton';
import { PressableScale } from './PressableScale';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { LEGAL_URLS } from '../constants/legal';
import { openLegalUrl } from '../servicios/abrirEnlaceLegal';
import {
  readWebPreferences,
  saveWebPreferences,
  shouldShowWebPreferencesBanner,
  subscribeOpenWebPreferencesModal,
} from '../utils/preferenciasWeb';

/**
 * Panel de preferencias de cookies y almacenamiento para la versión web (spec 019, criterios 9 a 11).
 * Ofrece tres opciones claras: aceptar mapa interactivo, solo almacenamiento esencial o personalizar.
 * No se renderiza en Android ni iOS nativo.
 */
export const PreferenciasWebModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [externalMap, setExternalMap] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const saved = readWebPreferences();
    if (saved) setExternalMap(saved.externalMap);
    if (shouldShowWebPreferencesBanner(saved)) setVisible(true);

    return subscribeOpenWebPreferencesModal(() => {
      const current = readWebPreferences();
      setExternalMap(current ? current.externalMap : true);
      setCustomizing(true);
      setVisible(true);
    });
  }, []);

  if (Platform.OS !== 'web' || !visible) return null;

  const choose = (allowExternalMap: boolean) => {
    saveWebPreferences(allowExternalMap);
    setExternalMap(allowExternalMap);
    setCustomizing(false);
    setVisible(false);
  };

  return (
    <View style={[styles.card, { bottom: insets.bottom + SPACING.md }]} accessibilityRole="summary">
      <Text style={styles.title} accessibilityRole="header">
        Privacidad y almacenamiento en la web
      </Text>
      <Text style={styles.body}>
        No usamos cookies publicitarias ni analítica de terceros. Solo guardamos tu sesión y, si lo autorizas,
        cargamos Google Maps; si prefieres solo lo esencial, usamos OpenStreetMap.
      </Text>

      {customizing && (
        <View style={styles.optionsBox}>
          <View style={styles.optionRow}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Almacenamiento esencial</Text>
              <Text style={styles.optionDetail}>Mantiene tu sesión y preferencia guardada (siempre activo).</Text>
            </View>
            <Switch value disabled accessibilityLabel="Almacenamiento esencial siempre activo" />
          </View>
          <View style={styles.optionRow}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Mapa interactivo (Google Maps)</Text>
              <Text style={styles.optionDetail}>Desactívalo para usar solo el respaldo de OpenStreetMap.</Text>
            </View>
            <Switch
              value={externalMap}
              onValueChange={setExternalMap}
              accessibilityLabel="Autorizar mapa interactivo de Google Maps"
            />
          </View>
        </View>
      )}

      <PressableScale
        onPress={() => {
          void openLegalUrl(LEGAL_URLS.privacy);
        }}
        accessibilityRole="link"
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>Leer Política de Privacidad</Text>
      </PressableScale>

      {customizing ? (
        <View style={styles.actions}>
          <GlassButton label="Solo esenciales" onPress={() => choose(false)} size="sm" variant="ghost" style={styles.btn} />
          <GlassButton label="Guardar preferencias" onPress={() => choose(externalMap)} size="sm" variant="primary" style={styles.btn} />
        </View>
      ) : (
        <View style={styles.actions}>
          <GlassButton label="Solo esenciales" onPress={() => choose(false)} size="sm" variant="ghost" style={styles.btn} />
          <GlassButton label="Personalizar" onPress={() => setCustomizing(true)} size="sm" variant="secondary" style={styles.btn} />
          <GlassButton label="Aceptar mapa" onPress={() => choose(true)} size="sm" variant="primary" style={styles.btn} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    maxWidth: 560,
    alignSelf: 'center',
    zIndex: 60,
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontFamily: FONTS.heading, fontSize: FONTS.sizes.lg, fontWeight: '700', color: COLORS.glassTextDark },
  body: { fontFamily: FONTS.body, fontSize: FONTS.sizes.sm, lineHeight: 20, color: COLORS.glassTextMutedDark },
  optionsBox: { gap: SPACING.sm, paddingVertical: SPACING.xs, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.glassBorderDark },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  optionText: { flex: 1 },
  optionTitle: { fontFamily: FONTS.heading, fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.glassTextDark },
  optionDetail: { fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, color: COLORS.glassTextMutedDark },
  linkButton: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' },
  linkText: { fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, color: COLORS.primaryLight, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  btn: { flexGrow: 1 },
});

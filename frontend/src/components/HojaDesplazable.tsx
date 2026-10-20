import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { hayMasAbajo } from '../utils/compacto';

interface Props extends Pick<ScrollViewProps, 'keyboardShouldPersistTaps' | 'nestedScrollEnabled'> {
  maxHeight: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Hoja del mapa que se desplaza y avisa cuando queda contenido abajo (spec 010, criterios 2
 * y 3): en Android la barra de desplazamiento solo aparece al mover, y en la prueba del
 * 20 oct 2026 el buscador y los sectores pasaron desapercibidos.
 */
export const HojaDesplazable: React.FC<Props> = ({ maxHeight, contentContainerStyle, children, ...scroll }) => {
  const [visible, setVisible] = useState(0);
  const [contenido, setContenido] = useState(0);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const mas = hayMasAbajo(visible, contenido, desplazamiento);

  return (
    <View>
      <ScrollView
        style={{ maxHeight }}
        contentContainerStyle={contentContainerStyle}
        onLayout={(e) => setVisible(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, alto) => setContenido(alto)}
        onScroll={(e) => setDesplazamiento(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
        {...scroll}
      >
        {children}
      </ScrollView>
      {mas && (
        <View pointerEvents="none" style={styles.aviso}>
          <LinearGradient colors={['rgba(6, 28, 35, 0)', COLORS.glassSurface]} style={StyleSheet.absoluteFill} />
          <View style={styles.pastilla}>
            <Ionicons name="chevron-down" size={16} color={COLORS.primaryLight} />
            <Text style={styles.texto}>Desliza para ver más</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  aviso: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: SPACING.xs },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 12, backgroundColor: COLORS.darkBg },
  texto: { fontFamily: FONTS.body, fontSize: FONTS.sizes.xs, color: COLORS.primaryLight },
});

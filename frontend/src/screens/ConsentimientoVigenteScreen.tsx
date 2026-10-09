import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckboxRow } from '../components/CheckboxRow';
import { PressableScale } from '../components/PressableScale';
import { CONSENTIMIENTO, CONSENT_VERSION, TEXTO_ACEPTACION } from '../constants/consentimiento';
import { COLORES_OFERTA } from '../utils/oferta';
import { FONTS, SHAPES, SPACING } from '../constants/theme';

interface Props {
  visible: boolean;
  enviando: boolean;
  error: string | null;
  onAceptar: () => void;
  onAhoraNo: () => void;
}

/**
 * Nueva aceptación del aviso de privacidad antes de ponerse disponible (paso 004, criterio 5,
 * P18): la versión 0.2 agrega la ubicación en segundo plano y los avisos al teléfono. Opaca,
 * sin blur y con botones grandes (regla 6).
 */
export const ConsentimientoVigenteScreen: React.FC<Props> = ({ visible, enviando, error, onAceptar, onAhoraNo }) => {
  const [acepta, setAcepta] = useState(false);
  useEffect(() => {
    if (visible) setAcepta(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onAhoraNo}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.titulo} accessibilityRole="header">Actualizamos el aviso de privacidad</Text>
          <Text style={styles.subtitulo}>
            Versión {CONSENT_VERSION}. Para ponerte disponible, léelo y acéptalo. Cambia lo que hacemos con tu
            ubicación mientras estás disponible y con los avisos al teléfono.
          </Text>
          <ScrollView style={styles.texto} contentContainerStyle={styles.textoContenido}>
            {CONSENTIMIENTO.map((s) => (
              <View key={s.titulo} style={styles.seccion}>
                <Text style={styles.seccionTitulo}>{s.titulo}</Text>
                <Text style={styles.seccionTexto}>{s.texto}</Text>
              </View>
            ))}
          </ScrollView>
          <CheckboxRow label={TEXTO_ACEPTACION} checked={acepta} onChange={setAcepta} />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.botones}>
            <PressableScale onPress={onAhoraNo} accessibilityRole="button" style={[styles.boton, styles.botonSecundario]}>
              <Text style={[styles.textoBoton, { color: COLORES_OFERTA.texto }]}>Ahora no</Text>
            </PressableScale>
            <PressableScale
              onPress={onAceptar}
              disabled={!acepta || enviando}
              accessibilityRole="button"
              accessibilityLabel="Aceptar y ponerme disponible"
              accessibilityState={{ disabled: !acepta || enviando, busy: enviando }}
              style={[styles.boton, { backgroundColor: COLORES_OFERTA.aceptarFondo }, (!acepta || enviando) && styles.deshabilitado]}
            >
              {enviando ? (
                <ActivityIndicator color={COLORES_OFERTA.aceptarTexto} />
              ) : (
                <Text style={[styles.textoBoton, { color: COLORES_OFERTA.aceptarTexto }]}>Aceptar</Text>
              )}
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    padding: SPACING.lg,
    borderRadius: SHAPES.borderRadiusLg,
    backgroundColor: COLORES_OFERTA.fondo,
  },
  titulo: {
    fontSize: FONTS.sizes.xl,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
    color: COLORES_OFERTA.texto,
  },
  subtitulo: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.body,
    color: COLORES_OFERTA.textoSuave,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  texto: {
    flexGrow: 0,
    marginBottom: SPACING.sm,
  },
  textoContenido: {
    gap: SPACING.sm,
  },
  seccion: {
    gap: 2,
  },
  seccionTitulo: {
    fontSize: FONTS.sizes.base,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
    color: COLORES_OFERTA.texto,
  },
  seccionTexto: {
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    color: COLORES_OFERTA.textoSuave,
  },
  error: {
    color: COLORES_OFERTA.cuenta,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    marginTop: SPACING.xs,
  },
  botones: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  boton: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SHAPES.borderRadiusFull,
  },
  botonSecundario: {
    borderWidth: 2,
    borderColor: COLORES_OFERTA.textoSuave,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  textoBoton: {
    fontSize: FONTS.sizes.lg,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.bold,
  },
});

export default ConsentimientoVigenteScreen;

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SHAPES, SPACING } from '../constants/theme';
import { reducirFoto } from '../utils/imagen';
import { PressableScale } from './PressableScale';

interface PhotoSlotProps {
  titulo: string;
  ayuda: string;
  /** URI local de la foto ya reducida, o null si falta */
  uri: string | null;
  onChange: (uri: string) => void;
  /** Error de validación (p. ej. "Falta esta foto") */
  error?: string;
  disabled?: boolean;
}

/**
 * Casilla de una foto de verificación. Se puede tomar con la cámara (solo en el teléfono)
 * o elegir de la galería. La foto se reduce a ~300 KB antes de guardarse en el estado,
 * para respetar el presupuesto de datos móviles.
 */
export const PhotoSlot: React.FC<PhotoSlotProps> = ({ titulo, ayuda, uri, onChange, error, disabled }) => {
  const [procesando, setProcesando] = useState(false);
  const [falloLocal, setFalloLocal] = useState<string | null>(null);

  const elegir = useCallback(async (origen: 'camara' | 'galeria') => {
    setFalloLocal(null);
    setProcesando(true);
    try {
      let resultado: ImagePicker.ImagePickerResult;
      if (origen === 'camara') {
        const permiso = await ImagePicker.requestCameraPermissionsAsync();
        if (!permiso.granted) {
          setFalloLocal('Necesitamos permiso de la cámara para tomar la foto.');
          return;
        }
        resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      } else {
        resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      }
      if (resultado.canceled) return;
      const asset = resultado.assets[0];
      onChange(await reducirFoto(asset.uri, asset.width, asset.height));
    } catch (e) {
      console.error('[PhotoSlot] Error al procesar la foto:', e);
      setFalloLocal('No se pudo procesar la foto. Inténtalo de nuevo.');
    } finally {
      setProcesando(false);
    }
  }, [onChange]);

  const mensaje = falloLocal ?? error;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.titulo}>{titulo}</Text>
      <View style={[styles.marco, !!mensaje && styles.marcoError]}>
        {uri ? (
          <Image source={{ uri }} style={styles.imagen} accessibilityLabel={`Vista previa: ${titulo}`} />
        ) : (
          <View style={styles.vacio}>
            <Ionicons name="camera-outline" size={28} color={COLORS.glassTextMutedDark} />
            <Text style={styles.ayuda}>{ayuda}</Text>
          </View>
        )}
        {procesando && (
          <View style={styles.cargando}>
            <ActivityIndicator color={COLORS.white} />
          </View>
        )}
      </View>

      <View style={styles.botones}>
        {Platform.OS !== 'web' && (
          <PressableScale
            onPress={() => elegir('camara')}
            disabled={disabled || procesando}
            accessibilityRole="button"
            accessibilityLabel={`Tomar foto: ${titulo}`}
            style={[styles.boton, (disabled || procesando) && styles.botonInactivo]}
          >
            <Ionicons name="camera" size={18} color={COLORS.white} />
            <Text style={styles.botonTexto}>{uri ? 'Repetir' : 'Tomar foto'}</Text>
          </PressableScale>
        )}
        <PressableScale
          onPress={() => elegir('galeria')}
          disabled={disabled || procesando}
          accessibilityRole="button"
          accessibilityLabel={`Elegir de la galería: ${titulo}`}
          style={[styles.boton, (disabled || procesando) && styles.botonInactivo]}
        >
          <Ionicons name="images" size={18} color={COLORS.white} />
          <Text style={styles.botonTexto}>Galería</Text>
        </PressableScale>
      </View>

      {mensaje ? (
        <Text style={styles.error} accessibilityRole="alert">
          {mensaje}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.md },
  titulo: {
    color: COLORS.glassTextDark,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.body,
    fontWeight: FONTS.weights.medium,
    marginBottom: SPACING.xs,
  },
  marco: {
    height: 150,
    borderRadius: SHAPES.borderRadiusSm,
    borderWidth: SHAPES.glassBorderWidth,
    borderColor: COLORS.glassBorderDark,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  marcoError: { borderColor: COLORS.danger },
  imagen: { width: '100%', height: '100%', resizeMode: 'cover' },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
  ayuda: {
    color: COLORS.glassTextMutedDark,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  cargando: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.6)',
  },
  botones: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  boton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderRadius: SHAPES.borderRadiusFull,
    backgroundColor: COLORS.primary,
  },
  botonInactivo: { opacity: 0.5 },
  botonTexto: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontFamily: FONTS.heading,
    fontWeight: FONTS.weights.semibold,
  },
  error: {
    color: COLORS.danger,
    fontSize: FONTS.sizes.xs,
    fontFamily: FONTS.body,
    marginTop: SPACING.xs,
  },
});

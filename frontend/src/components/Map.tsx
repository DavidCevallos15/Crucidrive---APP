import React, { forwardRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapViewNative, { Marker, PROVIDER_GOOGLE, Region, type MapViewProps } from 'react-native-maps';
import { COLORS } from '../constants/theme';

/**
 * Estilo claro de Google Maps: papel, caminos blancos y agua azul suave.
 */
const COASTAL_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F3EEE8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#74636D' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E5EAE0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FEE8C1' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8DCF4' }] },
];

/**
 * En Android, react-native-maps sin la clave de Google Maps cierra la app al pintar el mapa.
 * Expo Go trae su propia clave; un APK necesita GOOGLE_MAPS_API_KEY al compilar (app.config.js).
 */
const MAPA_DISPONIBLE = Platform.OS !== 'android'
  || Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  || Constants.expoConfig?.extra?.mapaAndroid === true;

const MapView = forwardRef<MapViewNative, MapViewProps>((props, ref) => {
  if (!MAPA_DISPONIBLE) {
    // Sin mapa, el resto de la pantalla (pedir viaje, consola, SOS) sigue funcionando.
    return (
      <View style={[props.style, styles.sinMapa]}>
        <Text style={styles.sinMapaTexto}>Mapa no disponible en esta versión</Text>
      </View>
    );
  }
  return <MapViewNative ref={ref} customMapStyle={COASTAL_MAP_STYLE} {...props} />;
});
MapView.displayName = 'MapView';

const styles = StyleSheet.create({
  sinMapa: {
    backgroundColor: COLORS.darkBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sinMapaTexto: {
    color: COLORS.glassTextMutedDark,
    fontSize: 14,
  },
});

export { Marker, PROVIDER_GOOGLE, type Region };
export default MapView;

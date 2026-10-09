import React, { forwardRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapViewNative, { Marker, PROVIDER_GOOGLE, Region, type MapViewProps } from 'react-native-maps';
import { COLORS } from '../constants/theme';

/**
 * Estilo nocturno de Google Maps. Combina con el cristal oscuro de la interfaz
 * y asegura el contraste del texto blanco flotando sobre el mapa.
 */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#121826' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A97AD' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F19' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2A3345' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#10261F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#232C3F' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0B0F19' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2F3B52' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A2230' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4F6F82' }] },
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
  return <MapViewNative ref={ref} customMapStyle={DARK_MAP_STYLE} {...props} />;
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

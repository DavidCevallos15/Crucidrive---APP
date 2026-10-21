import React, { forwardRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapViewNative, { Marker, PROVIDER_GOOGLE, Region, type MapViewProps } from 'react-native-maps';
import { COLORS } from '../constants/theme';
import { ESTILO_MAPA } from '../utils/estiloMapa';


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
  return <MapViewNative ref={ref} customMapStyle={ESTILO_MAPA} {...props} />;
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

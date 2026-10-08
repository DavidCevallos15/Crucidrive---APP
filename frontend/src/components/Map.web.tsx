import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { regionToBbox, type MapRegionLike } from '../utils/mapBbox';

/**
 * Versión web del mapa (solo para previsualizar; la app real usa Google Maps en Android).
 * Incrusta OpenStreetMap, sin API de pago, y le pone un velo oscuro para que combine
 * con el cristal de la interfaz. Se usa un velo y no un filtro CSS porque invertir un
 * iframe a pantalla completa es muy caro de pintar en teléfonos modestos.
 * Los marcadores no se dibujan en web.
 */
export const Marker = (_props: any) => null;
export const PROVIDER_GOOGLE = 'google';

export type Region = MapRegionLike;

const FALLBACK: MapRegionLike = {
  latitude: -0.842,
  longitude: -80.531,
  latitudeDelta: 0.11,
  longitudeDelta: 0.06,
};

const MapView = ({ children, style, initialRegion }: any) => {
  const bbox = regionToBbox(initialRegion ?? FALLBACK);
  return (
    <View style={[styles.container, style]}>
      {React.createElement('iframe', {
        title: 'Mapa de Crucita',
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`,
        style: {
          border: 0,
          width: '100%',
          height: '100%',
        },
      })}
      <View style={styles.scrim} pointerEvents="none" />
      <Text style={styles.attribution} pointerEvents="none">
        © Colaboradores de OpenStreetMap
      </Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 25, 0.5)',
  },
  // La licencia ODbL exige atribución visible; el aviso del propio mapa queda tapado por las fichas.
  attribution: {
    position: 'absolute',
    left: 16,
    top: 76,
    fontSize: 11,
    color: '#94A3B8',
  },
});

export default MapView;

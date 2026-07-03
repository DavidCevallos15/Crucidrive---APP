import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const Marker = (props: any) => <View {...props} />;
export const PROVIDER_GOOGLE = 'google';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const MapView = ({ children, style, ...props }: any) => (
  <View style={[styles.container, style]} {...props}>
    <Text style={styles.text}>Map is not supported on Web in this preview.</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#666',
    fontWeight: 'bold',
  }
});

export default MapView;

import React, { forwardRef } from 'react';
import MapViewNative, { Marker, PROVIDER_GOOGLE, Region, type MapViewProps } from 'react-native-maps';

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

const MapView = forwardRef<MapViewNative, MapViewProps>((props, ref) => (
  <MapViewNative ref={ref} customMapStyle={DARK_MAP_STYLE} {...props} />
));
MapView.displayName = 'MapView';

export { Marker, PROVIDER_GOOGLE, type Region };
export default MapView;

/**
 * Estilo claro de Google Maps: papel, caminos blancos y agua azul suave.
 * Los lugares de Google (restaurantes, tiendas, iglesias) se ven, para ubicarse como en Google
 * Maps (pedido de David, campo 20 oct 2026). Solo se oculta el transporte público.
 */
export const ESTILO_MAPA = [
  { elementType: 'geometry', stylers: [{ color: '#F3EEE8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#74636D' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E5EAE0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FEE8C1' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8DCF4' }] },
];

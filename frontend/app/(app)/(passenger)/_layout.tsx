import React from 'react';
import { AppTabLayout, type TabDefinition } from '../../../src/components/AppTabLayout';
import { COLORS } from '../../../src/constants/theme';

const PASSENGER_TABS: TabDefinition[] = [
  { name: 'index', title: 'Mapa', iconName: 'map' },
  { name: 'chat', title: 'Chat', iconName: 'chatbubbles' },
  { name: 'profile', title: 'Perfil', iconName: 'person' },
];

/**
 * Layout de navegación por tabs para el pasajero.
 */
export default function PassengerTabsLayout() {
  return <AppTabLayout tabs={PASSENGER_TABS} activeColor={COLORS.primary} />;
}

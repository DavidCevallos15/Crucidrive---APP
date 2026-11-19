import React from 'react';
import { Platform } from 'react-native';
import { AppTabLayout, type TabDefinition } from '../../../src/components/AppTabLayout';
import { COLORS } from '../../../src/constants/theme';
import ConductorSoloAndroidScreen from '../../../src/screens/ConductorSoloAndroidScreen';

const DRIVER_TABS: TabDefinition[] = [
  { name: 'index', title: 'Consola', iconName: 'speedometer' },
  { name: 'chat', title: 'Chat', iconName: 'chatbubbles' },
  { name: 'profile', title: 'Perfil', iconName: 'person' },
];

/**
 * Layout de navegación por tabs para el conductor. En la web (iPhone) no hay consola: sin
 * ubicación con la pantalla apagada no llegarían ofertas (spec 018, criterio 11; W2).
 */
export default function DriverTabsLayout() {
  if (Platform.OS === 'web') return <ConductorSoloAndroidScreen />;
  return <AppTabLayout tabs={DRIVER_TABS} activeColor={COLORS.success} />;
}

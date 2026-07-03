import React from 'react';
import { AppTabLayout, type TabDefinition } from '../../../src/components/AppTabLayout';
import { COLORS } from '../../../src/constants/theme';

const DRIVER_TABS: TabDefinition[] = [
  { name: 'index', title: 'Consola', iconName: 'speedometer' },
  { name: 'chat', title: 'Chat', iconName: 'chatbubbles' },
  { name: 'profile', title: 'Perfil', iconName: 'person' },
];

/**
 * Layout de navegación por tabs para el conductor.
 */
export default function DriverTabsLayout() {
  return <AppTabLayout tabs={DRIVER_TABS} activeColor={COLORS.success} />;
}

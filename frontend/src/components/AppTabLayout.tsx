import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

/**
 * Definición de una pestaña para el layout compartido.
 */
export interface TabDefinition {
  name: string;
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
}

/**
 * Props del layout de tabs compartido.
 */
interface AppTabLayoutProps {
  tabs: TabDefinition[];
  activeColor: string;
}

/**
 * Layout de tabs compartido entre pasajero y conductor.
 *
 * Extrae la configuración común de screenOptions, estilos de la tab bar
 * y el fondo de blur, parametrizando solo las diferencias:
 * - Color del tab activo (primary para pasajero, success para conductor)
 * - Definiciones de tabs (nombre, título, icono)
 */
export const AppTabLayout: React.FC<AppTabLayoutProps> = ({ tabs, activeColor }) => {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: COLORS.glassTextMutedDark,
        tabBarLabelStyle: {
          fontSize: FONTS.sizes.xs,
          fontFamily: FONTS.body,
          fontWeight: FONTS.weights.medium,
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(11, 15, 25, 0.85)',
          borderTopWidth: 0.5,
          borderTopColor: COLORS.glassBorderDark,
          paddingTop: 8,
          height: 85,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={25}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.iconName} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
};

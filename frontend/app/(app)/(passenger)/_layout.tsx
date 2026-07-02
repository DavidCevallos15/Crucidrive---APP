import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../../src/constants/theme';

/**
 * Layout de navegación por tabs para el pasajero.
 *
 * Tabs:
 * 1. Mapa — Pantalla principal con mapa y solicitud de viaje
 * 2. Chat — Chat en tiempo real con el conductor
 * 3. Perfil — Información del usuario y configuración
 */
export default function PassengerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

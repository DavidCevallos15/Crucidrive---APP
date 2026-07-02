import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../../src/constants/theme';

/**
 * Layout de navegación por tabs para el conductor.
 *
 * Tabs:
 * 1. Consola — Panel principal con mapa y switch de disponibilidad
 * 2. Chat — Chat en tiempo real con el pasajero
 * 3. Perfil — Información del conductor y configuración
 */
export default function DriverTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.success,
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
          title: 'Consola',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="speedometer" size={size} color={color} />
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

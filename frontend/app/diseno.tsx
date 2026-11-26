import React from 'react';
import { Redirect } from 'expo-router';
import { DesignSystemScreen } from '../src/screens/DesignSystemScreen';

/**
 * Galería interna del sistema de diseño (solo disponible en desarrollo, no en producción).
 */
export default function DesignRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DesignSystemScreen />;
}

import React from 'react';
import { Platform } from 'react-native';
import VerificationScreen from '../../src/screens/VerificationScreen';
import ConductorSoloAndroidScreen from '../../src/screens/ConductorSoloAndroidScreen';

/**
 * Ruta /(app)/verificacion: cedula y fotos del conductor. Es la unica pantalla
 * que ve un conductor mientras no este aprobado. En la web remite a Android (spec 018, W2).
 */
export default function VerificacionRuta() {
  if (Platform.OS === 'web') return <ConductorSoloAndroidScreen />;
  return <VerificationScreen />;
}

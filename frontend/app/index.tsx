import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapScreen from '../src/screens/MapScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { needsWelcome, rememberWelcome } from '../src/utils/welcomePreference';
import { COLORS } from '../src/constants/theme';

/**
 * Ruta raíz de la app: pantalla principal del pasajero.
 * Permite solicitar un mototaxi sin pasar por login.
 */
export default function PublicHome() {
  const [welcome, setWelcome] = useState<boolean | null>(null);
  useEffect(() => { let live = true; needsWelcome(AsyncStorage).then((show) => { if (live) setWelcome(show); }); return () => { live = false; }; }, []);
  const presented = useCallback(() => { void rememberWelcome(AsyncStorage); }, []);
  const proceed = useCallback(() => { presented(); setWelcome(false); }, [presented]);
  if (welcome === null) return <View style={{ flex: 1, backgroundColor: COLORS.paper, justifyContent: 'center' }}><ActivityIndicator color={COLORS.wine} /></View>;
  return welcome ? <WelcomeScreen onContinue={proceed} onPresented={presented} /> : <MapScreen />;
}

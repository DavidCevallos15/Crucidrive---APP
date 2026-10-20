import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { rememberWelcome } from '../src/utils/welcomePreference';
export default function WelcomePreview() {
  const router = useRouter();
  const presented = useCallback(() => { void rememberWelcome(AsyncStorage); }, []);
  return <WelcomeScreen onPresented={presented} onContinue={() => { presented(); router.replace('/'); }} />;
}

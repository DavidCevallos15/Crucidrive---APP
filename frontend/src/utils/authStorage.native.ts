import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createSecureSessionStorage } from './secureSessionStorage';

export const authStorage = createSecureSessionStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, {
    // El conductor sigue recibiendo ofertas con la pantalla bloqueada tras el primer desbloqueo.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  }),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
}, AsyncStorage);

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Web: almacenamiento del navegador. La variante .native usa Keychain/Keystore. */
export const authStorage = AsyncStorage;

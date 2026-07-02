import { Slot } from 'expo-router';

/**
 * Layout del grupo de autenticación.
 *
 * Las pantallas dentro de (auth)/ son rutas públicas
 * que no requieren sesión activa.
 */
export default function AuthLayout() {
  return <Slot />;
}

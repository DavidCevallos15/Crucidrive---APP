import { Slot, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';

/**
 * Layout protegido de la aplicación.
 *
 * Verifica que exista una sesión activa. Si no la hay,
 * redirige al login automáticamente.
 */
export default function AppLayout() {
  const session = useAuthStore((s) => s.session);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}

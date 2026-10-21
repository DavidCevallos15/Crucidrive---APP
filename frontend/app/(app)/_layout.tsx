import { Slot } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';

/**
 * Layout protegido de la aplicación.
 *
 * No monta contenido privado sin sesión. El layout raíz es el único dueño de
 * la redirección: dos guards compitiendo por / dejaban un bucle al salir.
 */
export default function AppLayout() {
  const session = useAuthStore((s) => s.session);

  if (!session) {
    return null;
  }

  return <Slot />;
}

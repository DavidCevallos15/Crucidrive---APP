import { Slot } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useSupabaseAuth } from '../../src/hooks/useSupabaseAuth';
import { PantallaSalida } from '../../src/components/PantallaSalida';
import { vistaPrivada } from '../../src/utils/routing';

/**
 * Layout protegido de la aplicación.
 *
 * No monta contenido privado sin sesión. El layout raíz es el único dueño de
 * la redirección: dos guards compitiendo por / dejaban un bucle al salir.
 *
 * Mientras se cierra la sesión (o si falló), muestra la pantalla de salida en lugar de las
 * pantallas privadas: el mapa y el menú se desmontan antes, con la sesión todavía válida, y
 * no en el mismo instante en que se monta el mapa de /explorar (campo, 21 oct 2026).
 */
export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const isSigningOut = useAuthStore((s) => s.isSigningOut);
  const logoutError = useAuthStore((s) => s.logoutError);
  const descartarErrorSalida = useAuthStore((s) => s.descartarErrorSalida);
  const { signOut } = useSupabaseAuth();

  const vista = vistaPrivada({ hasSession: Boolean(session), isSigningOut, logoutError });
  if (vista === 'nada') return null;
  if (vista === 'salida') {
    return <PantallaSalida error={isSigningOut ? null : logoutError} onReintentar={() => void signOut()} onVolver={descartarErrorSalida} />;
  }
  return <Slot />;
}

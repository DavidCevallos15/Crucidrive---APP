import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { notificaciones } from '../servicios/notificaciones';
import { destinoDeAviso, leerDatosAviso } from '../utils/avisoOferta';

/**
 * Al tocar un aviso, también con la app cerrada (paso 004, criterios 7 y 10). Solo en el
 * layout raíz y con la cuenta lista (`rol` conocido y, si es conductor, su verificación
 * consultada); antes, la guardia de rutas podría deshacer la navegación.
 */
const Notifications = notificaciones();
// Se decide una vez, al cargar: en Expo Go no hay avisos y este hook devuelve siempre null.
const usarUltimaRespuesta = Notifications ? Notifications.useLastNotificationResponse : (): null => null;

export const useRespuestaAvisos = (rol: string | null) => {
  const respuesta = usarUltimaRespuesta();
  const router = useRouter();

  useEffect(() => {
    if (!Notifications || !respuesta || !rol) return;
    if (respuesta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const destino = destinoDeAviso(leerDatosAviso(respuesta.notification.request.content.data), rol);
    // Una sola vez: al volver a montar el layout no se repite la navegación.
    Notifications.clearLastNotificationResponse();
    if (destino) router.navigate(destino as never);
  }, [respuesta, rol, router]);
};

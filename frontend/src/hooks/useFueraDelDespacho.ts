import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { canalUbicacion, ultimoEnvioAlAbrir } from '../servicios/ubicacion';
import { fueraDelDespacho } from '../utils/seguimiento';
import type { EstadoTricimoto } from '../utils/oferta';

/**
 * "Estuviste fuera del despacho" (paso 004, criterio 20, P20). Se comprueba al abrir la app
 * (con el último envío guardado, por si el sistema la mató) y cada vez que vuelve a primer
 * plano, antes de que la consola envíe de nuevo.
 */
export const useFueraDelDespacho = (estado: EstadoTricimoto | null) => {
  const [visible, setVisible] = useState(false);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // Al abrir: en cuanto se conoce el estado de la BD, una sola vez.
  const comprobadoAlAbrir = useRef(false);
  useEffect(() => {
    if (estado === null || comprobadoAlAbrir.current) return;
    comprobadoAlAbrir.current = true;
    const ahora = Date.now();
    void ultimoEnvioAlAbrir().then((previo) => {
      if (fueraDelDespacho(estado, previo, ahora)) setVisible(true);
    });
  }, [estado]);

  // Al volver a primer plano: con el último envío en memoria (la tarea y la consola lo anotan).
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') return;
      const ultimo = canalUbicacion.ultimoEnvio()?.en ?? null;
      if (fueraDelDespacho(estadoRef.current, ultimo, Date.now())) setVisible(true);
    });
    return () => suscripcion.remove();
  }, []);

  const cerrar = useCallback(() => setVisible(false), []);
  /** Desde los ajustes de la app se quita la optimización de batería. */
  const abrirAjustes = useCallback(() => {
    setVisible(false);
    void Linking.openSettings();
  }, []);

  return { visible, cerrar, abrirAjustes };
};

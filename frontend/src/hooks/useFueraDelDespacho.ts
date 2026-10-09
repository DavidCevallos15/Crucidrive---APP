import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { canalUbicacion, ultimoEnvioAlAbrir } from '../servicios/ubicacion';
import { fueraDelDespacho, UMBRAL_FUERA_SEG } from '../utils/seguimiento';
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
  // Al volver de los ajustes la consola aún no envió: no repetir el aviso enseguida.
  const avisadoEn = useRef(0);
  const avisar = useCallback(() => {
    if (Date.now() - avisadoEn.current < UMBRAL_FUERA_SEG * 1000) return;
    avisadoEn.current = Date.now();
    setVisible(true);
  }, []);

  // Al abrir: en cuanto se conoce el estado de la BD, una sola vez.
  const comprobadoAlAbrir = useRef(false);
  useEffect(() => {
    if (estado === null || comprobadoAlAbrir.current) return;
    comprobadoAlAbrir.current = true;
    const ahora = Date.now();
    void ultimoEnvioAlAbrir().then((previo) => {
      if (fueraDelDespacho(estado, previo, ahora)) avisar();
    });
  }, [estado, avisar]);

  // Al volver a primer plano: con el último envío en memoria (la tarea y la consola lo anotan).
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente !== 'active') return;
      const ultimo = canalUbicacion.ultimoEnvio()?.en ?? null;
      if (fueraDelDespacho(estadoRef.current, ultimo, Date.now())) avisar();
    });
    return () => suscripcion.remove();
  }, [avisar]);

  const cerrar = useCallback(() => setVisible(false), []);
  /** Desde los ajustes de la app se quita la optimización de batería. */
  const abrirAjustes = useCallback(() => {
    setVisible(false);
    void Linking.openSettings();
  }, []);

  return { visible, cerrar, abrirAjustes };
};

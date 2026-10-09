import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import {
  detenerSeguimientoFondo,
  iniciarSeguimientoFondo,
  leerPermisosUbicacion,
  pedirPermisoFondo,
} from '../tareas/ubicacionFondo';
import { debeSeguir, decidirPermiso, type ParametrosUbicacion } from '../utils/seguimiento';
import type { EstadoTricimoto } from '../utils/oferta';

/** Aviso visible en la consola cuando no hay seguimiento en segundo plano (criterio 4). */
export type AvisoSeguimiento = 'solo_abierta' | 'sin_ubicacion' | null;

/**
 * Arranca y detiene el seguimiento en segundo plano con la disponibilidad (paso 004,
 * criterios 1 a 5, P13 y P19). Antes del primer diálogo del sistema muestra la explicación
 * propia; si el conductor no da el permiso, puede seguir con la app abierta.
 */
export const useSeguimientoFondo = (estado: EstadoTricimoto | null, parametros: ParametrosUbicacion) => {
  const [explicando, setExplicando] = useState(false);
  const [aviso, setAviso] = useState<AvisoSeguimiento>(null);
  const yaExplicado = useRef(false);
  // El diálogo del sistema también pasa la app a segundo plano y de vuelta: no reabrir la explicación.
  const explicandoRef = useRef(false);
  explicandoRef.current = explicando;
  const seguir = debeSeguir(estado);

  const aplicar = useCallback(async () => {
    if (!seguir) {
      setExplicando(false);
      setAviso(null);
      await detenerSeguimientoFondo();
      return;
    }
    const permisos = await leerPermisosUbicacion();
    const decision = decidirPermiso({ ...permisos, yaExplicado: yaExplicado.current });
    if (decision === 'explicar') {
      setExplicando(true);
      return;
    }
    if (decision === 'iniciar') {
      const iniciado = await iniciarSeguimientoFondo(parametros);
      setAviso(iniciado ? null : 'solo_abierta');
      return;
    }
    setAviso(decision);
  }, [seguir, parametros]);

  useEffect(() => {
    void aplicar();
  }, [aplicar]);

  // Al volver de los ajustes (o de otra app), el permiso pudo cambiar.
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (siguiente) => {
      if (siguiente === 'active' && !explicandoRef.current) void aplicar();
    });
    return () => suscripcion.remove();
  }, [aplicar]);

  /** "Continuar" en la explicación: ahora sí, el diálogo del sistema. */
  const continuar = useCallback(async () => {
    yaExplicado.current = true;
    setExplicando(false);
    await pedirPermisoFondo();
    await aplicar();
  }, [aplicar]);

  /** "Ahora no": sigue con la app abierta (criterio 4). */
  const ahoraNo = useCallback(() => {
    yaExplicado.current = true;
    setExplicando(false);
    setAviso('solo_abierta');
  }, []);

  /** Desde los ajustes de la app se concede "Permitir todo el tiempo". */
  const abrirAjustes = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { explicando, aviso, continuar, ahoraNo, abrirAjustes, reintentar: aplicar };
};

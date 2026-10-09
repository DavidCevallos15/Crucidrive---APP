import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useRideStore } from '../store/useRideStore';
import {
  alRecibirPosicion,
  debeVerConductor,
  leerPosicion,
  textoUltimaPosicion,
  UMBRAL_FRESCURA_SEG,
  type PosicionConductor,
} from '../utils/conductorDelViaje';
import type { useSocket } from './useSocket';

/** Respaldo por si se pierden eventos con la conexión arriba: se relee la BD. */
const RESPALDO_MS = 30_000;

/**
 * Posición del conductor del viaje para el pasajero (paso 004, criterios 13, 15 y 17; P17).
 * Llega por socket (`conductor_ubicacion`, solo a la sala del pasajero) y, al abrir o
 * reconectar, se lee con la RPC `ubicacion_conductor_viaje` (RLS: solo su viaje activo).
 */
export const useConductorDelViaje = (socket: Pick<ReturnType<typeof useSocket>, 'onEvent' | 'isConnected'>) => {
  const { onEvent, isConnected } = socket;
  const ride = useRideStore((s) => s.activeRide);
  const viajeId = debeVerConductor(ride?.status) ? ride?.id ?? null : null;
  const [posicion, setPosicion] = useState<PosicionConductor | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  // Al terminar o cambiar el viaje, el conductor deja de verse en ese momento (15).
  useEffect(() => {
    setPosicion((actual) => (actual && actual.viajeId === viajeId ? actual : null));
  }, [viajeId]);

  const leer = useCallback(async () => {
    if (!viajeId) return;
    const { data, error } = await supabase.rpc('ubicacion_conductor_viaje', { p_viaje: viajeId });
    if (error) {
      console.warn('[Viaje] No se pudo leer la posición del conductor:', error.message);
      return;
    }
    const fila = Array.isArray(data) ? data[0] : data;
    setPosicion((actual) => alRecibirPosicion(actual, leerPosicion(fila, viajeId)));
  }, [viajeId]);

  // Al abrir el viaje y al reconectar: los eventos emitidos sin conexión se pierden (17).
  useEffect(() => {
    if (viajeId && isConnected) void leer();
  }, [viajeId, isConnected, leer]);

  useEffect(() => {
    if (!viajeId) return undefined;
    return onEvent('conductor_ubicacion', (datos) =>
      setPosicion((actual) => alRecibirPosicion(actual, leerPosicion(datos, viajeId))));
  }, [viajeId, onEvent]);

  // Reloj para "Última posición hace X s" y respaldo si los datos se quedan viejos.
  useEffect(() => {
    if (!viajeId) return undefined;
    const tic = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(tic);
  }, [viajeId]);

  const vieja = !posicion || ahora - posicion.en > UMBRAL_FRESCURA_SEG * 1000;
  useEffect(() => {
    if (!viajeId || !vieja) return undefined;
    const id = setInterval(() => void leer(), RESPALDO_MS);
    return () => clearInterval(id);
  }, [viajeId, vieja, leer]);

  return {
    posicion: viajeId ? posicion : null,
    antiguedad: posicion ? textoUltimaPosicion(posicion.en, ahora) : '',
  };
};

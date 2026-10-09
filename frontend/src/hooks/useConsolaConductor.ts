import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore } from '../store/useRideStore';
import {
  alRecibirOferta,
  alRetirarOferta,
  calcularDesfase,
  estadoTrasError,
  segundosRestantes,
  textoPunto,
  type EstadoTricimoto,
  type OfertaViaje,
} from '../utils/oferta';
import type { useSocket } from './useSocket';

type Resultado = { ok: true } | { ok: false; mensaje: string };

const SIN_CONEXION = 'Sin conexión con el servidor. Revisa tus datos móviles.';

/**
 * Consola del conductor (paso 003, T14): disponibilidad real en el servidor (criterio 1),
 * ofertas por socket con cuenta regresiva según el reloj del servidor (15, R14), rechazo
 * (6) y retirada de la oferta cuando vence, la toma otro o el pasajero cancela (12).
 */
export const useConsolaConductor = (
  socket: Pick<ReturnType<typeof useSocket>, 'onEvent' | 'isConnected' | 'rechazarOferta'>
) => {
  const { onEvent, isConnected, rechazarOferta } = socket;
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [estado, setEstado] = useState<EstadoTricimoto | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [oferta, setOferta] = useState<OfertaViaje | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [aceptando, setAceptando] = useState(false);
  const desfase = useRef(0);

  // ─── Estado de la tricimoto según la BD (RLS: la propia) ──
  const leerEstado = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('tricimotos')
      .select('estado')
      .eq('conductor_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[Consola] No se pudo leer la disponibilidad:', error.message);
      return;
    }
    setEstado((data?.estado as EstadoTricimoto | undefined) ?? null);
  }, [userId]);

  // Al conectar (o reconectar): la disponibilidad pudo cambiar (viaje terminado, R11).
  useEffect(() => {
    if (isConnected) void leerEstado();
  }, [isConnected, leerEstado]);

  // ─── Avisos del servidor ───────────────────────────────────
  useEffect(() => {
    const quitarHora = onEvent('hora_servidor', ({ ahora }) => {
      desfase.current = calcularDesfase(ahora, Date.now());
    });
    const quitarOferta = onEvent('oferta_viaje', (nueva) => setOferta((actual) => alRecibirOferta(actual, nueva)));
    const quitarRetirada = onEvent('oferta_retirada', ({ viajeId }) =>
      setOferta((actual) => alRetirarOferta(actual, viajeId))
    );
    return () => {
      quitarHora();
      quitarOferta();
      quitarRetirada();
    };
  }, [onEvent]);

  // ─── Cuenta regresiva desde venceEn (R14) ─────────────────
  useEffect(() => {
    if (!oferta) return;
    const tic = () => {
      const quedan = segundosRestantes(oferta.venceEn, desfase.current, Date.now());
      setSegundos(quedan);
      // Vencida: se cierra aquí; el servidor también avisa con oferta_retirada.
      if (quedan === 0) setOferta((actual) => alRetirarOferta(actual, oferta.viajeId));
    };
    tic();
    const id = setInterval(tic, 250);
    return () => clearInterval(id);
  }, [oferta]);

  // ─── Acciones ──────────────────────────────────────────────
  const cambiarDisponibilidad = useCallback(async (disponible: boolean): Promise<Resultado> => {
    setCambiando(true);
    try {
      const response = await authFetch(API_CONFIG.endpoints.driver.availability, {
        method: 'PATCH',
        body: JSON.stringify({ disponible }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setEstado((actual) => estadoTrasError(response.status, actual));
        return { ok: false, mensaje: body?.message ?? 'No se pudo cambiar tu disponibilidad.' };
      }
      setEstado((body?.data?.estado as EstadoTricimoto | undefined) ?? (disponible ? 'disponible' : 'inactivo'));
      // Al dejar de estar disponible, el servidor da por rechazada la oferta abierta.
      if (!disponible) setOferta(null);
      return { ok: true };
    } catch (error) {
      console.error('[Consola] Error al cambiar disponibilidad:', error);
      return { ok: false, mensaje: SIN_CONEXION };
    } finally {
      setCambiando(false);
    }
  }, []);

  const aceptar = useCallback(async (): Promise<Resultado> => {
    if (!oferta) return { ok: true };
    setAceptando(true);
    try {
      const response = await authFetch(API_CONFIG.endpoints.rides.accept, {
        method: 'POST',
        body: JSON.stringify({ viajeId: oferta.viajeId }),
      });
      const body = await response.json().catch(() => null);
      // Solo la oferta aceptada: si otro ganó (409), pudo llegar una nueva mientras se esperaba.
      setOferta((actual) => alRetirarOferta(actual, oferta.viajeId));
      if (!response.ok) {
        // 409: ya fue tomado o la oferta venció (criterios 8 y 9).
        return { ok: false, mensaje: body?.message ?? 'No se pudo aceptar el viaje.' };
      }
      setEstado('ocupado');
      // Para el chat del viaje; las pantallas del viaje en curso son del paso 005.
      useRideStore.getState().setActiveRide({
        id: oferta.viajeId,
        status: 'aceptado',
        originSectorId: oferta.origen.sectorId ?? '',
        originName: textoPunto(oferta.origen),
        destinationSectorId: oferta.destino.sectorId ?? '',
        destinationName: textoPunto(oferta.destino),
        passengers: oferta.pasajeros,
        price: oferta.tarifa,
        destinationNote: '',
        driver: null,
        chatThreadId: body?.data?.chat?.threadId ?? null,
        createdAt: new Date().toISOString(),
      });
      return { ok: true };
    } catch (error) {
      console.error('[Consola] Error al aceptar:', error);
      return { ok: false, mensaje: SIN_CONEXION };
    } finally {
      setAceptando(false);
    }
  }, [oferta]);

  /** Rechazar no tiene penalización (criterio 6). Sin conexión, la oferta vence sola. */
  const rechazar = useCallback(() => {
    if (!oferta) return;
    rechazarOferta(oferta.viajeId);
    setOferta(null);
  }, [oferta, rechazarOferta]);

  return { estado, cambiando, oferta, segundos, aceptando, cambiarDisponibilidad, aceptar, rechazar };
};

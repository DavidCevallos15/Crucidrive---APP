import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { calculateFare } from '../constants/sectors';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore } from '../store/useRideStore';
import {
  crearBuzonEventos,
  sincronizarViaje,
  COLUMNAS_VIAJE,
  ESTADOS_ACTIVOS,
  type EventoPasajero,
  type FilaViaje,
  type LectorViaje,
} from '../utils/viaje';
import {
  armarCuerpoSolicitud,
  nombreDestino,
  nombreOrigen,
  refrescarOrigen,
  sectorDeOrigen,
  type Gps,
  type Solicitud,
} from '../utils/solicitud';
import type { useSocket } from './useSocket';

/** Respaldo por si se pierde un aviso del socket mientras se busca conductor. */
const RESPALDO_MS = 30_000;

/** Lecturas con el JWT del pasajero: RLS le deja ver su viaje, el conductor asignado y el chat. */
const lector: LectorViaje = {
  async viaje(id) {
    const { data, error } = await supabase.from('viajes').select(COLUMNAS_VIAJE).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as FilaViaje | null;
  },
  async viajeActivo(pasajeroId) {
    const { data, error } = await supabase
      .from('viajes')
      .select(COLUMNAS_VIAJE)
      .eq('pasajero_id', pasajeroId)
      .in('estado', [...ESTADOS_ACTIVOS])
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as FilaViaje | null;
  },
  async conductor(viajeId, conductorId) {
    const [perfil, tricimoto, hilo] = await Promise.all([
      supabase.from('perfiles').select('nombre, telefono').eq('id', conductorId).maybeSingle(),
      supabase.from('tricimotos').select('placa').eq('conductor_id', conductorId).maybeSingle(),
      supabase.from('threads').select('id').eq('viaje_id', viajeId).maybeSingle(),
    ]);
    return {
      driver: {
        id: conductorId,
        nombre: perfil.data?.nombre ?? null,
        telefono: perfil.data?.telefono ?? null,
        placa: tricimoto.data?.placa ?? null,
      },
      threadId: hilo.data?.id ?? null,
    };
  },
};

type Resultado = { ok: true } | { ok: false; mensaje: string };

/**
 * Ciclo de la solicitud del pasajero (paso 003, T13): pedir, "Buscando tricimoto…",
 * cancelar, "sin conductor" con "Volver a pedir" y "aceptado" (criterios 10, 11, 12 y 16).
 */
export const useViajePasajero = (socket: Pick<ReturnType<typeof useSocket>, 'onEvent' | 'isConnected'>) => {
  const { onEvent, isConnected } = socket;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeRide = useRideStore((s) => s.activeRide);
  const sincronizando = useRef(false);
  const [buzon] = useState(() => crearBuzonEventos());

  // ─── Avisos del servidor ───────────────────────────────────
  useEffect(() => {
    const recibir = (evento: EventoPasajero) => {
      const { activeRide: ride, setActiveRide } = useRideStore.getState();
      setActiveRide(buzon.recibir(ride, evento));
    };
    const quitarAceptado = onEvent('viaje_aceptado', (datos) => recibir({ tipo: 'viaje_aceptado', datos }));
    const quitarSinConductor = onEvent('viaje_sin_conductor', (datos) => recibir({ tipo: 'viaje_sin_conductor', datos }));
    return () => {
      quitarAceptado();
      quitarSinConductor();
    };
  }, [onEvent, buzon]);

  // ─── Lectura de la BD ──────────────────────────────────────
  const sincronizar = useCallback(async () => {
    if (!userId || sincronizando.current) return;
    sincronizando.current = true;
    try {
      const local = useRideStore.getState().activeRide;
      const siguiente = await sincronizarViaje(lector, local, userId);
      // Si mientras tanto cambió el viaje local (otro aviso o una nueva solicitud), gana lo local.
      if (useRideStore.getState().activeRide === local) useRideStore.getState().setActiveRide(siguiente);
    } catch (error) {
      console.warn('[Viaje] No se pudo leer el estado del viaje:', error);
    } finally {
      sincronizando.current = false;
    }
  }, [userId]);

  // Al conectar (o reconectar) se lee el viaje: los avisos emitidos sin conexión se pierden.
  useEffect(() => {
    if (isConnected) void sincronizar();
  }, [isConnected, sincronizar]);

  const buscando = activeRide?.status === 'solicitado';
  useEffect(() => {
    if (!buscando) return;
    const id = setInterval(() => void sincronizar(), RESPALDO_MS);
    return () => clearInterval(id);
  }, [buscando, sincronizar]);

  // ─── Acciones ──────────────────────────────────────────────
  const solicitar = useCallback(async (solicitud: Solicitud): Promise<Resultado> => {
    const { setRequesting, setActiveRide, setUltimaSolicitud } = useRideStore.getState();
    setRequesting(true);
    try {
      const response = await authFetch(API_CONFIG.endpoints.rides.request, {
        method: 'POST',
        body: JSON.stringify(armarCuerpoSolicitud(solicitud)),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        // 409: ya tiene un viaje activo (criterio 13); se muestra ese viaje.
        if (response.status === 409) void sincronizar();
        return { ok: false, mensaje: body?.message ?? 'No se pudo solicitar el viaje.' };
      }
      const viaje = body?.data;
      setUltimaSolicitud(solicitud);
      setActiveRide(buzon.aplicarGuardados({
        id: viaje?.id ?? '',
        status: 'solicitado',
        originSectorId: viaje?.sector_origen_id ?? sectorDeOrigen(solicitud.origen) ?? '',
        originName: nombreOrigen(solicitud.origen),
        destinationSectorId: viaje?.sector_destino_id ?? '',
        destinationName: nombreDestino(solicitud.destino),
        passengers: solicitud.pasajeros,
        price: Number(viaje?.tarifa ?? calculateFare(solicitud.pasajeros)),
        destinationNote: solicitud.destinoNota.trim(),
        driver: null,
        chatThreadId: null,
        createdAt: viaje?.creado_en ?? new Date().toISOString(),
      }));
      return { ok: true };
    } catch (error) {
      console.error('[Viaje] Error al solicitar:', error);
      return { ok: false, mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión.' };
    } finally {
      setRequesting(false);
    }
  }, [sincronizar, buzon]);

  /** Cancela mientras se busca conductor (criterio 12). */
  const cancelar = useCallback(async (): Promise<Resultado> => {
    const ride = useRideStore.getState().activeRide;
    if (!ride) return { ok: true };
    try {
      const response = await authFetch(API_CONFIG.endpoints.rides.updateStatus(ride.id), {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'cancelado' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        // Puede que justo se cerrara o aceptara: se muestra lo que diga la BD.
        void sincronizar();
        return { ok: false, mensaje: body?.message ?? 'No se pudo cancelar la solicitud.' };
      }
      useRideStore.getState().clearRide();
      return { ok: true };
    } catch (error) {
      console.error('[Viaje] Error al cancelar:', error);
      return { ok: false, mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión.' };
    }
  }, [sincronizar]);

  /** "Volver a pedir" con un toque, con la misma solicitud (criterio 11). */
  const volverAPedir = useCallback(async (gps: Gps): Promise<Resultado> => {
    const ultima = useRideStore.getState().ultimaSolicitud;
    if (!ultima) return { ok: false, mensaje: 'No hay una solicitud anterior.' };
    return solicitar(refrescarOrigen(ultima, gps));
  }, [solicitar]);

  /** Cierra el aviso de "sin conductor" y vuelve a la ficha. */
  const descartar = useCallback(() => useRideStore.getState().clearRide(), []);

  return { solicitar, cancelar, volverAPedir, descartar };
};

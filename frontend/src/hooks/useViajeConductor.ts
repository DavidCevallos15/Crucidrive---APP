import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore } from '../store/useRideStore';
import { captureAccountScope } from '../utils/accountScope';
import { textoPunto, type EstadoTricimoto } from '../utils/oferta';
import {
  avisoParaConductor,
  COLUMNAS_VIAJE_CONDUCTOR,
  leerViajeConductor,
  type FilaViajeConductor,
  type LectorViajeConductor,
  type MotivoCancelacion,
  type PasoConductor,
  type ViajeConductor,
  trasPaso,
} from '../utils/viajeConductor';
import type { useSocket } from './useSocket';

type Resultado = { ok: true; terminado?: boolean } | { ok: false; mensaje: string };

const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa tus datos móviles e inténtalo de nuevo.';
const SESION_CAMBIO = 'Tu sesión cambió. Vuelve a abrir el viaje con tu cuenta.';

const ENDPOINT_DEL_PASO: Record<PasoConductor, (id: string) => string> = {
  llegada: API_CONFIG.endpoints.rides.llegada,
  iniciar: API_CONFIG.endpoints.rides.iniciar,
  terminar: API_CONFIG.endpoints.rides.terminar,
};

/** Lecturas con el JWT del conductor: RLS le deja ver su viaje, su pasajero y su chat. */
const lector: LectorViajeConductor = {
  async viajeAbierto(conductorId) {
    const { data, error } = await supabase
      .from('viajes')
      .select(COLUMNAS_VIAJE_CONDUCTOR)
      .eq('conductor_id', conductorId)
      .in('estado', ['aceptado', 'en_curso'])
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as FilaViajeConductor | null;
  },
  async pasajero(pasajeroId) {
    const { data } = await supabase.from('perfiles').select('nombre, telefono').eq('id', pasajeroId).maybeSingle();
    return { nombre: data?.nombre ?? null, telefono: data?.telefono ?? null };
  },
  async hilo(viajeId) {
    const { data } = await supabase.from('threads').select('id').eq('viaje_id', viajeId).maybeSingle();
    return data?.id ?? null;
  },
  async paquete(viajeId) {
    const { data } = await supabase.from('encomiendas').select('descripcion, destinatario').eq('viaje_id', viajeId).maybeSingle();
    return data ?? null;
  },
  async recogida(viajeId) {
    const { data } = await supabase.rpc('punto_recogida', { p_viaje: viajeId });
    const fila = Array.isArray(data) ? data[0] : data;
    return fila && Number.isFinite(fila.lat) && Number.isFinite(fila.lng) ? { lat: fila.lat, lng: fila.lng } : null;
  },
};

/** Lo que usa el chat (pestaña Chat): el mismo store que el pasajero. */
const publicarParaChat = (viaje: ViajeConductor | null) => {
  const store = useRideStore.getState();
  if (!viaje) {
    store.clearRide();
    return;
  }
  store.setActiveRide({
    id: viaje.id,
    serviceType: viaje.encomienda ? 'encomienda' : 'viaje',
    parcel: viaje.paquete,
    status: viaje.estado,
    originSectorId: viaje.origen.sectorId ?? '',
    originName: textoPunto(viaje.origen),
    destinationSectorId: viaje.destino.sectorId ?? '',
    destinationName: textoPunto(viaje.destino),
    passengers: viaje.pasajeros,
    price: viaje.tarifa,
    destinationNote: '',
    driver: null,
    chatThreadId: viaje.threadId,
    createdAt: store.activeRide?.createdAt ?? new Date().toISOString(),
  });
};

/**
 * Viaje aceptado del conductor (paso 005, plan P9; criterios 1 a 9 y 20): se lee de la BD
 * cuando la tricimoto queda ocupada y al reconectar, da cada paso por el servidor y se
 * cierra si el pasajero cancela o termina.
 * @param alCerrar - Se llama cuando el viaje se cierra, para volver a leer la disponibilidad.
 */
export const useViajeConductor = (
  socket: Pick<ReturnType<typeof useSocket>, 'onEvent' | 'isConnected'>,
  estadoTricimoto: EstadoTricimoto | null,
  alCerrar: (aviso: { titulo: string; texto: string } | null) => void
) => {
  const { onEvent, isConnected } = socket;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [viaje, setViaje] = useState<ViajeConductor | null>(null);
  const [enviando, setEnviando] = useState<PasoConductor | 'cancelar' | null>(null);
  const leyendo = useRef(false);
  const viajeRef = useRef<ViajeConductor | null>(null);
  const alCerrarRef = useRef(alCerrar);
  alCerrarRef.current = alCerrar;

  const fijar = useCallback((siguiente: ViajeConductor | null) => {
    viajeRef.current = siguiente;
    setViaje(siguiente);
    publicarParaChat(siguiente);
  }, []);

  const cargar = useCallback(async () => {
    if (!userId || leyendo.current) return;
    leyendo.current = true;
    const scope = captureAccountScope(useAuthStore.getState);
    if (scope.userId !== userId || !scope.isCurrent()) { leyendo.current = false; return; }
    try {
      const siguiente = await leerViajeConductor(lector, userId);
      if (scope.isCurrent()) fijar(siguiente);
    } catch (error) {
      // Sin red se conserva lo que se ve; se vuelve a leer al reconectar.
      console.warn('[ViajeConductor] No se pudo leer el viaje:', error);
    } finally {
      leyendo.current = false;
    }
  }, [userId, fijar]);

  // Ocupado = tiene un viaje (al aceptar o al abrir la app con uno en curso). Si deja de estar
  // ocupado con la tarjeta a la vista (se perdió el aviso del socket), la lectura la quita.
  const ocupado = estadoTricimoto === 'ocupado';
  useEffect(() => {
    if (isConnected && (ocupado || viajeRef.current)) void cargar();
  }, [estadoTricimoto, ocupado, isConnected, cargar]);

  // El pasajero canceló o terminó (criterios 5b y 8): el viaje se cierra en esta pantalla.
  useEffect(() => onEvent('viaje_estado', (ev) => {
    const aviso = avisoParaConductor(ev);
    const actual = viajeRef.current;
    if (!aviso || (actual && actual.id !== ev.viajeId)) return;
    fijar(null);
    alCerrarRef.current(aviso);
  }), [onEvent, fijar]);

  /** Un paso solo se da por hecho cuando el servidor responde bien (criterio 20). */
  const enviar = useCallback(async (ruta: string, cuerpo?: object): Promise<{ ok: true; data: any } | { ok: false; mensaje: string }> => {
    try {
      const response = await authFetch(ruta, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const body = await response.json().catch(() => null);
      if (!response.ok) return { ok: false, mensaje: body?.message ?? 'No se pudo completar el paso.' };
      return { ok: true, data: body?.data ?? null };
    } catch (error) {
      console.error('[ViajeConductor] Error de red:', error);
      return { ok: false, mensaje: SIN_CONEXION };
    }
  }, []);

  const darPaso = useCallback(async (paso: PasoConductor): Promise<Resultado> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    if (!viaje || enviando) return { ok: false, mensaje: 'Espera a que termine el paso anterior.' };
    setEnviando(paso);
    try {
      const r = await enviar(ENDPOINT_DEL_PASO[paso](viaje.id));
      if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
      if (!r.ok) {
        // 409: el viaje cambió en otro lado (por ejemplo, el pasajero canceló): se vuelve a leer.
        void cargar();
        return r;
      }
      if (paso === 'terminar') {
        fijar(null);
        alCerrarRef.current(null);
        return { ok: true, terminado: true };
      }
      fijar(trasPaso(viaje, paso, r.data, new Date().toISOString()));
      return { ok: true };
    } finally {
      if (scope.isCurrent()) setEnviando(null);
    }
  }, [viaje, enviando, enviar, cargar, fijar]);

  const cancelar = useCallback(async (motivo: MotivoCancelacion): Promise<Resultado> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    if (!viaje || enviando) return { ok: false, mensaje: 'Espera a que termine el paso anterior.' };
    setEnviando('cancelar');
    try {
      const r = await enviar(API_CONFIG.endpoints.rides.cancelar(viaje.id), { motivo });
      if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
      if (!r.ok) {
        void cargar();
        return r;
      }
      fijar(null);
      alCerrarRef.current(null);
      return { ok: true, terminado: true };
    } finally {
      if (scope.isCurrent()) setEnviando(null);
    }
  }, [viaje, enviando, enviar, cargar, fijar]);

  return { viaje, enviando, darPaso, cancelar, recargar: cargar };
};

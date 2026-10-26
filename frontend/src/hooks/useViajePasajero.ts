import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { calculateFare } from '../constants/sectors';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore } from '../store/useRideStore';
import { captureAccountScope } from '../utils/accountScope';
import { guardarRegistroCalificacion, leerRegistroCalificacion } from '../servicios/registroCalificacion';
import {
  alCalificar,
  alOfrecerCalificacion,
  estrellasValidas,
  leerSancion,
  sigueVigenteParaCalificar,
  tocaOfrecerCalificacion,
  type Sancion,
} from '../utils/viajePasajero';
import type { MotivoCancelacion } from '../utils/viajeConductor';
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

/**
 * Lecturas con el JWT del pasajero: RLS le deja ver su viaje, el conductor asignado y el chat.
 * `descartados` son los viajes que cerró en esta sesión: no vuelven a ofrecerse hasta reabrir la app.
 */
const crearLector = (descartados: Set<string>): LectorViaje => ({
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
    const [perfil, tricimoto, hilo, resumen] = await Promise.all([
      supabase.from('perfiles').select('nombre, telefono').eq('id', conductorId).maybeSingle(),
      supabase.from('tricimotos').select('placa').eq('conductor_id', conductorId).maybeSingle(),
      supabase.from('threads').select('id').eq('viaje_id', viajeId).maybeSingle(),
      supabase.rpc('resumen_conductor', { p_conductor: conductorId }),
    ]);
    // Sin el resumen (error o viaje ya cerrado) no se muestra nada; no se inventa «Nuevo».
    const fila = Array.isArray(resumen.data) ? resumen.data[0] : resumen.data;
    const resenas = !resumen.error && fila && Number.isFinite(Number(fila.total))
      ? { promedio: fila.promedio != null ? Number(fila.promedio) : null, total: Number(fila.total) }
      : undefined;
    return {
      driver: {
        id: conductorId,
        nombre: perfil.data?.nombre ?? null,
        telefono: perfil.data?.telefono ?? null,
        placa: tricimoto.data?.placa ?? null,
        ...(resenas ? { resenas } : {}),
      },
      threadId: hilo.data?.id ?? null,
    };
  },
  /** Criterio 15: el último viaje terminado por el conductor, si aún toca ofrecerlo. */
  async pendienteDeCerrar(pasajeroId) {
    const { data, error } = await supabase
      .from('viajes')
      .select(COLUMNAS_VIAJE)
      .eq('pasajero_id', pasajeroId)
      .eq('estado', 'finalizado')
      .eq('finalizado_por', 'conductor')
      .order('finalizado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const fila = data as FilaViaje | null;
    if (!fila || descartados.has(fila.id) || !sigueVigenteParaCalificar(fila.finalizado_en, Date.now())) return null;
    return tocaOfrecerCalificacion(await leerRegistroCalificacion(pasajeroId), fila.id) ? fila : null;
  },
});

type Resultado = { ok: true } | { ok: false; mensaje: string };
type ResultadoTerminar = { ok: true; sancion: Sancion | null } | { ok: false; mensaje: string };
const SESION_CAMBIO = 'Tu sesión cambió. Vuelve a abrir el viaje con tu cuenta.';
const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa tu conexión.';

/** POST al servidor: un paso solo se da por hecho si responde bien (criterio 20). */
const publicar = async (ruta: string, cuerpo?: object): Promise<{ ok: true; data: any } | { ok: false; mensaje: string }> => {
  try {
    const response = await authFetch(ruta, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, mensaje: body?.message ?? 'No se pudo completar el paso.' };
    return { ok: true, data: body?.data ?? null };
  } catch (error) {
    console.error('[Viaje] Error de red:', error);
    return { ok: false, mensaje: SIN_CONEXION };
  }
};

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
  const [descartados] = useState(() => new Set<string>());
  const [lector] = useState(() => crearLector(descartados));

  // ─── Avisos del servidor ───────────────────────────────────
  useEffect(() => {
    const recibir = (evento: EventoPasajero) => {
      const { activeRide: ride, setActiveRide } = useRideStore.getState();
      setActiveRide(buzon.recibir(ride, evento));
    };
    const quitarAceptado = onEvent('viaje_aceptado', (datos) => recibir({ tipo: 'viaje_aceptado', datos }));
    const quitarSinConductor = onEvent('viaje_sin_conductor', (datos) => recibir({ tipo: 'viaje_sin_conductor', datos }));
    // Llegó, empezó, terminó o canceló el conductor (paso 005, P7).
    const quitarEstado = onEvent('viaje_estado', (datos) => recibir({ tipo: 'viaje_estado', datos }));
    return () => {
      quitarAceptado();
      quitarSinConductor();
      quitarEstado();
    };
  }, [onEvent, buzon]);

  // ─── Lectura de la BD ──────────────────────────────────────
  const sincronizar = useCallback(async () => {
    if (!userId || sincronizando.current) return;
    sincronizando.current = true;
    const scope = captureAccountScope(useAuthStore.getState);
    if (scope.userId !== userId || !scope.isCurrent()) { sincronizando.current = false; return; }
    try {
      const local = useRideStore.getState().activeRide;
      const siguiente = await sincronizarViaje(lector, local, userId);
      // Si mientras tanto cambió el viaje local (otro aviso o una nueva solicitud), gana lo local.
      if (scope.isCurrent() && useRideStore.getState().activeRide === local) useRideStore.getState().setActiveRide(siguiente);
    } catch (error) {
      console.warn('[Viaje] No se pudo leer el estado del viaje:', error);
    } finally {
      sincronizando.current = false;
    }
  }, [userId, lector]);

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
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    const { setRequesting, setActiveRide, setUltimaSolicitud } = useRideStore.getState();
    setRequesting(true);
    try {
      const response = await authFetch(API_CONFIG.endpoints.rides.request, {
        method: 'POST',
        body: JSON.stringify(armarCuerpoSolicitud(solicitud)),
      });
      const body = await response.json().catch(() => null);
      if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
      if (!response.ok) {
        // 409: ya tiene un viaje activo (criterio 13); se muestra ese viaje.
        if (response.status === 409) void sincronizar();
        return { ok: false, mensaje: body?.message ?? 'No se pudo solicitar el viaje.' };
      }
      const viaje = body?.data;
      setUltimaSolicitud(solicitud);
      setActiveRide(buzon.aplicarGuardados({
        id: viaje?.id ?? '',
        serviceType: solicitud.tipoServicio ?? 'viaje',
        parcel: solicitud.encomienda ?? null,
        status: 'solicitado',
        originSectorId: viaje?.sector_origen_id ?? sectorDeOrigen(solicitud.origen) ?? '',
        originName: nombreOrigen(solicitud.origen, solicitud.origenNota),
        destinationSectorId: viaje?.sector_destino_id ?? '',
        destinationName: nombreDestino(solicitud.destino, solicitud.destinoNota),
        passengers: solicitud.pasajeros,
        price: solicitud.tipoServicio === 'encomienda' ? null : Number(viaje?.tarifa ?? calculateFare(solicitud.pasajeros)),
        destinationNote: solicitud.destinoNota.trim(),
        driver: null,
        chatThreadId: null,
        createdAt: viaje?.creado_en ?? new Date().toISOString(),
      }));
      return { ok: true };
    } catch (error) {
      console.error('[Viaje] Error al solicitar:', error);
      return { ok: false, mensaje: SIN_CONEXION };
    } finally {
      if (scope.isCurrent()) setRequesting(false);
    }
  }, [sincronizar, buzon]);

  /**
   * Cancela: mientras se busca conductor sin motivo (criterio 12 del 003) y con el viaje aceptado
   * con motivo (criterio 8 del 005). La BD decide si todavía se puede.
   */
  const cancelar = useCallback(async (motivo?: MotivoCancelacion): Promise<Resultado> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    const ride = useRideStore.getState().activeRide;
    if (!ride) return { ok: true };
    const r = await publicar(API_CONFIG.endpoints.rides.cancelar(ride.id), motivo ? { motivo } : undefined);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    if (!r.ok) {
      // Puede que justo se cerrara o aceptara: se muestra lo que diga la BD.
      void sincronizar();
      return { ok: false, mensaje: r.mensaje };
    }
    useRideStore.getState().clearRide();
    return { ok: true };
  }, [sincronizar]);

  /** El pasajero termina el viaje él mismo, con sanción (criterios 5b y 5c). */
  const terminarComoPasajero = useCallback(async (): Promise<ResultadoTerminar> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    const ride = useRideStore.getState().activeRide;
    if (!ride) return { ok: false, mensaje: 'No hay un viaje en curso.' };
    const r = await publicar(API_CONFIG.endpoints.rides.terminar(ride.id));
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    if (!r.ok) {
      void sincronizar();
      return r;
    }
    descartados.add(ride.id);
    useRideStore.getState().clearRide();
    return { ok: true, sancion: leerSancion(r.data) };
  }, [sincronizar, descartados]);

  /** «Llegué» o «No llegué» (criterio 5a). Con «No llegué» el viaje no se califica. */
  const confirmarLlegada = useCallback(async (llego: boolean): Promise<Resultado> => {
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    const ride = useRideStore.getState().activeRide;
    if (!ride || ride.status !== 'finalizado') return { ok: false, mensaje: 'Este viaje ya no espera tu confirmación.' };
    const r = await publicar(API_CONFIG.endpoints.rides.confirmar(ride.id), { llego });
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    if (!r.ok) {
      void sincronizar();
      return r;
    }
    if (llego && ride.cierre) {
      useRideStore.getState().updateRide({ cierre: { ...ride.cierre, confirmacion: 'llego' } });
    } else {
      descartados.add(ride.id);
      useRideStore.getState().clearRide();
    }
    return { ok: true };
  }, [sincronizar, descartados]);

  /** Estrellas y comentario opcional (criterios 15, 16 y 19). La BD rechaza la segunda calificación. */
  const calificar = useCallback(async (estrellas: number, comentario: string): Promise<Resultado> => {
    if (!estrellasValidas(estrellas)) return { ok: false, mensaje: 'Elige de 1 a 5 estrellas.' };
    const scope = captureAccountScope(useAuthStore.getState);
    if (!scope.isCurrent() || !userId) return { ok: false, mensaje: SESION_CAMBIO };
    const ride = useRideStore.getState().activeRide;
    if (!ride || ride.status !== 'finalizado') return { ok: false, mensaje: 'Este viaje ya no se puede calificar.' };
    const texto = comentario.trim();
    const r = await publicar(API_CONFIG.endpoints.rides.calificar(ride.id), { estrellas, ...(texto ? { comentario: texto } : {}) });
    if (!scope.isCurrent()) return { ok: false, mensaje: SESION_CAMBIO };
    if (!r.ok) return r;
    descartados.add(ride.id);
    void leerRegistroCalificacion(userId).then((registro) => guardarRegistroCalificacion(userId, alCalificar(registro, ride.id)));
    useRideStore.getState().clearRide();
    return { ok: true };
  }, [userId, descartados]);

  /** Se mostró la hoja de calificar: cuenta una de las dos veces que se ofrece (criterio 15). */
  const alMostrarCalificacion = useCallback(async (viajeId: string) => {
    if (!userId) return;
    const registro = await leerRegistroCalificacion(userId);
    await guardarRegistroCalificacion(userId, alOfrecerCalificacion(registro, viajeId));
  }, [userId]);

  /** «Ahora no»: cierra la hoja; no vuelve hasta que se reabra la app. */
  const cerrarSinResponder = useCallback(() => {
    const ride = useRideStore.getState().activeRide;
    if (ride) descartados.add(ride.id);
    useRideStore.getState().clearRide();
  }, [descartados]);

  /** "Volver a pedir" con un toque, con la misma solicitud (criterio 11). */
  const volverAPedir = useCallback(async (gps: Gps): Promise<Resultado> => {
    const ultima = useRideStore.getState().ultimaSolicitud;
    if (!ultima) return { ok: false, mensaje: 'No hay una solicitud anterior.' };
    return solicitar(refrescarOrigen(ultima, gps));
  }, [solicitar]);

  /** Cierra el aviso de "sin conductor" y vuelve a la ficha. */
  const descartar = useCallback(() => useRideStore.getState().clearRide(), []);

  return {
    solicitar,
    cancelar,
    terminarComoPasajero,
    confirmarLlegada,
    calificar,
    alMostrarCalificacion,
    cerrarSinResponder,
    volverAPedir,
    descartar,
  };
};

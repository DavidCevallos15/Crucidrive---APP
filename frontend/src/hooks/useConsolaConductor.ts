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
import { leerParametros, PARAMETROS_POR_DEFECTO, type ParametrosUbicacion } from '../utils/seguimiento';
import { ofertaDesdeFila, type FilaOferta } from '../utils/avisoOferta';
import { descartarAvisosDeOferta } from '../servicios/avisos';
import type { useSocket } from './useSocket';

type Resultado = { ok: true } | { ok: false; mensaje: string; consentimiento?: boolean };

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
  // Frecuencias de envío de la ubicación, del servidor (paso 004, P12).
  const [parametros, setParametros] = useState<ParametrosUbicacion>(PARAMETROS_POR_DEFECTO);
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
    const quitarRetirada = onEvent('oferta_retirada', ({ viajeId }) => {
      setOferta((actual) => alRetirarOferta(actual, viajeId));
      // Si también llegó como aviso, se quita de la barra (004, criterio 8).
      void descartarAvisosDeOferta(viajeId);
    });
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
      if (quedan === 0) {
        setOferta((actual) => alRetirarOferta(actual, oferta.viajeId));
        void descartarAvisosDeOferta(oferta.viajeId);
      }
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
        return {
          ok: false,
          mensaje: body?.message ?? 'No se pudo cambiar tu disponibilidad.',
          // 428: falta aceptar la versión vigente del aviso de privacidad (004, criterio 5).
          consentimiento: response.status === 428,
        };
      }
      setEstado((body?.data?.estado as EstadoTricimoto | undefined) ?? (disponible ? 'disponible' : 'inactivo'));
      if (body?.data?.ubicacion) setParametros(leerParametros(body.data.ubicacion));
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
      void descartarAvisosDeOferta(oferta.viajeId);
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

  /** Registra la versión vigente del aviso de privacidad (004, P18). La fija el servidor. */
  const aceptarConsentimiento = useCallback(async (): Promise<Resultado> => {
    try {
      const response = await authFetch(API_CONFIG.endpoints.auth.consent, {
        method: 'POST',
        body: JSON.stringify({ consentimiento: true }),
      });
      if (response.ok) return { ok: true };
      const body = await response.json().catch(() => null);
      return { ok: false, mensaje: body?.message ?? 'No se pudo registrar tu consentimiento.' };
    } catch (error) {
      console.error('[Consola] Error al registrar el consentimiento:', error);
      return { ok: false, mensaje: SIN_CONEXION };
    }
  }, []);

  /**
   * Oferta abierta desde un aviso (004, criterio 7): se lee de la BD (RLS: la propia) y solo se
   * muestra si sigue pendiente y vigente. Devuelve false para "Esta oferta ya no está disponible".
   */
  const abrirOfertaDeAviso = useCallback(async (viajeId: string): Promise<boolean> => {
    void descartarAvisosDeOferta(viajeId);
    if (!userId) return false;
    const { data, error } = await supabase
      .from('ofertas_viaje')
      .select('fase, vence_en, distancia_m, resultado, viaje:viajes(id, estado, pasajeros, tarifa, sector_origen_id, sector_destino_id, origen_descripcion, destino_descripcion)')
      .eq('viaje_id', viajeId)
      .eq('conductor_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[Consola] No se pudo leer la oferta del aviso:', error.message);
      return false;
    }
    const nueva = ofertaDesdeFila(data as unknown as FilaOferta | null, Date.now() + desfase.current);
    if (!nueva) return false;
    setOferta((actual) => alRecibirOferta(actual, nueva));
    return true;
  }, [userId]);

  /** Rechazar no tiene penalización (criterio 6). Sin conexión, la oferta vence sola. */
  const rechazar = useCallback(() => {
    if (!oferta) return;
    rechazarOferta(oferta.viajeId);
    void descartarAvisosDeOferta(oferta.viajeId);
    setOferta(null);
  }, [oferta, rechazarOferta]);

  return {
    estado, cambiando, oferta, segundos, aceptando, parametros,
    cambiarDisponibilidad, aceptar, rechazar, abrirOfertaDeAviso, aceptarConsentimiento,
  };
};

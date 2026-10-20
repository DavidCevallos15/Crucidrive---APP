import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore } from '../store/useRideStore';
import {
  agregarOferta,
  calcularDesfase,
  estadoTrasError,
  quitarOferta,
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
 * Desde el 010 (D-15) puede haber varias ofertas a la vez, en una lista.
 */
export const useConsolaConductor = (
  socket: Pick<ReturnType<typeof useSocket>, 'onEvent' | 'isConnected' | 'rechazarOferta'>
) => {
  const { onEvent, isConnected, rechazarOferta } = socket;
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [estado, setEstado] = useState<EstadoTricimoto | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [ofertas, setOfertas] = useState<OfertaViaje[]>([]);
  // Reloj de la pantalla para las cuentas regresivas de la lista (R14).
  const [ahora, setAhora] = useState(() => Date.now());
  // Viaje que se está aceptando: mientras tanto no se acepta otra (criterio 9 del 010).
  const [aceptando, setAceptando] = useState<string | null>(null);
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
    const quitarNueva = onEvent('oferta_viaje', (nueva) => setOfertas((lista) => agregarOferta(lista, nueva)));
    const quitarRetirada = onEvent('oferta_retirada', ({ viajeId }) => {
      setOfertas((lista) => quitarOferta(lista, viajeId));
      // Si también llegó como aviso, se quita de la barra (004, criterio 8).
      void descartarAvisosDeOferta(viajeId);
    });
    return () => {
      quitarHora();
      quitarNueva();
      quitarRetirada();
    };
  }, [onEvent]);

  // ─── Cuenta regresiva desde venceEn (R14) ─────────────────
  const hayOfertas = ofertas.length > 0;
  useEffect(() => {
    if (!hayOfertas) return;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [hayOfertas]);

  // Vencidas: se quitan aquí; el servidor también avisa con oferta_retirada.
  useEffect(() => {
    for (const o of ofertas) {
      if (segundosRestantes(o.venceEn, desfase.current, ahora) === 0) {
        setOfertas((lista) => quitarOferta(lista, o.viajeId));
        void descartarAvisosDeOferta(o.viajeId);
      }
    }
  }, [ahora, ofertas]);

  const segundosDe = useCallback(
    (o: OfertaViaje) => segundosRestantes(o.venceEn, desfase.current, ahora),
    [ahora]
  );

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
      // Al dejar de estar disponible, el servidor da por rechazadas las ofertas abiertas.
      if (!disponible) setOfertas([]);
      return { ok: true };
    } catch (error) {
      console.error('[Consola] Error al cambiar disponibilidad:', error);
      return { ok: false, mensaje: SIN_CONEXION };
    } finally {
      setCambiando(false);
    }
  }, []);

  const aceptar = useCallback(async (viajeId: string): Promise<Resultado> => {
    const oferta = ofertas.find((o) => o.viajeId === viajeId);
    if (!oferta || aceptando) return { ok: true };
    setAceptando(viajeId);
    try {
      const response = await authFetch(API_CONFIG.endpoints.rides.accept, {
        method: 'POST',
        body: JSON.stringify({ viajeId: oferta.viajeId }),
      });
      const body = await response.json().catch(() => null);
      // Solo la oferta aceptada: si otro ganó (409), las demás siguen en la lista.
      setOfertas((lista) => quitarOferta(lista, oferta.viajeId));
      void descartarAvisosDeOferta(oferta.viajeId);
      if (!response.ok) {
        // 409: ya fue tomado o la oferta venció (criterios 8 y 9).
        return { ok: false, mensaje: body?.message ?? 'No se pudo aceptar el viaje.' };
      }
      // El servidor liberó las demás (010, criterio 9) y además avisa con oferta_retirada.
      for (const otra of ofertas) if (otra.viajeId !== oferta.viajeId) void descartarAvisosDeOferta(otra.viajeId);
      setOfertas([]);
      setEstado('ocupado');
      // Para el chat del viaje; las pantallas del viaje en curso son del paso 005.
      useRideStore.getState().setActiveRide({
        id: oferta.viajeId,
        serviceType: oferta.tipoServicio ?? 'viaje',
        parcel: body?.data?.encomienda ?? null,
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
      setAceptando(null);
    }
  }, [ofertas, aceptando]);

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
      .select('fase, vence_en, distancia_m, resultado, viaje:viajes(id, estado, tipo_servicio, pasajeros, tarifa, sector_origen_id, sector_destino_id, origen_descripcion, destino_descripcion)')
      .eq('viaje_id', viajeId)
      .eq('conductor_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[Consola] No se pudo leer la oferta del aviso:', error.message);
      return false;
    }
    const nueva = ofertaDesdeFila(data as unknown as FilaOferta | null, Date.now() + desfase.current);
    if (!nueva) return false;
    setOfertas((lista) => agregarOferta(lista, nueva));
    return true;
  }, [userId]);

  /**
   * Rechazar no tiene penalización (criterio 6). Solo sale esa oferta (010, criterio 10).
   * Sin conexión, la oferta vence sola.
   */
  const rechazar = useCallback((viajeId: string) => {
    rechazarOferta(viajeId);
    void descartarAvisosDeOferta(viajeId);
    setOfertas((lista) => quitarOferta(lista, viajeId));
  }, [rechazarOferta]);

  return {
    estado, cambiando, ofertas, segundosDe, aceptando, parametros,
    cambiarDisponibilidad, aceptar, rechazar, abrirOfertaDeAviso, aceptarConsentimiento,
  };
};

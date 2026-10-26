import type { ActiveRide, DriverInfo, RideStatus } from '../store/useRideStore';
import { textoResenas } from './viajeConductor';

/**
 * Viaje en curso visto por el pasajero (paso 005, plan P10). Sin React, para poder probarlo.
 * Quién puede dar cada paso lo decide la BD (0017); aquí solo se elige qué mostrar.
 */

/** Si el pasajero no responde en este tiempo, la llegada se toma como confirmada (criterio 5a). */
export const MINUTOS_AUTOCONFIRMA = 30;

/** Un viaje terminado hace más de esto ya no se ofrece al abrir la app. */
export const DIAS_PARA_CALIFICAR = 3;

/** Cuántas veces se muestra la hoja de calificar: la primera y «una sola vez más» (criterio 15). */
export const OFERTAS_DE_CALIFICAR = 2;

const MS_MINUTO = 60_000;
const MS_DIA = 24 * 60 * MS_MINUTO;

const esEncomienda = (ride: Pick<ActiveRide, 'serviceType'>): boolean => ride.serviceType === 'encomienda';

/** Título de la hoja mientras el viaje está aceptado o en curso (criterios 3 y 4). */
export const tituloDelViaje = (ride: Pick<ActiveRide, 'status' | 'serviceType' | 'llegadoEn'>): string => {
  const paquete = esEncomienda(ride);
  if (ride.status === 'en_curso') return paquete ? 'Tu paquete va en camino' : 'Viaje en curso';
  if (ride.llegadoEn) return paquete ? 'El conductor llegó por tu paquete' : 'Tu tricimoto llegó';
  return paquete ? 'El conductor va por tu paquete' : 'Tu tricimoto va en camino';
};

/** Cancelar con motivo solo antes de empezar (criterios 8 y 9). */
export const puedeCancelarConMotivo = (status: RideStatus): boolean => status === 'aceptado';

/** El pasajero solo termina un viaje que ya está en curso, y con sanción (criterio 5b). */
export const puedeTerminarComoPasajero = (status: RideStatus): boolean => status === 'en_curso';

export const TEXTO_CANCELAR_PASAJERO = 'Avisaremos al conductor y el viaje se cierra. Podrás pedir otro cuando quieras.';

/** Advertencia antes de terminar el viaje tú mismo; los números exactos llegan después (5c). */
export const ADVERTENCIA_TERMINAR =
  'Lo normal es que el conductor lo termine al llegar. Si lo terminas tú, queda registrado, no podrás calificar ' +
  'y, si pasa varias veces, no podrás pedir viajes por un tiempo.';

export interface Sancion {
  llevas: number;
  max: number;
  ventanaDias: number;
  bloqueoHoras: number;
}

/** Lee la sanción de la respuesta de `POST /terminar`; null si no trae forma válida. */
export const leerSancion = (data: unknown): Sancion | null => {
  const s = (data as { sancion?: Record<string, unknown> } | null)?.sancion;
  if (!s) return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
  const [llevas, max, ventanaDias, bloqueoHoras] = [n(s.llevas), n(s.max), n(s.ventanaDias), n(s.bloqueoHoras)];
  if (llevas === null || max === null || max < 1 || ventanaDias === null || bloqueoHoras === null) return null;
  return { llevas, max, ventanaDias, bloqueoHoras };
};

/** Aviso al terminar tú mismo: cuántas llevas y cuántas faltan para el bloqueo (criterio 5c). */
export const textoSancion = (s: Sancion): string => {
  const faltan = Math.max(0, s.max - s.llevas);
  const horas = `${s.bloqueoHoras} ${s.bloqueoHoras === 1 ? 'hora' : 'horas'}`;
  if (faltan === 0) return `Llevas ${s.llevas} de ${s.max} en ${s.ventanaDias} días. Por ahora no podrás pedir viajes durante ${horas}.`;
  return `Llevas ${s.llevas} de ${s.max} viajes terminados por ti en ${s.ventanaDias} días. `
    + `${faltan === 1 ? 'Te falta 1 para' : `Te faltan ${faltan} para`} no poder pedir durante ${horas}.`;
};

// ─── Viaje terminado por el conductor ────────────────────────

/** Qué pide la hoja final: confirmar la llegada, calificar, o nada (criterios 5a y 15). */
export type FaseCierre = 'confirmar' | 'calificar' | 'nada';

/**
 * Sin respuesta tras 30 minutos la llegada cuenta como confirmada; «No llegué» no se califica
 * ni reabre el viaje.
 */
export const faseDelCierre = (ride: Pick<ActiveRide, 'status' | 'cierre'>, ahora: number): FaseCierre => {
  if (ride.status !== 'finalizado' || !ride.cierre) return 'nada';
  const { confirmacion, finalizadoEn } = ride.cierre;
  if (confirmacion === 'no_llego') return 'nada';
  if (confirmacion === 'llego') return 'calificar';
  const desde = Date.parse(finalizadoEn);
  const vencida = Number.isFinite(desde) && ahora - desde >= MINUTOS_AUTOCONFIRMA * MS_MINUTO;
  return vencida ? 'calificar' : 'confirmar';
};

/** Cuándo se cumplen los 30 minutos (ms); null si la hora no es válida. */
export const venceLaAutoconfirmacion = (finalizadoEn: string): number | null => {
  const desde = Date.parse(finalizadoEn);
  return Number.isFinite(desde) ? desde + MINUTOS_AUTOCONFIRMA * MS_MINUTO : null;
};

export const textoConfirmar = (encomienda: boolean) => ({
  titulo: encomienda ? 'Tu paquete fue entregado' : 'Tu viaje terminó',
  pregunta: encomienda ? '¿Se entregó el paquete?' : '¿Llegaste a tu destino?',
  si: encomienda ? 'Se entregó' : 'Llegué',
  no: encomienda ? 'No se entregó' : 'No llegué',
});

/** Total en efectivo, o el acuerdo con el conductor en una encomienda (criterio 5). */
export const textoResumenCobro = (ride: Pick<ActiveRide, 'serviceType' | 'price'>): string => {
  if (esEncomienda(ride)) return 'Precio acordado con el conductor';
  return ride.price == null ? 'Total en efectivo' : `$${ride.price.toFixed(2)} en efectivo`;
};

/** «★ 4,8 · 23 reseñas» o «Nuevo»; vacío si el servidor no mandó el dato (criterio 18). */
export const textoResenasDelConductor = (driver: Pick<DriverInfo, 'resenas'> | null | undefined): string =>
  driver?.resenas ? textoResenas(driver.resenas.promedio, driver.resenas.total) : '';

/** Solo estrellas enteras de 1 a 5. */
export const estrellasValidas = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 5;

/** Mismo límite que el CHECK de `calificaciones.comentario` (0017). */
export const MAX_COMENTARIO = 280;

// ─── Calificar una vez, con un recordatorio más (criterio 15) ─

/** Lo que el teléfono recuerda del último viaje que se ofreció calificar. */
export interface RegistroCalificacion {
  viajeId: string;
  /** Cuántas veces se mostró la hoja. */
  ofrecida: number;
  hecha: boolean;
}

/** Si toca mostrar la hoja de este viaje: no está hecha y no se mostró ya las veces que corresponde. */
export const tocaOfrecerCalificacion = (registro: RegistroCalificacion | null, viajeId: string): boolean => {
  if (!registro || registro.viajeId !== viajeId) return true;
  return !registro.hecha && registro.ofrecida < OFERTAS_DE_CALIFICAR;
};

/** Se mostró la hoja una vez más. */
export const alOfrecerCalificacion = (registro: RegistroCalificacion | null, viajeId: string): RegistroCalificacion => ({
  viajeId,
  ofrecida: registro && registro.viajeId === viajeId ? registro.ofrecida + 1 : 1,
  hecha: registro && registro.viajeId === viajeId ? registro.hecha : false,
});

export const alCalificar = (registro: RegistroCalificacion | null, viajeId: string): RegistroCalificacion => ({
  viajeId,
  ofrecida: registro && registro.viajeId === viajeId ? Math.max(1, registro.ofrecida) : 1,
  hecha: true,
});

/** Un viaje terminado hace más de tres días ya no se ofrece al abrir la app. */
export const sigueVigenteParaCalificar = (finalizadoEn: string | null | undefined, ahora: number): boolean => {
  const t = finalizadoEn ? Date.parse(finalizadoEn) : NaN;
  return Number.isFinite(t) && ahora - t <= DIAS_PARA_CALIFICAR * MS_DIA;
};

/** Lee el registro guardado; lo que no tenga forma se descarta. */
export const leerRegistro = (texto: string | null): RegistroCalificacion | null => {
  if (!texto) return null;
  try {
    const r = JSON.parse(texto) as Partial<RegistroCalificacion>;
    if (typeof r.viajeId !== 'string' || !Number.isInteger(r.ofrecida) || typeof r.hecha !== 'boolean') return null;
    return { viajeId: r.viajeId, ofrecida: r.ofrecida as number, hecha: r.hecha };
  } catch {
    return null;
  }
};

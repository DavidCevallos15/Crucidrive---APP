import { COLORS } from '../constants/theme';
import type { Punto } from './geo';
import type { PuntoOferta } from './oferta';

/**
 * Viaje aceptado del conductor (paso 005, plan P9). Sin React, para poder probarlo.
 * Quién puede dar cada paso lo decide la BD (0017); aquí solo se elige qué botón mostrar.
 */

export type EstadoViajeConductor = 'aceptado' | 'en_curso';
export type PasoConductor = 'llegada' | 'iniciar' | 'terminar';
export type Rol = 'pasajero' | 'conductor';

/** Motivos del CHECK de `viajes.motivo_cancelacion` (0017, criterio 8). */
export type MotivoCancelacion = 'ya_no_lo_necesito' | 'tarda_demasiado' | 'no_encuentro_al_pasajero' | 'otro';

export interface ViajeConductor {
  id: string;
  estado: EstadoViajeConductor;
  encomienda: boolean;
  /** Cuándo marcó «Llegué»; null si aún no. */
  llegadoEn: string | null;
  origen: PuntoOferta;
  destino: PuntoOferta;
  pasajeros: number;
  tarifa: number | null;
  pasajero: { nombre: string | null; telefono: string | null };
  /** Contenido y destinatario de la encomienda (criterio 6 del 009). */
  paquete: { descripcion: string; destinatario: string } | null;
  threadId: string | null;
  /** Punto de recogida; solo lo da `punto_recogida` mientras el viaje sigue abierto. */
  recogida: Punto | null;
}

/** Fila de `viajes` que lee el conductor (RLS: los suyos). */
export interface FilaViajeConductor {
  id: string;
  estado: string;
  tipo_servicio: 'viaje' | 'encomienda' | null;
  pasajero_id: string;
  pasajeros: number;
  tarifa: number | string | null;
  sector_origen_id: string | null;
  sector_destino_id: string | null;
  origen_descripcion: string | null;
  destino_descripcion: string | null;
  llegado_en: string | null;
}

export const COLUMNAS_VIAJE_CONDUCTOR =
  'id, estado, tipo_servicio, pasajero_id, pasajeros, tarifa, sector_origen_id, sector_destino_id, origen_descripcion, destino_descripcion, llegado_en';

export const esEstadoAbierto = (estado: string | null | undefined): estado is EstadoViajeConductor =>
  estado === 'aceptado' || estado === 'en_curso';

/** Arma el viaje desde la fila y los datos que se leen aparte. Null si ya no está abierto. */
export const viajeDesdeFila = (
  fila: FilaViajeConductor | null,
  extra: Pick<ViajeConductor, 'pasajero' | 'paquete' | 'threadId' | 'recogida'>
): ViajeConductor | null => {
  if (!fila || !esEstadoAbierto(fila.estado)) return null;
  const encomienda = fila.tipo_servicio === 'encomienda';
  return {
    id: fila.id,
    estado: fila.estado,
    encomienda,
    llegadoEn: fila.llegado_en,
    origen: { sectorId: fila.sector_origen_id, descripcion: fila.origen_descripcion },
    destino: { sectorId: fila.sector_destino_id, descripcion: fila.destino_descripcion },
    pasajeros: fila.pasajeros,
    tarifa: encomienda || fila.tarifa == null ? null : Number(fila.tarifa),
    ...extra,
    paquete: encomienda ? extra.paquete : null,
  };
};

/**
 * El botón grande según el estado (criterios 3 a 5): «Llegué» → «Empezar viaje» (o «Paquete
 * recogido») → «Llegamos» (o «Paquete entregado»).
 */
export const siguientePaso = (viaje: Pick<ViajeConductor, 'estado' | 'llegadoEn' | 'encomienda'>): { paso: PasoConductor; texto: string } => {
  if (viaje.estado === 'en_curso') return { paso: 'terminar', texto: viaje.encomienda ? 'Paquete entregado' : 'Llegamos' };
  if (!viaje.llegadoEn) return { paso: 'llegada', texto: 'Llegué' };
  return { paso: 'iniciar', texto: viaje.encomienda ? 'Paquete recogido' : 'Empezar viaje' };
};

/** Pregunta antes de pasos que no se deshacen (iniciar y terminar). «Llegué» va directo. */
export const confirmacionDelPaso = (paso: PasoConductor, encomienda: boolean): string | null => {
  if (paso === 'iniciar') return encomienda ? '¿Ya tienes el paquete?' : '¿El pasajero ya subió?';
  if (paso === 'terminar') return encomienda ? '¿Entregaste el paquete?' : '¿Llegaron al destino?';
  return null;
};

/** Cancelar solo mientras está aceptado; en curso solo se termina (criterios 8 y 9). */
export const puedeCancelar = (estado: EstadoViajeConductor): boolean => estado === 'aceptado';

/** «Cómo llegar»: la app de mapas del teléfono, sin clave ni costo (criterio 2). */
export const enlaceComoLlegar = (p: Punto): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

export const TEXTO_MOTIVO: Record<MotivoCancelacion, string> = {
  ya_no_lo_necesito: 'Ya no lo necesito',
  tarda_demasiado: 'Tarda demasiado',
  no_encuentro_al_pasajero: 'No encuentro al pasajero',
  otro: 'Otro',
};

/** Los motivos que tienen sentido para cada uno; «Otro» siempre (criterio 8). */
export const motivosPara = (rol: Rol): MotivoCancelacion[] =>
  rol === 'conductor'
    ? ['no_encuentro_al_pasajero', 'otro']
    : ['ya_no_lo_necesito', 'tarda_demasiado', 'otro'];

/** «★ 4,8 · 23 reseñas», «★ 5,0 · 1 reseña» o «Nuevo» (criterios 17 y 18). */
export const textoResenas = (promedio: number | null | undefined, total: number | null | undefined): string => {
  if (!total || promedio == null || !Number.isFinite(promedio)) return 'Nuevo';
  return `★ ${promedio.toFixed(1).replace('.', ',')} · ${total} ${total === 1 ? 'reseña' : 'reseñas'}`;
};

/** El aviso de socket `viaje_estado` (backend: despachador.avisarViaje). */
export interface EventoViajeEstado {
  viajeId: string;
  cambio: 'llegada' | 'en_curso' | 'finalizado' | 'finalizado_por_pasajero' | 'cancelado_por_pasajero' | 'cancelado_por_conductor';
  encomienda?: boolean;
}

/** Lo que el conductor ve cuando el pasajero cierra el viaje desde su lado. */
export const avisoParaConductor = (ev: EventoViajeEstado): { titulo: string; texto: string } | null => {
  if (ev.cambio === 'cancelado_por_pasajero') {
    return { titulo: 'El pasajero canceló', texto: 'Ya puedes recibir otras solicitudes.' };
  }
  if (ev.cambio === 'finalizado_por_pasajero') {
    return { titulo: 'El pasajero terminó el viaje', texto: 'Ya puedes recibir otras solicitudes.' };
  }
  return null;
};

/** Lecturas con el JWT del conductor; en las pruebas se reemplazan. */
export interface LectorViajeConductor {
  viajeAbierto: (conductorId: string) => Promise<FilaViajeConductor | null>;
  pasajero: (pasajeroId: string) => Promise<ViajeConductor['pasajero']>;
  hilo: (viajeId: string) => Promise<string | null>;
  paquete: (viajeId: string) => Promise<ViajeConductor['paquete']>;
  recogida: (viajeId: string) => Promise<Punto | null>;
}

/**
 * El viaje abierto del conductor con todo lo que muestra la tarjeta (criterio 1). Si falla la
 * lectura del viaje, lanza: quien llama conserva lo que ya tenía. Los datos de apoyo
 * (pasajero, chat, paquete, recogida) pueden faltar sin impedir los botones.
 */
export const leerViajeConductor = async (lector: LectorViajeConductor, conductorId: string): Promise<ViajeConductor | null> => {
  const fila = await lector.viajeAbierto(conductorId);
  if (!fila || !esEstadoAbierto(fila.estado)) return null;
  const opcional = <T,>(p: Promise<T>, defecto: T) => p.catch(() => defecto);
  const [pasajero, threadId, paquete, recogida] = await Promise.all([
    opcional(lector.pasajero(fila.pasajero_id), { nombre: null, telefono: null }),
    opcional(lector.hilo(fila.id), null),
    fila.tipo_servicio === 'encomienda' ? opcional(lector.paquete(fila.id), null) : Promise.resolve(null),
    opcional(lector.recogida(fila.id), null),
  ]);
  return viajeDesdeFila(fila, { pasajero, threadId, paquete, recogida });
};

/**
 * Cómo queda el viaje tras un paso que el servidor aceptó. `data` es el viaje que devuelve;
 * si el servidor no pudo leerlo después (responde solo el id), se deduce del paso.
 */
export const trasPaso = (
  viaje: ViajeConductor,
  paso: Exclude<PasoConductor, 'terminar'>,
  data: { estado?: string; llegado_en?: string | null } | null,
  ahoraIso: string
): ViajeConductor => {
  const leido = data?.estado;
  const estado = esEstadoAbierto(leido) ? leido : paso === 'iniciar' ? 'en_curso' : viaje.estado;
  const llegadoEn = data && 'llegado_en' in data ? data.llegado_en ?? null : paso === 'llegada' ? ahoraIso : viaje.llegadoEn;
  return { ...viaje, estado, llegadoEn };
};

export interface Resena {
  estrellas: number;
  comentario: string | null;
  /** Solo la fecha (AAAA-MM-DD), sin hora ni autor (criterio 17). */
  fecha: string;
}

export interface ResenasConductor {
  promedio: number | null;
  total: number;
  resenas: Resena[];
}

/** Lee la respuesta de `GET /api/conductores/resenas`, descartando lo que no tenga forma. */
export const leerResenas = (data: unknown): ResenasConductor => {
  const d = (data ?? {}) as { promedio?: unknown; total?: unknown; resenas?: unknown };
  const lista = Array.isArray(d.resenas) ? d.resenas : [];
  return {
    promedio: typeof d.promedio === 'number' && Number.isFinite(d.promedio) ? d.promedio : null,
    total: typeof d.total === 'number' && d.total > 0 ? Math.floor(d.total) : 0,
    resenas: lista
      .filter((r): r is Resena => Boolean(r) && Number.isInteger((r as Resena).estrellas) && typeof (r as Resena).fecha === 'string')
      .map((r) => ({ estrellas: r.estrellas, comentario: typeof r.comentario === 'string' && r.comentario.trim() ? r.comentario : null, fecha: r.fecha })),
  };
};

/** «20 oct 2026» a partir de «2026-10-20», sin depender de la zona horaria del teléfono. */
export const textoFecha = (fecha: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return '';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const mes = meses[Number(m[2]) - 1];
  return mes ? `${Number(m[3])} ${mes} ${m[1]}` : '';
};

/** Estrellas y promedio de «Tus reseñas» sobre la tarjeta blanca del 011 (la crema no se ve). */
export const COLORES_RESENAS = {
  estrellas: COLORS.primary,
  promedio: COLORS.primary,
} as const;

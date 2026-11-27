/**
 * Créditos del conductor (020, D-22). Lógica pura para las pantallas del conductor y del
 * administrador. El servidor y la BD son la fuente de verdad: aquí solo se formatea y se valida
 * antes de enviar, con las mismas reglas que backend/src/controllers/creditosController.js.
 */

export type TipoMovimiento = 'bono' | 'recarga' | 'comision' | 'reintegro' | 'ajuste';
export type CanalRecarga = 'deuna' | 'transferencia' | 'deposito' | 'efectivo' | 'cortesia';
export type TipoAcreditacion = 'recarga' | 'ajuste';

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  monto: number | string;
  canal: CanalRecarga | null;
  comprobante: string | null;
  motivo: string | null;
  viaje_id: string | null;
  creado_en: string;
}

export interface EstadoCreditos {
  saldo: number;
  minimo: number;
  cobroActivo: boolean;
  comisionViaje: number;
  comisionEncomienda: number;
  movimientos: Movimiento[];
}

export interface ParametrosCobro {
  cobro_activo: boolean;
  comision_viaje: number;
  comision_encomienda: number;
  bono_bienvenida: number;
  recarga_min: number;
  recarga_max: number;
}

export interface FilaResumen {
  mes: string;
  tipo: TipoMovimiento;
  canal: CanalRecarga | null;
  total: number;
  cantidad: number;
}

export const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  bono: 'Bono de bienvenida',
  recarga: 'Recarga',
  comision: 'Comisión',
  reintegro: 'Devolución',
  ajuste: 'Ajuste',
};

export const ETIQUETA_CANAL: Record<CanalRecarga, string> = {
  deuna: 'DeUna',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  efectivo: 'Efectivo',
  cortesia: 'Cortesía',
};

export const CANALES: CanalRecarga[] = ['deuna', 'transferencia', 'deposito', 'efectivo', 'cortesia'];
export const CANALES_CON_COMPROBANTE: CanalRecarga[] = ['deuna', 'transferencia', 'deposito'];
export const SOPORTE_CORREO = 'soporte@tricimoto.app';

/**
 * Cómo recargar. Sin enlaces de pago, QR ni datos bancarios dentro de la app (020, criterio 7):
 * los datos de pago se dan por soporte o en persona.
 */
export const COMO_RECARGAR =
  `Para recargar, escribe a ${SOPORTE_CORREO} o habla con la administración de CruciDrive. ` +
  'Cuando confirmemos tu pago, el saldo aparece aquí.';

const COMPROBANTE_RE = /^[A-Za-z0-9-]{3,40}$/;
const MOTIVO_MAX = 200;

const aNumero = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** «$1.80», «-$0.20» o «+$2.00» (con `conSigno`). */
export const formatearMonto = (v: unknown, conSigno = false): string => {
  const n = aNumero(v);
  const base = `$${Math.abs(n).toFixed(2)}`;
  if (n < 0) return `-${base}`;
  return conSigno && n > 0 ? `+${base}` : base;
};

/** Monto escrito por una persona: admite coma decimal («1,50»). null si no es válido. */
export const leerMonto = (texto: string): number | null => {
  const limpio = texto.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

/** Fecha corta en hora de Ecuador: «27 nov 2026, 07:35». */
export const fechaCorta = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-EC', {
    timeZone: 'America/Guayaquil', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** Descripción de una fila del historial: «Recarga · DeUna · DU-123». */
export const detalleMovimiento = (m: Movimiento): string =>
  [ETIQUETA_TIPO[m.tipo] ?? m.tipo, m.canal ? ETIQUETA_CANAL[m.canal] : null, m.comprobante, m.motivo]
    .filter(Boolean)
    .join(' · ');

/** Con el cobro activo y el saldo bajo el mínimo, el conductor no recibe ofertas. */
export const necesitaRecarga = (e: Pick<EstadoCreditos, 'saldo' | 'minimo' | 'cobroActivo'>): boolean =>
  e.cobroActivo && e.saldo < e.minimo;

/** Normaliza la respuesta de GET /api/conductores/creditos. */
export const leerEstadoCreditos = (data: unknown): EstadoCreditos => {
  const d = (data ?? {}) as Partial<EstadoCreditos>;
  return {
    saldo: aNumero(d.saldo),
    minimo: aNumero(d.minimo),
    cobroActivo: Boolean(d.cobroActivo),
    comisionViaje: aNumero(d.comisionViaje),
    comisionEncomienda: aNumero(d.comisionEncomienda),
    movimientos: Array.isArray(d.movimientos) ? d.movimientos : [],
  };
};

export interface FormAcreditacion {
  tipo: TipoAcreditacion;
  monto: string;
  canal: CanalRecarga | null;
  comprobante: string;
  motivo: string;
}

export interface CuerpoAcreditacion {
  tipo: TipoAcreditacion;
  monto: number;
  canal: CanalRecarga | null;
  comprobante: string | null;
  motivo: string | null;
}

/**
 * Valida el formulario del administrador con las mismas reglas que el servidor. Devuelve el
 * cuerpo listo para POST /api/admin/conductores/:id/creditos o el mensaje para mostrar.
 */
export const validarAcreditacion = (f: FormAcreditacion): { error: string } | { cuerpo: CuerpoAcreditacion } => {
  const monto = leerMonto(f.monto);
  const comprobante = f.comprobante.trim() || null;
  const motivo = f.motivo.trim().replace(/\s+/g, ' ') || null;
  if (monto === null || monto === 0) return { error: 'Escribe un monto distinto de 0, con 2 decimales como máximo.' };
  if (motivo !== null && (motivo.length < 3 || motivo.length > MOTIVO_MAX)) {
    return { error: `El motivo debe tener entre 3 y ${MOTIVO_MAX} caracteres.` };
  }
  if (comprobante !== null && !COMPROBANTE_RE.test(comprobante)) {
    return { error: 'El comprobante solo puede tener letras, números y guiones (3 a 40).' };
  }
  if (f.tipo === 'ajuste') {
    if (motivo === null) return { error: 'Un ajuste necesita un motivo.' };
    return { cuerpo: { tipo: 'ajuste', monto, canal: null, comprobante: null, motivo } };
  }
  if (monto < 0) return { error: 'Una recarga debe ser positiva. Para descontar, usa un ajuste.' };
  if (!f.canal) return { error: 'Elige el canal del pago.' };
  if (CANALES_CON_COMPROBANTE.includes(f.canal) && comprobante === null) {
    return { error: 'Escribe el número de comprobante del pago.' };
  }
  if (!CANALES_CON_COMPROBANTE.includes(f.canal) && motivo === null) {
    return { error: 'Sin comprobante, escribe un motivo (por ejemplo, «Pagó en persona»).' };
  }
  return { cuerpo: { tipo: 'recarga', monto, canal: f.canal, comprobante, motivo } };
};

export interface ResumenMes {
  mes: string;
  recargas: number;
  comisiones: number;
  devoluciones: number;
  bonos: number;
  ajustes: number;
  porCanal: Partial<Record<CanalRecarga, number>>;
}

/** Agrupa las filas del resumen por mes (criterio 10). Comisiones en positivo: lo cobrado. */
export const resumirPorMes = (filas: FilaResumen[]): ResumenMes[] => {
  const meses = new Map<string, ResumenMes>();
  for (const f of filas) {
    const mes = f.mes.slice(0, 7);
    const r = meses.get(mes) ?? { mes, recargas: 0, comisiones: 0, devoluciones: 0, bonos: 0, ajustes: 0, porCanal: {} };
    const total = aNumero(f.total);
    if (f.tipo === 'recarga') {
      r.recargas += total;
      if (f.canal) r.porCanal[f.canal] = (r.porCanal[f.canal] ?? 0) + total;
    } else if (f.tipo === 'comision') r.comisiones += -total;
    else if (f.tipo === 'reintegro') r.devoluciones += total;
    else if (f.tipo === 'bono') r.bonos += total;
    else r.ajustes += total;
    meses.set(mes, r);
  }
  return [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes));
};

/** Comisión neta del mes: lo cobrado menos lo devuelto. */
export const ingresoNeto = (r: ResumenMes): number => Math.round((r.comisiones - r.devoluciones) * 100) / 100;

/** «2026-11» → «noviembre 2026». */
export const nombreMes = (mes: string): string => {
  const d = new Date(`${mes}-15T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? mes : d.toLocaleDateString('es-EC', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

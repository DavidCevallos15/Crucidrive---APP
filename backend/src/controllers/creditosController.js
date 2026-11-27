// @ts-check
/**
 * Créditos prepagos del conductor (020, D-22). Todo pasa con el JWT del usuario (`req.supabase`):
 * la BD (0020) decide saldos, comisiones y permisos; aquí solo se valida la entrada y se traducen
 * los errores. Ninguna ruta usa la clave de servicio.
 */
const asyncHandler = require('../utils/asyncHandler');
const { errorResponse, successResponse } = require('../utils/response');
const {
  isUuid, isMontoValido, isFechaIso, isComprobanteValido,
  CANALES_RECARGA, CANALES_CON_COMPROBANTE, TIPOS_ACREDITACION, MOTIVO_CREDITO_MAX,
} = require('../utils/validation');

/**
 * @typedef {import('express').Request & { user: { id: string, rol?: string }, supabase: any }} Req
 * @typedef {import('express').Response} Res
 */

const MAX_MOVIMIENTOS = 50;
const MONTO_PARAMETRO_MAX = 999.99;
const CAMPOS_MOVIMIENTO = 'id, tipo, monto, canal, comprobante, motivo, viaje_id, creado_en';
const CAMPOS_PARAMETROS = 'cobro_activo, comision_viaje, comision_encomienda, bono_bienvenida, recarga_min, recarga_max, actualizado_en';

/** @param {unknown} v */
const aNumero = (v) => (v == null ? 0 : Number(v));

/**
 * Saldo, saldo mínimo y si el cobro está activo, leídos con el JWT del usuario.
 * @param {any} db
 * @param {string} conductorId
 */
const leerEstadoCredito = async (db, conductorId) => {
  const [saldo, parametros] = await Promise.all([
    db.from('saldos_credito').select('saldo').eq('conductor_id', conductorId).maybeSingle(),
    db.from('parametros_cobro').select(CAMPOS_PARAMETROS).maybeSingle(),
  ]);
  const error = saldo.error || parametros.error;
  if (error) return { error };
  const p = parametros.data || {};
  return {
    estado: {
      saldo: aNumero(saldo.data?.saldo),
      minimo: Math.max(aNumero(p.comision_viaje), aNumero(p.comision_encomienda)),
      cobroActivo: Boolean(p.cobro_activo),
      comisionViaje: aNumero(p.comision_viaje),
      comisionEncomienda: aNumero(p.comision_encomienda),
    },
  };
};

/**
 * Respuesta 402 cuando la BD rechaza por `saldo_insuficiente` (al aceptar o al ponerse
 * disponible). Lleva el saldo para que la app abra la pantalla de créditos.
 * @param {import('express').Response} res
 * @param {any} db
 * @param {string} conductorId
 * @param {string} [detalle] mensaje interno para el log
 */
const responderSaldoInsuficiente = async (res, db, conductorId, detalle) => {
  const { estado } = await leerEstadoCredito(db, conductorId);
  if (detalle) console.error(`[API 402] saldo insuficiente: ${detalle}`);
  const saldo = estado ? estado.saldo.toFixed(2) : null;
  const minimo = estado ? estado.minimo.toFixed(2) : null;
  return res.status(402).json({
    status: 'error',
    codigo: 'saldo_insuficiente',
    message: saldo && minimo
      ? `Tu saldo es ${saldo} USD y necesitas al menos ${minimo} USD. Escribe a soporte para recargar.`
      : 'Tu saldo de créditos no alcanza. Escribe a soporte para recargar.',
    data: estado ? { saldo: estado.saldo, minimo: estado.minimo } : null,
  });
};

/** @param {{ message?: string } | null | undefined} error */
const esSaldoInsuficiente = (error) => String(error?.message ?? '').includes('saldo_insuficiente');

/** GET /api/conductor/creditos: saldo, reglas y últimos movimientos propios (criterio 7). */
const misCreditos = asyncHandler(async (/** @type {Req} */ req, /** @type {Res} */ res) => {
  const db = req.supabase;
  const conductorId = req.user.id;
  const [{ estado, error }, movimientos] = await Promise.all([
    leerEstadoCredito(db, conductorId),
    db.from('movimientos_credito').select(CAMPOS_MOVIMIENTO)
      .eq('conductor_id', conductorId)
      .order('creado_en', { ascending: false })
      .limit(MAX_MOVIMIENTOS),
  ]);
  if (error || movimientos.error) {
    return errorResponse(res, 500, 'No se pudo consultar tus créditos.', (error || movimientos.error).message);
  }
  return successResponse(res, { ...estado, movimientos: movimientos.data || [] });
});

/** GET /api/admin/creditos/parametros */
const verParametros = asyncHandler(async (/** @type {Req} */ req, /** @type {Res} */ res) => {
  const { data, error } = await req.supabase.from('parametros_cobro').select(CAMPOS_PARAMETROS).maybeSingle();
  if (error) return errorResponse(res, 500, 'No se pudo consultar los parámetros de cobro.', error.message);
  return successResponse(res, data);
});

const CAMPOS_MONTO = ['comision_viaje', 'comision_encomienda', 'bono_bienvenida', 'recarga_min', 'recarga_max'];

/**
 * PATCH /api/admin/creditos/parametros. Solo los campos enviados; la BD vuelve a validar
 * rangos y que el mínimo de recarga no supere el máximo.
 */
const cambiarParametros = asyncHandler(async (/** @type {Req} */ req, /** @type {Res} */ res) => {
  const body = req.body || {};
  /** @type {Record<string, number | boolean>} */
  const cambios = {};
  if ('cobro_activo' in body) {
    if (typeof body.cobro_activo !== 'boolean') return errorResponse(res, 400, '"cobro_activo" debe ser true o false.');
    cambios.cobro_activo = body.cobro_activo;
  }
  for (const campo of CAMPOS_MONTO) {
    if (!(campo in body)) continue;
    const v = body[campo];
    const minimo = campo.startsWith('recarga') ? 0.01 : 0;
    if (!isMontoValido(v) || v < minimo || v > MONTO_PARAMETRO_MAX) {
      return errorResponse(res, 400, `"${campo}" debe ser un monto entre ${minimo} y ${MONTO_PARAMETRO_MAX} con 2 decimales como máximo.`);
    }
    cambios[campo] = v;
  }
  if (Object.keys(cambios).length === 0) return errorResponse(res, 400, 'No enviaste ningún cambio.');

  const { data, error } = await req.supabase.from('parametros_cobro')
    .update(cambios).eq('id', true).select(CAMPOS_PARAMETROS).maybeSingle();
  if (error) return errorResponse(res, 400, 'No se pudo guardar los parámetros (revisa que el mínimo de recarga no supere el máximo).', error.message);
  if (!data) return errorResponse(res, 403, 'No tienes permiso para cambiar los parámetros.');
  return successResponse(res, data, data.cobro_activo ? 'Parámetros guardados. El cobro está activo.' : 'Parámetros guardados. El cobro está apagado.');
});

// Errores de acreditar_credito (0020) → respuesta para el administrador.
/** @type {Record<string, [number, string]>} */
const ERRORES_ACREDITAR = {
  comprobante_repetido: [409, 'Ese comprobante ya se acreditó en ese canal.'],
  saldo_insuficiente: [409, 'El ajuste dejaría el saldo del conductor en negativo.'],
  conductor_no_existe: [404, 'No existe un conductor con ese identificador.'],
  monto_fuera_de_rango: [400, 'El monto está fuera del rango permitido.'],
  solo_admin: [403, 'Solo un administrador puede acreditar créditos.'],
  datos_de_recarga_invalidos: [400, 'Revisa el canal, el comprobante y el motivo.'],
  canal_solo_en_recarga: [400, 'Un ajuste no lleva canal.'],
  tipo_invalido: [400, 'El tipo debe ser "recarga" o "ajuste".'],
};

/**
 * Valida el cuerpo de una acreditación. Devuelve el mensaje de error o los datos listos.
 * @param {any} body
 * @returns {{ error: string } | { datos: { tipo: string, monto: number, canal: string | null, comprobante: string | null, motivo: string | null } }}
 */
const validarAcreditacion = (body) => {
  const tipo = body?.tipo;
  const monto = body?.monto;
  const canal = body?.canal ?? null;
  const comprobante = typeof body?.comprobante === 'string' && body.comprobante.trim() !== '' ? body.comprobante.trim() : null;
  const motivo = typeof body?.motivo === 'string' && body.motivo.trim() !== '' ? body.motivo.trim().replace(/\s+/g, ' ') : null;

  if (!TIPOS_ACREDITACION.includes(tipo)) return { error: 'El tipo debe ser "recarga" o "ajuste".' };
  if (!isMontoValido(monto) || monto === 0) return { error: 'El monto debe ser un número distinto de 0 con 2 decimales como máximo.' };
  if (motivo !== null && (motivo.length < 3 || motivo.length > MOTIVO_CREDITO_MAX)) {
    return { error: `El motivo debe tener entre 3 y ${MOTIVO_CREDITO_MAX} caracteres.` };
  }
  if (comprobante !== null && !isComprobanteValido(comprobante)) {
    return { error: 'El comprobante solo puede tener letras, números y guiones (3 a 40).' };
  }
  if (tipo === 'ajuste') {
    if (canal !== null) return { error: 'Un ajuste no lleva canal.' };
    if (comprobante !== null) return { error: 'Un ajuste no lleva comprobante.' };
    if (motivo === null) return { error: 'Un ajuste necesita un motivo.' };
  } else {
    if (monto < 0) return { error: 'Una recarga debe ser positiva.' };
    if (!CANALES_RECARGA.includes(canal)) return { error: `El canal debe ser uno de: ${CANALES_RECARGA.join(', ')}.` };
    if (CANALES_CON_COMPROBANTE.includes(canal) && comprobante === null) {
      return { error: 'Indica el número de comprobante del pago.' };
    }
    if (!CANALES_CON_COMPROBANTE.includes(canal) && motivo === null) {
      return { error: 'Sin comprobante, indica un motivo (por ejemplo, «Pagó en persona»).' };
    }
  }
  return { datos: { tipo, monto, canal, comprobante, motivo } };
};

/** POST /api/admin/conductores/:id/creditos: recarga o ajuste (criterio 6). */
const acreditar = asyncHandler(async (/** @type {Req} */ req, /** @type {Res} */ res) => {
  const { id } = req.params;
  if (!isUuid(id)) return errorResponse(res, 400, 'El identificador del conductor no es válido.');
  const validacion = validarAcreditacion(req.body);
  if ('error' in validacion) return errorResponse(res, 400, validacion.error);
  const { tipo, monto, canal, comprobante, motivo } = validacion.datos;

  const { data: movimientoId, error } = await req.supabase.rpc('acreditar_credito', {
    p_conductor: id, p_tipo: tipo, p_monto: monto, p_canal: canal, p_comprobante: comprobante, p_motivo: motivo,
  });
  if (error) {
    const clave = Object.keys(ERRORES_ACREDITAR).find((k) => String(error.message).includes(k));
    const [status, mensaje] = clave ? ERRORES_ACREDITAR[clave] : [500, 'No se pudo acreditar.'];
    return errorResponse(res, status, mensaje, error.message);
  }

  const { data: saldo } = await req.supabase.from('saldos_credito').select('saldo').eq('conductor_id', id).maybeSingle();
  return successResponse(res, { movimientoId, saldo: aNumero(saldo?.saldo) },
    tipo === 'recarga' ? 'Recarga acreditada.' : 'Ajuste registrado.', 201);
});

/** GET /api/admin/conductores/:id/creditos: saldo e historial de un conductor. */
const creditosDeConductor = asyncHandler(async (/** @type {Req} */ req, /** @type {Res} */ res) => {
  const { id } = req.params;
  if (!isUuid(id)) return errorResponse(res, 400, 'El identificador del conductor no es válido.');
  const db = req.supabase;
  const [saldo, movimientos] = await Promise.all([
    db.from('saldos_credito').select('saldo').eq('conductor_id', id).maybeSingle(),
    db.from('movimientos_credito').select(`${CAMPOS_MOVIMIENTO}, registrado_por`)
      .eq('conductor_id', id).order('creado_en', { ascending: false }).limit(MAX_MOVIMIENTOS),
  ]);
  const error = saldo.error || movimientos.error;
  if (error) return errorResponse(res, 500, 'No se pudo consultar los créditos del conductor.', error.message);
  return successResponse(res, { saldo: aNumero(saldo.data?.saldo), movimientos: movimientos.data || [] });
});

/**
 * GET /api/admin/creditos/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD (criterio 10).
 * Por defecto, del 1 de enero del año en curso a hoy (hora de Ecuador).
 */
const resumen = asyncHandler(async (/** @type {Req} */ req, /** @type {Res} */ res) => {
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const desde = req.query.desde ?? `${hoy.slice(0, 4)}-01-01`;
  const hasta = req.query.hasta ?? hoy;
  if (typeof desde !== 'string' || typeof hasta !== 'string' || !isFechaIso(desde) || !isFechaIso(hasta) || desde > hasta) {
    return errorResponse(res, 400, 'Las fechas deben tener el formato AAAA-MM-DD y "desde" no puede ser posterior a "hasta".');
  }
  const { data, error } = await req.supabase.rpc('resumen_creditos', { p_desde: desde, p_hasta: hasta });
  if (error) return errorResponse(res, 500, 'No se pudo consultar el resumen.', error.message);
  const filas = (data || []).map((/** @type {any} */ f) => ({ ...f, total: aNumero(f.total), cantidad: aNumero(f.cantidad) }));
  return successResponse(res, { desde, hasta, filas });
});

module.exports = {
  misCreditos, verParametros, cambiarParametros, acreditar, creditosDeConductor, resumen,
  responderSaldoInsuficiente, esSaldoInsuficiente, validarAcreditacion, leerEstadoCredito,
};

/**
 * Paso 020 · PR B (T8 a T10): créditos del conductor en la API.
 * Las reglas (saldo, comisión, devolución, permisos) viven en la BD y se prueban en
 * supabase/tests/rls_009.sql. Aquí: validación de entrada, traducción de errores, respuestas 402
 * y que nada interno llegue al cliente. `req.supabase` es una BD falsa que registra cada consulta.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-de-prueba';

jest.mock('../src/despacho', () => ({ obtenerDespachador: () => null }));

const creditos = require('../src/controllers/creditosController');
const { aceptarViaje } = require('../src/controllers/viajeController');
const { cambiarDisponibilidad } = require('../src/controllers/conductorController');
const { CONSENT_VERSION } = require('../src/config/consent');

const CONDUCTOR = '22222222-2222-4222-8222-222222222222';
const VIAJE = '0a1b2c3d-0000-4000-8000-000000000001';

/**
 * BD falsa: `from(tabla)` y `rpc(nombre)` devuelven lo que diga `responder(tabla, ops)`, donde
 * `ops` es la lista de llamadas encadenadas ([['select', '...'], ['eq', 'x', 1], ...]).
 */
const crearDb = (responder) => {
  const llamadas = [];
  const consulta = (tabla) => {
    const ops = [];
    const resolver = () => Promise.resolve(responder(tabla, ops));
    const q = new Proxy({}, {
      get: (_, metodo) => {
        if (metodo === 'then') return (ok, mal) => resolver().then(ok, mal);
        if (metodo === 'maybeSingle' || metodo === 'single') return () => { ops.push([metodo]); return resolver(); };
        return (...args) => { ops.push([metodo, ...args]); return q; };
      },
    });
    llamadas.push({ tabla, ops });
    return q;
  };
  return {
    llamadas,
    from: (tabla) => consulta(tabla),
    rpc: (nombre, args) => { llamadas.push({ rpc: nombre, args }); return Promise.resolve(responder(`rpc:${nombre}`, args)); },
  };
};

const PARAMETROS = {
  cobro_activo: true, comision_viaje: 0.1, comision_encomienda: 0.2, bono_bienvenida: 2,
  recarga_min: 1, recarga_max: 50, actualizado_en: '2026-11-27T12:00:00Z',
};

const crearRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};
const cuerpo = (res) => res.json.mock.calls[0][0];

let errorLog;
beforeEach(() => { errorLog = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => errorLog.mockRestore());

describe('T8 · GET /api/conductor/creditos (criterio 7)', () => {
  test('devuelve saldo, mínimo, si el cobro está activo y los movimientos propios', async () => {
    const db = crearDb((tabla) => {
      if (tabla === 'saldos_credito') return { data: { saldo: '1.80' }, error: null };
      if (tabla === 'parametros_cobro') return { data: PARAMETROS, error: null };
      return { data: [{ id: 'm1', tipo: 'comision', monto: -0.2 }], error: null };
    });
    const res = crearRes();
    await creditos.misCreditos({ supabase: db, user: { id: CONDUCTOR } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(cuerpo(res).data).toMatchObject({
      saldo: 1.8, minimo: 0.2, cobroActivo: true, comisionViaje: 0.1, comisionEncomienda: 0.2,
      movimientos: [{ id: 'm1', tipo: 'comision', monto: -0.2 }],
    });
    const libro = db.llamadas.find((l) => l.tabla === 'movimientos_credito');
    expect(libro.ops).toContainEqual(['eq', 'conductor_id', CONDUCTOR]);
    expect(libro.ops).toContainEqual(['limit', 50]);
  });

  test('sin movimientos todavía: saldo 0, no null', async () => {
    const db = crearDb((tabla) => (tabla === 'parametros_cobro' ? { data: PARAMETROS, error: null } : { data: null, error: null }));
    const res = crearRes();
    await creditos.misCreditos({ supabase: db, user: { id: CONDUCTOR } }, res);
    expect(cuerpo(res).data).toMatchObject({ saldo: 0, movimientos: [] });
  });

  test('un error de la BD responde 500 sin detalles internos', async () => {
    const db = crearDb(() => ({ data: null, error: { message: 'relation "x" secreto' } }));
    const res = crearRes();
    await creditos.misCreditos({ supabase: db, user: { id: CONDUCTOR } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(cuerpo(res))).not.toContain('secreto');
  });
});

describe('T9 · validación de recargas y ajustes (criterio 6)', () => {
  test.each([
    [{ tipo: 'bono', monto: 2 }, 'tipo'],
    [{ tipo: 'recarga', monto: 2.005, canal: 'deuna', comprobante: 'DU-1' }, 'monto'],
    [{ tipo: 'recarga', monto: 0, canal: 'deuna', comprobante: 'DU-1' }, 'monto'],
    [{ tipo: 'recarga', monto: '5', canal: 'deuna', comprobante: 'DU-1' }, 'monto'],
    [{ tipo: 'recarga', monto: -5, canal: 'deuna', comprobante: 'DU-1' }, 'positiva'],
    [{ tipo: 'recarga', monto: 5, canal: 'paypal', comprobante: 'DU-1' }, 'canal'],
    [{ tipo: 'recarga', monto: 5, canal: 'deuna' }, 'comprobante'],
    [{ tipo: 'recarga', monto: 5, canal: 'transferencia', comprobante: 'x; drop' }, 'comprobante'],
    [{ tipo: 'recarga', monto: 5, canal: 'efectivo' }, 'motivo'],
    [{ tipo: 'ajuste', monto: -1 }, 'motivo'],
    [{ tipo: 'ajuste', monto: 1, canal: 'deuna', motivo: 'Corrección' }, 'canal'],
    [{ tipo: 'ajuste', monto: 1, comprobante: 'DU-1', motivo: 'Corrección' }, 'comprobante'],
    [{ tipo: 'ajuste', monto: 1, motivo: 'no' }, 'motivo'],
  ])('%j se rechaza (%s)', (body, palabra) => {
    const r = creditos.validarAcreditacion(body);
    expect(r).toHaveProperty('error');
    expect(r.error.toLowerCase()).toContain(palabra);
  });

  test.each([
    [{ tipo: 'recarga', monto: 5, canal: 'deuna', comprobante: ' DU-123 ' }, { comprobante: 'DU-123', motivo: null }],
    [{ tipo: 'recarga', monto: 1.1, canal: 'transferencia', comprobante: 'TR-9' }, { monto: 1.1 }],
    [{ tipo: 'recarga', monto: 2, canal: 'efectivo', motivo: '  Pagó   en persona ' }, { motivo: 'Pagó en persona', comprobante: null }],
    [{ tipo: 'recarga', monto: 3, canal: 'cortesia', motivo: 'Cortesía de lanzamiento' }, { canal: 'cortesia' }],
    [{ tipo: 'ajuste', monto: -0.5, motivo: 'Falla técnica del 27 nov' }, { canal: null }],
  ])('%j es válido', (body, esperado) => {
    const r = creditos.validarAcreditacion(body);
    expect(r).toHaveProperty('datos');
    expect(r.datos).toMatchObject(esperado);
  });
});

describe('T9 · POST /api/admin/conductores/:id/creditos', () => {
  const acreditar = async (rpcRespuesta, body = { tipo: 'recarga', monto: 5, canal: 'deuna', comprobante: 'DU-123' }, id = CONDUCTOR) => {
    const db = crearDb((tabla) => (tabla === 'rpc:acreditar_credito' ? rpcRespuesta : { data: { saldo: 7 }, error: null }));
    const res = crearRes();
    await creditos.acreditar({ supabase: db, params: { id }, body, user: { id: 'admin' } }, res);
    return { db, res };
  };

  test('acredita con el JWT del admin y devuelve 201 con el saldo nuevo', async () => {
    const { db, res } = await acreditar({ data: 'mov-1', error: null });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(cuerpo(res).data).toEqual({ movimientoId: 'mov-1', saldo: 7 });
    expect(db.llamadas[0]).toEqual({
      rpc: 'acreditar_credito',
      args: { p_conductor: CONDUCTOR, p_tipo: 'recarga', p_monto: 5, p_canal: 'deuna', p_comprobante: 'DU-123', p_motivo: null },
    });
  });

  test('identificador inválido: 400 sin llamar a la BD', async () => {
    const { db, res } = await acreditar({ data: 'x', error: null }, undefined, 'no-es-uuid');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.llamadas).toHaveLength(0);
  });

  test.each([
    ['comprobante_repetido', 409],
    ['saldo_insuficiente', 409],
    ['conductor_no_existe', 404],
    ['solo_admin', 403],
    ['monto_fuera_de_rango', 400],
    ['datos_de_recarga_invalidos', 400],
  ])('el error %s de la BD responde %i', async (codigo, status) => {
    const { res } = await acreditar({ data: null, error: { message: codigo } });
    expect(res.status).toHaveBeenCalledWith(status);
  });

  test('un error desconocido responde 500 genérico y el detalle va solo al log', async () => {
    const { res } = await acreditar({ data: null, error: { message: 'deadlock en tabla interna' } });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(cuerpo(res))).not.toContain('deadlock');
    expect(errorLog).toHaveBeenCalled();
  });
});

describe('T9 · parámetros de cobro', () => {
  const cambiar = async (body, respuesta = { data: { ...PARAMETROS, ...body }, error: null }) => {
    const db = crearDb(() => respuesta);
    const res = crearRes();
    await creditos.cambiarParametros({ supabase: db, body }, res);
    return { db, res };
  };

  test('activa el cobro y solo envía los campos recibidos', async () => {
    const { db, res } = await cambiar({ cobro_activo: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(cuerpo(res).message).toContain('activo');
    expect(db.llamadas[0].ops[0]).toEqual(['update', { cobro_activo: true }]);
  });

  test.each([
    [{}],
    [{ cobro_activo: 'si' }],
    [{ comision_viaje: -0.1 }],
    [{ comision_encomienda: 0.255 }],
    [{ recarga_min: 0 }],
    [{ recarga_max: 1000 }],
  ])('%j se rechaza con 400', async (body) => {
    const { db, res } = await cambiar(body);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.llamadas).toHaveLength(0);
  });

  test('si la RLS no deja actualizar (no admin), 403', async () => {
    const { res } = await cambiar({ comision_viaje: 0.15 }, { data: null, error: null });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('el check de la BD (mínimo > máximo) responde 400 sin detalles', async () => {
    const { res } = await cambiar({ recarga_min: 60 }, { data: null, error: { message: 'violates check constraint "recarga_rango"' } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(JSON.stringify(cuerpo(res))).not.toContain('recarga_rango');
  });
});

describe('T9 · historial y resumen (criterio 10)', () => {
  test('historial de un conductor: saldo y movimientos', async () => {
    const db = crearDb((tabla) => (tabla === 'saldos_credito' ? { data: { saldo: '3.50' }, error: null } : { data: [{ id: 'm' }], error: null }));
    const res = crearRes();
    await creditos.creditosDeConductor({ supabase: db, params: { id: CONDUCTOR } }, res);
    expect(cuerpo(res).data).toEqual({ saldo: 3.5, movimientos: [{ id: 'm' }] });
  });

  test('resumen con fechas válidas convierte los totales a número', async () => {
    const db = crearDb(() => ({ data: [{ mes: '2026-11-01', tipo: 'recarga', canal: 'deuna', total: '15.00', cantidad: '3' }], error: null }));
    const res = crearRes();
    await creditos.resumen({ supabase: db, query: { desde: '2026-11-01', hasta: '2026-11-30' } }, res);
    expect(db.llamadas[0]).toEqual({ rpc: 'resumen_creditos', args: { p_desde: '2026-11-01', p_hasta: '2026-11-30' } });
    expect(cuerpo(res).data.filas[0]).toMatchObject({ total: 15, cantidad: 3 });
  });

  test('sin fechas usa del 1 de enero a hoy', async () => {
    const db = crearDb(() => ({ data: [], error: null }));
    const res = crearRes();
    await creditos.resumen({ supabase: db, query: {} }, res);
    expect(db.llamadas[0].args.p_desde).toMatch(/^\d{4}-01-01$/);
    expect(db.llamadas[0].args.p_hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test.each([
    [{ desde: '2026-13-01', hasta: '2026-12-31' }],
    [{ desde: '2026-02-30', hasta: '2026-12-31' }],
    [{ desde: '2026-12-01', hasta: '2026-11-01' }],
    [{ desde: ['2026-01-01'], hasta: '2026-12-31' }],
  ])('fechas inválidas %j: 400', async (query) => {
    const db = crearDb(() => ({ data: [], error: null }));
    const res = crearRes();
    await creditos.resumen({ supabase: db, query }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.llamadas).toHaveLength(0);
  });
});

describe('T10 · saldo insuficiente responde 402 (criterios 2 y 3)', () => {
  const dbConSaldo = (extra) => crearDb((tabla, ops) => {
    if (tabla === 'saldos_credito') return { data: { saldo: 0.1 }, error: null };
    if (tabla === 'parametros_cobro') return { data: PARAMETROS, error: null };
    return extra(tabla, ops);
  });

  test('aceptar sin saldo para la comisión: 402 con saldo y mínimo, sin el error interno', async () => {
    const db = dbConSaldo((tabla) => (tabla === 'rpc:aceptar_viaje'
      ? { data: null, error: { message: 'saldo_insuficiente (registrar_movimiento line 18)' } }
      : { data: null, error: null }));
    const res = crearRes();
    await aceptarViaje({ supabase: db, body: { viajeId: VIAJE }, user: { id: CONDUCTOR } }, res);
    expect(res.status).toHaveBeenCalledWith(402);
    const b = cuerpo(res);
    expect(b).toMatchObject({ status: 'error', codigo: 'saldo_insuficiente', data: { saldo: 0.1, minimo: 0.2 } });
    expect(b.message).toContain('0.10');
    expect(b.message).toContain('0.20');
    expect(JSON.stringify(b)).not.toContain('registrar_movimiento');
  });

  test('los demás errores de aceptar siguen igual (409 si ya lo tomaron)', async () => {
    const db = dbConSaldo(() => ({ data: null, error: { message: 'viaje_no_disponible' } }));
    const res = crearRes();
    await aceptarViaje({ supabase: db, body: { viajeId: VIAJE }, user: { id: CONDUCTOR } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('ponerse disponible sin saldo: 402', async () => {
    const db = dbConSaldo((tabla, ops) => {
      if (tabla === 'tricimotos' && ops.some(([m]) => m === 'update')) {
        return { data: null, error: { message: 'saldo_insuficiente' } };
      }
      if (tabla === 'tricimotos') return { data: { estado: 'inactivo' }, error: null };
      if (tabla === 'consentimientos') return { data: { version: CONSENT_VERSION }, error: null };
      return { data: [], error: null };
    });
    const res = crearRes();
    await cambiarDisponibilidad({ supabase: db, body: { disponible: true }, user: { id: CONDUCTOR } }, res);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(cuerpo(res).codigo).toBe('saldo_insuficiente');
  });

  test('si ni siquiera se puede leer el saldo, el 402 lleva un mensaje genérico', async () => {
    const db = crearDb(() => ({ data: null, error: { message: 'caída' } }));
    const res = crearRes();
    await creditos.responderSaldoInsuficiente(res, db, CONDUCTOR, 'saldo_insuficiente');
    expect(res.status).toHaveBeenCalledWith(402);
    expect(cuerpo(res)).toMatchObject({ codigo: 'saldo_insuficiente', data: null });
  });
});

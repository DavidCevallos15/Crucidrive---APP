// Spec 020 · PR C (T11 a T13): créditos del conductor en la app y textos legales.
import * as fs from 'fs';
import * as path from 'path';
import {
  COMO_RECARGAR,
  SOPORTE_CORREO,
  detalleMovimiento,
  formatearMonto,
  ingresoNeto,
  leerEstadoCreditos,
  leerMonto,
  necesitaRecarga,
  nombreMes,
  resumirPorMes,
  validarAcreditacion,
  type FormAcreditacion,
  type Movimiento,
} from '../src/utils/creditos';
import { CONSENTIMIENTO, CONSENT_VERSION } from '../src/constants/consentimiento';
import { API_CONFIG } from '../src/constants/config';

const frontendRoot = path.join(__dirname, '..');
const repoRoot = path.join(frontendRoot, '..');
const leer = (rel: string) => fs.readFileSync(path.join(frontendRoot, rel), 'utf8');
const leerRepo = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('020 · formato y lectura de montos', () => {
  test.each([
    [1.8, false, '$1.80'],
    [-0.2, false, '-$0.20'],
    [2, true, '+$2.00'],
    ['0.10', true, '+$0.10'],
    [0, true, '$0.00'],
    [null, false, '$0.00'],
  ])('formatearMonto(%p, %p) = %s', (v, signo, esperado) => {
    expect(formatearMonto(v, signo)).toBe(esperado);
  });

  test.each([
    ['5', 5], ['1,50', 1.5], [' 0.25 ', 0.25], ['-0,20', -0.2],
    ['1.005', null], ['abc', null], ['', null], ['5.', null], ['1e2', null],
  ])('leerMonto(%p) = %p', (texto, esperado) => {
    expect(leerMonto(texto)).toBe(esperado);
  });

  test('la respuesta del servidor se normaliza a números', () => {
    const e = leerEstadoCreditos({ saldo: '1.80', minimo: '0.20', cobroActivo: true, comisionViaje: 0.1, comisionEncomienda: 0.2 });
    expect(e).toEqual({ saldo: 1.8, minimo: 0.2, cobroActivo: true, comisionViaje: 0.1, comisionEncomienda: 0.2, movimientos: [] });
    expect(leerEstadoCreditos(null).saldo).toBe(0);
  });

  test('criterio 2: solo con el cobro activo y bajo el mínimo hace falta recargar', () => {
    expect(necesitaRecarga({ saldo: 0.1, minimo: 0.2, cobroActivo: true })).toBe(true);
    expect(necesitaRecarga({ saldo: 0.2, minimo: 0.2, cobroActivo: true })).toBe(false);
    expect(necesitaRecarga({ saldo: 0, minimo: 0.2, cobroActivo: false })).toBe(false);
  });

  test('el historial describe tipo, canal, comprobante y motivo', () => {
    const m: Movimiento = {
      id: '1', tipo: 'recarga', monto: 5, canal: 'deuna', comprobante: 'DU-123', motivo: null, viaje_id: null, creado_en: '2026-11-27T12:00:00Z',
    };
    expect(detalleMovimiento(m)).toBe('Recarga · DeUna · DU-123');
    expect(detalleMovimiento({ ...m, tipo: 'reintegro', canal: null, comprobante: null, motivo: 'El pasajero canceló antes de iniciar' }))
      .toBe('Devolución · El pasajero canceló antes de iniciar');
  });
});

describe('020 · validación del formulario del administrador (criterio 6)', () => {
  const base: FormAcreditacion = { tipo: 'recarga', monto: '5', canal: 'deuna', comprobante: 'DU-123', motivo: '' };

  test('recarga DeUna con comprobante: cuerpo listo para el servidor', () => {
    expect(validarAcreditacion(base)).toEqual({
      cuerpo: { tipo: 'recarga', monto: 5, canal: 'deuna', comprobante: 'DU-123', motivo: null },
    });
  });

  test.each<[Partial<FormAcreditacion>, string]>([
    [{ monto: '0' }, 'monto'],
    [{ monto: '2,005' }, 'monto'],
    [{ monto: '-5' }, 'positiva'],
    [{ canal: null }, 'canal'],
    [{ comprobante: '' }, 'comprobante'],
    [{ comprobante: 'x; drop' }, 'comprobante'],
    [{ canal: 'efectivo', comprobante: '' }, 'motivo'],
    [{ tipo: 'ajuste', monto: '-0,20', canal: null, comprobante: '', motivo: '' }, 'motivo'],
    [{ motivo: 'no' }, 'motivo'],
  ])('%j se rechaza (%s)', (cambios, palabra) => {
    const r = validarAcreditacion({ ...base, ...cambios });
    expect('error' in r && r.error.toLowerCase()).toContain(palabra);
  });

  test('efectivo con motivo y ajuste negativo con motivo son válidos', () => {
    expect(validarAcreditacion({ ...base, canal: 'efectivo', comprobante: '', motivo: ' Pagó   en persona ' }))
      .toEqual({ cuerpo: { tipo: 'recarga', monto: 5, canal: 'efectivo', comprobante: null, motivo: 'Pagó en persona' } });
    expect(validarAcreditacion({ tipo: 'ajuste', monto: '-0,20', canal: 'deuna', comprobante: 'X-1', motivo: 'Falla técnica' }))
      .toEqual({ cuerpo: { tipo: 'ajuste', monto: -0.2, canal: null, comprobante: null, motivo: 'Falla técnica' } });
  });
});

describe('020 · resumen mensual (criterio 10)', () => {
  test('agrupa por mes, separa canales y calcula el ingreso neto', () => {
    const meses = resumirPorMes([
      { mes: '2026-11-01', tipo: 'recarga', canal: 'deuna', total: 10, cantidad: 2 },
      { mes: '2026-11-01', tipo: 'recarga', canal: 'efectivo', total: 3, cantidad: 1 },
      { mes: '2026-11-01', tipo: 'comision', canal: null, total: -1.5, cantidad: 10 },
      { mes: '2026-11-01', tipo: 'reintegro', canal: null, total: 0.3, cantidad: 2 },
      { mes: '2026-11-01', tipo: 'bono', canal: null, total: 4, cantidad: 2 },
      { mes: '2026-10-01', tipo: 'ajuste', canal: null, total: -1, cantidad: 1 },
    ]);
    expect(meses.map((m) => m.mes)).toEqual(['2026-11', '2026-10']);
    expect(meses[0]).toMatchObject({ recargas: 13, comisiones: 1.5, devoluciones: 0.3, bonos: 4, porCanal: { deuna: 10, efectivo: 3 } });
    expect(ingresoNeto(meses[0])).toBe(1.2);
    expect(meses[1].ajustes).toBe(-1);
    expect(nombreMes('2026-11')).toMatch(/noviembre/i);
  });
});

describe('020 · pantallas (criterios 2, 6, 7 y 10)', () => {
  const pantalla = leer('src/screens/CreditosConductorScreen.tsx');

  test('criterio 7: el conductor ve saldo, movimientos y cómo recargar, sin enlaces de pago', () => {
    expect(API_CONFIG.endpoints.driver.creditos).toBe('/api/conductores/creditos');
    expect(pantalla).toContain('API_CONFIG.endpoints.driver.creditos');
    expect(pantalla).toContain('COMO_RECARGAR');
    // Solo el código: los comentarios pueden decir «sin QR».
    const codigo = pantalla.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/https?:\/\//);
    expect(codigo).not.toMatch(/\bQR\b|cuenta (corriente|de ahorros)|n[uú]mero de cuenta/i);
    expect(COMO_RECARGAR).toContain(SOPORTE_CORREO);
    expect(COMO_RECARGAR).not.toMatch(/deuna|banco|cuenta|https?:/i);
  });

  test('la pestaña «Créditos» existe para el conductor', () => {
    expect(leer('app/(app)/(driver)/_layout.tsx')).toContain("name: 'creditos'");
    expect(leer('app/(app)/(driver)/creditos.tsx')).toContain('CreditosConductorScreen');
  });

  test('criterio 2: un 402 se marca como sin saldo y la consola lleva a «Mis créditos»', () => {
    const hook = leer('src/hooks/useConsolaConductor.ts');
    expect(hook.match(/sinSaldo: response\.status === 402/g)).toHaveLength(2);
    const consola = leer('src/screens/DriverConsoleScreen.tsx');
    expect(consola).toContain("router.push('/(app)/(driver)/creditos'");
    expect(consola.match(/sinSaldo\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  test('criterios 6 y 10: el panel acredita desde la ficha y tiene la pantalla de cobro', () => {
    expect(leer('src/screens/AdminDriverDetailScreen.tsx')).toContain("detalle.estado === 'aprobado' && <CreditosConductorAdmin");
    expect(leer('src/components/CreditosConductorAdmin.tsx')).toContain('validarAcreditacion(form)');
    const cobro = leer('src/screens/AdminCreditsScreen.tsx');
    expect(cobro).toContain('API_CONFIG.endpoints.admin.parametrosCobro');
    expect(cobro).toContain('resumirPorMes');
    expect(leer('src/screens/AdminDriversScreen.tsx')).toContain("'/(app)/(admin)/creditos'");
  });

  test('regla 6: sin blur en las pantallas nuevas', () => {
    for (const f of ['src/screens/CreditosConductorScreen.tsx', 'src/screens/AdminCreditsScreen.tsx', 'src/components/CreditosConductorAdmin.tsx']) {
      expect(leer(f)).not.toMatch(/BlurView|BlurContainer/);
    }
  });
});

describe('020 · aviso de privacidad 1.1 y documentos públicos (T13)', () => {
  test('el aviso sube a 1.1 y nombra los movimientos de créditos y la huella de la cédula', () => {
    expect(CONSENT_VERSION).toBe('1.1');
    const texto = CONSENTIMIENTO.map((s) => s.texto).join(' ');
    expect(texto).toContain('movimientos de créditos');
    expect(texto).toContain('huella');
    expect(leerRepo('backend/src/config/consent.js')).toContain("const CONSENT_VERSION = '1.1'");
    expect(leerRepo('specs/002-identidad/consentimiento-lopdp.md')).toContain('(v1.1)');
  });

  test('Privacidad, Reembolsos y Términos sin Google Play Billing y con recargas manuales', () => {
    const privacidad = leerRepo('web/privacidad.html');
    const reembolsos = leerRepo('web/reembolsos.html');
    const terminos = leerRepo('web/terminos.html');
    expect(privacidad).toContain('Versión 1.1');
    expect(privacidad).toContain('Movimientos de créditos');
    expect(privacidad).toContain('Huella (hash) de la cédula');
    for (const doc of [privacidad, reembolsos, terminos]) expect(doc).not.toMatch(/Google Play Billing|In-App Purchase/);
    expect(reembolsos).toMatch(/DeUna, transferencia, depósito o en efectivo/);
    expect(reembolsos).toContain('número de comprobante');
    expect(terminos).toContain('0,20 USD por encomienda');
  });
});

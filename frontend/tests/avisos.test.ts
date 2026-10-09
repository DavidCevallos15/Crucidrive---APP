import { crearRegistroAvisos, TOKEN_EXPO } from '../src/servicios/registroAvisos';
import type { ApiDispositivos } from '../src/servicios/registroAvisos';
import {
  debeEnviar,
  debeSeguir,
  decidirPermiso,
  leerParametros,
  PARAMETROS_POR_DEFECTO,
  DISTANCIA_MINIMA_M,
} from '../src/utils/seguimiento';
import { distanciaMetros } from '../src/utils/geo';
import { crearCanalUbicacion, type SocketUbicacion } from '../src/servicios/canalUbicacion';
import { PERMISO_UBICACION, AVISO_SEGUIMIENTO } from '../src/constants/permisoUbicacion';

/**
 * Paso 004 · avisos y ubicación en la app. T9: registro y borrado del token (criterio 11).
 * T10: ubicación en segundo plano (criterios 2, 4, 5 y 19; P11 y P13).
 */

const TOKEN = 'ExponentPushToken[telefonoDePrueba01]';

const montar = ({
  token = TOKEN as string | null,
  registrarOk = true,
  olvidarOk = true,
}: { token?: string | null; registrarOk?: boolean; olvidarOk?: boolean } = {}) => {
  const llamadas: string[] = [];
  const avisos: string[] = [];
  const api: ApiDispositivos = {
    registrar: jest.fn(async (t: string) => { llamadas.push(`registrar ${t}`); return registrarOk; }),
    olvidar: jest.fn(async (t: string) => { llamadas.push(`olvidar ${t}`); return olvidarOk; }),
  };
  const obtenerToken = jest.fn(async () => token);
  const registro = crearRegistroAvisos({ obtenerToken, api, avisar: (m) => avisos.push(m) });
  return { registro, api, obtenerToken, llamadas, avisos };
};

describe('T9 · registro del teléfono para avisos (criterio 11)', () => {
  test('al iniciar sesión registra el token de este teléfono', async () => {
    const { registro, llamadas } = montar();
    await expect(registro.registrar('pedro')).resolves.toBe(TOKEN);
    expect(llamadas).toEqual([`registrar ${TOKEN}`]);
    expect(registro.registradoPara()).toBe('pedro');
  });

  test('registrar dos veces con la misma cuenta no repite la llamada', async () => {
    const { registro, llamadas } = montar();
    await registro.registrar('pedro');
    await registro.registrar('pedro');
    expect(llamadas).toHaveLength(1);
  });

  test('si el teléfono pasa a otra cuenta se registra de nuevo (la BD lo reasigna)', async () => {
    const { registro, llamadas } = montar();
    await registro.registrar('pedro');
    await registro.registrar('xavi');
    expect(llamadas).toEqual([`registrar ${TOKEN}`, `registrar ${TOKEN}`]);
    expect(registro.registradoPara()).toBe('xavi');
  });

  test('al cerrar sesión borra el token y vuelve a registrarlo en el siguiente inicio', async () => {
    const { registro, llamadas } = montar();
    await registro.registrar('pedro');
    await registro.olvidar();
    expect(llamadas).toEqual([`registrar ${TOKEN}`, `olvidar ${TOKEN}`]);
    expect(registro.registradoPara()).toBeNull();
    await registro.registrar('pedro');
    expect(llamadas).toHaveLength(3);
  });

  test('cerrar sesión sin token registrado no llama a la API', async () => {
    const { registro, api } = montar();
    await registro.olvidar();
    expect(api.olvidar).not.toHaveBeenCalled();
  });

  test('iniciar y cerrar sesión seguidos no se cruzan: el borrado va después del registro', async () => {
    const { registro, llamadas } = montar();
    const inicio = registro.registrar('pedro');
    const cierre = registro.olvidar();
    await Promise.all([inicio, cierre]);
    expect(llamadas).toEqual([`registrar ${TOKEN}`, `olvidar ${TOKEN}`]);
  });

  test('sin token (web, Expo Go o permiso negado) no llama a la API', async () => {
    const { registro, api } = montar({ token: null });
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    expect(api.registrar).not.toHaveBeenCalled();
    expect(registro.registradoPara()).toBeNull();
  });

  test('un token con formato inesperado no se envía', async () => {
    const { registro, api } = montar({ token: 'token-inventado' });
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    expect(api.registrar).not.toHaveBeenCalled();
  });

  test('si el servidor no lo registra, el siguiente intento vuelve a probar', async () => {
    const { registro, api, avisos } = montar({ registrarOk: false });
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    await registro.registrar('pedro');
    expect(api.registrar).toHaveBeenCalledTimes(2);
    expect(avisos[0]).toMatch(/no registró/);
  });

  test('un error al pedir el token no rompe el inicio de sesión', async () => {
    const { registro, obtenerToken, avisos } = montar();
    obtenerToken.mockRejectedValueOnce(new Error('sin red'));
    await expect(registro.registrar('pedro')).resolves.toBeNull();
    expect(avisos[0]).toMatch(/No se pudo registrar/);
  });

  test('un error al borrar no impide cerrar sesión y deja el registro limpio', async () => {
    const { registro, api, avisos } = montar();
    await registro.registrar('pedro');
    (api.olvidar as jest.Mock).mockRejectedValueOnce(new Error('sin red'));
    await expect(registro.olvidar()).resolves.toBeUndefined();
    expect(registro.registradoPara()).toBeNull();
    expect(avisos[0]).toMatch(/No se pudo quitar/);
  });

  test('el patrón del token coincide con el CHECK de la BD', () => {
    expect(TOKEN_EXPO.test(TOKEN)).toBe(true);
    expect(TOKEN_EXPO.test('ExponentPushToken[corto]')).toBe(false);
    expect(TOKEN_EXPO.test('ExponentPushToken[con espacio 1234]')).toBe(false);
  });
});

// ─── T10 · ubicación en segundo plano ───────────────────────────────────────
const PARADA = { lat: -0.87, lng: -80.54 };
// ~22 m al norte de la parada (1e-4 grados de latitud son unos 11 m).
const A_22_M = { lat: -0.8698, lng: -80.54 };
const A_5_M = { lat: -0.86995, lng: -80.54 };

describe('T10 · frecuencia adaptativa (criterio 19)', () => {
  const p = PARAMETROS_POR_DEFECTO;
  const t0 = 1_000_000;

  test('la distancia en línea recta es razonable', () => {
    expect(distanciaMetros(PARADA, A_22_M)).toBeGreaterThan(20);
    expect(distanciaMetros(PARADA, A_22_M)).toBeLessThan(24);
    expect(distanciaMetros(PARADA, PARADA)).toBe(0);
  });

  test('la primera posición siempre se envía', () => {
    expect(debeEnviar(null, PARADA, t0, p)).toBe(true);
  });

  test('detenido en la parada: no envía antes del tiempo de quieto', () => {
    const ultimo = { ...PARADA, en: t0 };
    expect(debeEnviar(ultimo, A_5_M, t0 + 10_000, p)).toBe(false);
    expect(debeEnviar(ultimo, A_5_M, t0 + 29_999, p)).toBe(false);
  });

  test('detenido: envía al cumplirse el tiempo de quieto, antes de los 60 s del despacho', () => {
    const ultimo = { ...PARADA, en: t0 };
    expect(debeEnviar(ultimo, PARADA, t0 + p.fondoQuietoSeg * 1000, p)).toBe(true);
    expect(p.fondoQuietoSeg).toBeLessThan(60);
  });

  test(`en movimiento (más de ${DISTANCIA_MINIMA_M} m): envía en la siguiente posición`, () => {
    const ultimo = { ...PARADA, en: t0 };
    expect(debeEnviar(ultimo, A_22_M, t0 + p.fondoMovSeg * 1000, p)).toBe(true);
  });

  test('en una jornada detenida envía 3 veces menos que en movimiento', () => {
    let ultimoQuieto: { lat: number; lng: number; en: number } | null = null;
    let ultimoMov: { lat: number; lng: number; en: number } | null = null;
    let quieto = 0;
    let mov = 0;
    for (let i = 0; i < 360; i += 1) { // 1 h con una posición cada 10 s
      const ahora = t0 + i * p.fondoMovSeg * 1000;
      if (debeEnviar(ultimoQuieto, PARADA, ahora, p)) { quieto += 1; ultimoQuieto = { ...PARADA, en: ahora }; }
      const punto = { lat: PARADA.lat + i * 0.0003, lng: PARADA.lng };
      if (debeEnviar(ultimoMov, punto, ahora, p)) { mov += 1; ultimoMov = { ...punto, en: ahora }; }
    }
    expect(mov).toBe(360);
    expect(quieto).toBe(120);
  });

  test('las frecuencias del servidor se usan si son válidas', () => {
    expect(leerParametros({ abiertaSeg: 4, fondoMovSeg: 12, fondoQuietoSeg: 40 }))
      .toEqual({ abiertaSeg: 4, fondoMovSeg: 12, fondoQuietoSeg: 40 });
  });

  test.each([
    [undefined],
    [null],
    [{ abiertaSeg: 5 }],
    [{ abiertaSeg: 5, fondoMovSeg: 10, fondoQuietoSeg: 5 }],
    [{ abiertaSeg: '5', fondoMovSeg: 10, fondoQuietoSeg: 30 }],
    [{ abiertaSeg: 0, fondoMovSeg: 10, fondoQuietoSeg: 30 }],
  ])('frecuencias inválidas (%p): se usan las de por defecto', (crudo) => {
    expect(leerParametros(crudo)).toEqual(PARAMETROS_POR_DEFECTO);
  });
});

describe('T10 · arranque y parada con la disponibilidad (criterio 2)', () => {
  test('disponible y en un viaje se sigue; no disponible o sin saberlo, no', () => {
    expect(debeSeguir('disponible')).toBe(true);
    expect(debeSeguir('ocupado')).toBe(true);
    expect(debeSeguir('inactivo')).toBe(false);
    expect(debeSeguir(null)).toBe(false);
  });
});

describe('T10 · permiso en segundo plano (criterios 4 y 5)', () => {
  const base = { primerPlano: true, segundoPlano: false, puedePreguntar: true, yaExplicado: false };

  test('con permiso, arranca', () => {
    expect(decidirPermiso({ ...base, segundoPlano: true })).toBe('iniciar');
  });

  test('la primera vez, la explicación propia va antes del diálogo del sistema', () => {
    expect(decidirPermiso(base)).toBe('explicar');
  });

  test('si ya se explicó o el sistema no deja preguntar, solo con la app abierta', () => {
    expect(decidirPermiso({ ...base, yaExplicado: true })).toBe('solo_abierta');
    expect(decidirPermiso({ ...base, puedePreguntar: false })).toBe('solo_abierta');
  });

  test('sin ubicación en primer plano no puede recibir viajes', () => {
    expect(decidirPermiso({ ...base, primerPlano: false, segundoPlano: true })).toBe('sin_ubicacion');
  });

  test('la explicación dice qué se usa, para qué y cuándo se detiene', () => {
    const texto = PERMISO_UBICACION.puntos.map((p) => p.texto).join(' ');
    expect(texto).toMatch(/Qué usamos/);
    expect(texto).toMatch(/segundo plano/);
    expect(texto).toMatch(/Para qué/);
    expect(texto).toMatch(/Cuándo se detiene: al ponerte no disponible o cerrar sesión/);
    expect(texto).toMatch(/aviso permanente/);
  });

  test('el aviso sin permiso dice que puede seguir con la app abierta', () => {
    expect(AVISO_SEGUIMIENTO.solo_abierta.texto).toMatch(/Solo recibirás ofertas con la app abierta/);
  });
});

describe('T10 · envío por socket o REST (P11, P13)', () => {
  const montarCanal = ({
    conectado = false,
    jwt = 'jwt-de-prueba' as string | null,
    status = 204,
    falla = false,
  } = {}) => {
    const emitidos: unknown[] = [];
    const socket: SocketUbicacion = { connected: conectado, emit: (_e, d) => emitidos.push(d) };
    const fetchImpl = jest.fn(async () => {
      if (falla) throw new Error('sin red');
      return { ok: status >= 200 && status < 300, status } as Response;
    });
    const canal = crearCanalUbicacion({
      obtenerSocket: () => socket,
      obtenerJwt: async () => jwt,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      url: 'http://api/api/conductores/ubicacion',
      sectorDe: () => 'malecon',
      ahora: () => 42,
    });
    return { canal, emitidos, fetchImpl };
  };

  test('con el socket conectado envía por socket y no por REST', async () => {
    const { canal, emitidos, fetchImpl } = montarCanal({ conectado: true });
    await expect(canal.enviar(PARADA)).resolves.toBe('ok');
    expect(emitidos).toEqual([{ sectorId: 'malecon', coords: PARADA }]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(canal.ultimoEnvio()).toEqual({ ...PARADA, en: 42 });
  });

  test('sin socket envía por REST con el JWT de la sesión', async () => {
    const { canal, fetchImpl } = montarCanal();
    await expect(canal.enviar(PARADA)).resolves.toBe('ok');
    const [url, opciones] = (fetchImpl.mock.calls[0] as unknown) as [string, RequestInit];
    expect(url).toBe('http://api/api/conductores/ubicacion');
    expect(opciones.method).toBe('POST');
    expect((opciones.headers as Record<string, string>).Authorization).toBe('Bearer jwt-de-prueba');
    expect(JSON.parse(opciones.body as string)).toEqual({ sectorId: 'malecon', coords: PARADA });
  });

  test('un 403 del servidor pide detener el seguimiento', async () => {
    const { canal } = montarCanal({ status: 403 });
    await expect(canal.enviar(PARADA)).resolves.toBe('detener');
    expect(canal.ultimoEnvio()).toBeNull();
  });

  test('sin sesión pide detener sin llamar al servidor', async () => {
    const { canal, fetchImpl } = montarCanal({ jwt: null });
    await expect(canal.enviar(PARADA)).resolves.toBe('detener');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('un 429 o sin red se reintenta en el siguiente envío', async () => {
    await expect(montarCanal({ status: 429 }).canal.enviar(PARADA)).resolves.toBe('error');
    await expect(montarCanal({ falla: true }).canal.enviar(PARADA)).resolves.toBe('error');
  });

  test('reiniciar hace que el próximo seguimiento envíe de inmediato', async () => {
    const { canal } = montarCanal({ conectado: true });
    await canal.enviar(PARADA);
    canal.reiniciar();
    expect(canal.ultimoEnvio()).toBeNull();
  });
});

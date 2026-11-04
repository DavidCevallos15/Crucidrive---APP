/**
 * Paso 007 · T1 y T2: marcador efímero del conductor y parámetros de los sockets
 * (criterios 1 y 3; plan P1 y P2).
 */
const { crearMarcador, leerSecretoMarcador, redondear3, fechaLocal } = require('../src/ubicacion/marcador');
const { leerConfigSockets } = require('../src/sockets/config');

const SECRETO = 'secreto-de-prueba-del-marcador-007-xx';
const CARLA = '22222222-2222-2222-2222-222222222222';
const DIEGO = '33333333-3333-3333-3333-333333333333';
// 4 nov 2026 en Ecuador (UTC-5): de 05:00Z del 4 a 04:59Z del 5.
const MANANA_4 = new Date('2026-11-04T13:00:00Z');
const NOCHE_4 = new Date('2026-11-05T04:59:00Z');
const MADRUGADA_5 = new Date('2026-11-05T05:01:00Z');

describe('T2 · marcador efímero (criterio 3)', () => {
  test('es el mismo durante todo el día de Ecuador', () => {
    expect(crearMarcador(CARLA, { secreto: SECRETO, ahora: MANANA_4 }))
      .toBe(crearMarcador(CARLA, { secreto: SECRETO, ahora: NOCHE_4 }));
  });

  test('cambia al día siguiente, aunque solo pasen minutos', () => {
    expect(crearMarcador(CARLA, { secreto: SECRETO, ahora: NOCHE_4 }))
      .not.toBe(crearMarcador(CARLA, { secreto: SECRETO, ahora: MADRUGADA_5 }));
  });

  test('usa la fecha de Ecuador, no la de UTC', () => {
    expect(fechaLocal(NOCHE_4)).toBe('2026-11-04');
    expect(fechaLocal(MADRUGADA_5)).toBe('2026-11-05');
  });

  test('es distinto para cada conductor y no contiene el UUID', () => {
    const carla = crearMarcador(CARLA, { secreto: SECRETO, ahora: MANANA_4 });
    const diego = crearMarcador(DIEGO, { secreto: SECRETO, ahora: MANANA_4 });
    expect(carla).not.toBe(diego);
    expect(carla).toMatch(/^[0-9a-f]{16}$/);
    expect(CARLA.replace(/-/g, '')).not.toContain(carla);
  });

  test('sin conocer el secreto no se puede reproducir', () => {
    expect(crearMarcador(CARLA, { secreto: SECRETO, ahora: MANANA_4 }))
      .not.toBe(crearMarcador(CARLA, { secreto: `${SECRETO}-otro`, ahora: MANANA_4 }));
  });

  test('redondea las coordenadas a 3 decimales (~110 m)', () => {
    expect(redondear3(-0.8699838)).toBe(-0.87);
    expect(redondear3(-80.53995042)).toBe(-80.54);
    expect(redondear3(-0.91234)).toBe(-0.912);
  });
});

describe('T1 · parámetros obligatorios al arrancar', () => {
  test.each([
    ['sin secreto', {}],
    ['secreto vacío', { MARCADOR_SECRETO: '   ' }],
    ['secreto corto', { MARCADOR_SECRETO: 'corto' }],
  ])('%s detiene el arranque', (_caso, env) => {
    expect(() => leerSecretoMarcador(env)).toThrow('MARCADOR_SECRETO');
  });

  test('un secreto de 32 caracteres o más se acepta', () => {
    expect(leerSecretoMarcador({ MARCADOR_SECRETO: SECRETO })).toBe(SECRETO);
  });

  test('sin variable, 6 cambios de sector por minuto', () => {
    expect(leerConfigSockets({})).toEqual({ cambiosSectorPorMin: 6 });
  });

  test.each(['0', '61', 'seis', '2.5'])('SOCKET_CAMBIOS_SECTOR_MIN=%s impide arrancar', (valor) => {
    expect(() => leerConfigSockets({ SOCKET_CAMBIOS_SECTOR_MIN: valor })).toThrow('SOCKET_CAMBIOS_SECTOR_MIN');
  });
});

import {
  avisoParaConductor,
  confirmacionDelPaso,
  enlaceComoLlegar,
  leerResenas,
  leerViajeConductor,
  motivosPara,
  puedeCancelar,
  siguientePaso,
  textoFecha,
  textoResenas,
  trasPaso,
  viajeDesdeFila,
  type FilaViajeConductor,
  type LectorViajeConductor,
  type ViajeConductor,
} from '../src/utils/viajeConductor';

const FILA: FilaViajeConductor = {
  id: 'v1',
  estado: 'aceptado',
  tipo_servicio: 'viaje',
  pasajero_id: 'p1',
  pasajeros: 3,
  tarifa: '1.50',
  sector_origen_id: null,
  sector_destino_id: null,
  origen_descripcion: 'Muelle',
  destino_descripcion: 'Iglesia',
  llegado_en: null,
};
const EXTRA = { pasajero: { nombre: 'Ana', telefono: '0991234567' }, paquete: null, threadId: 't1', recogida: { lat: -0.87, lng: -80.54 } };
const VIAJE = viajeDesdeFila(FILA, EXTRA) as ViajeConductor;

describe('005 · el botón del conductor según el estado (criterios 3, 4 y 5)', () => {
  test('aceptado sin llegar → «Llegué»; ya llegó → «Empezar viaje»; en curso → «Llegamos»', () => {
    expect(siguientePaso({ estado: 'aceptado', llegadoEn: null, encomienda: false })).toEqual({ paso: 'llegada', texto: 'Llegué' });
    expect(siguientePaso({ estado: 'aceptado', llegadoEn: '2026-10-20T15:00:00Z', encomienda: false })).toEqual({ paso: 'iniciar', texto: 'Empezar viaje' });
    expect(siguientePaso({ estado: 'en_curso', llegadoEn: '2026-10-20T15:00:00Z', encomienda: false })).toEqual({ paso: 'terminar', texto: 'Llegamos' });
  });

  test('encomienda: «Paquete recogido» y «Paquete entregado»', () => {
    expect(siguientePaso({ estado: 'aceptado', llegadoEn: 'x', encomienda: true }).texto).toBe('Paquete recogido');
    expect(siguientePaso({ estado: 'en_curso', llegadoEn: 'x', encomienda: true }).texto).toBe('Paquete entregado');
  });

  test('iniciar y terminar piden confirmación; «Llegué» no', () => {
    expect(confirmacionDelPaso('llegada', false)).toBeNull();
    expect(confirmacionDelPaso('iniciar', false)).toMatch(/subió/);
    expect(confirmacionDelPaso('terminar', true)).toMatch(/paquete/);
  });

  test('cancelar solo mientras está aceptado (criterios 8 y 9)', () => {
    expect(puedeCancelar('aceptado')).toBe(true);
    expect(puedeCancelar('en_curso')).toBe(false);
  });
});

describe('005 · tras un paso aceptado por el servidor', () => {
  const AHORA = '2026-10-20T15:00:00.000Z';

  test('usa lo que devuelve el servidor', () => {
    const r = trasPaso(VIAJE, 'llegada', { estado: 'aceptado', llegado_en: '2026-10-20T14:59:00Z' }, AHORA);
    expect(r).toMatchObject({ estado: 'aceptado', llegadoEn: '2026-10-20T14:59:00Z' });
  });

  test('si el servidor no pudo leer el viaje (solo id), lo deduce del paso', () => {
    expect(trasPaso(VIAJE, 'llegada', null, AHORA).llegadoEn).toBe(AHORA);
    expect(trasPaso(VIAJE, 'iniciar', null, AHORA)).toMatchObject({ estado: 'en_curso', llegadoEn: null });
  });

  test('empezar sin haber marcado «Llegué» no inventa la hora de llegada', () => {
    expect(trasPaso(VIAJE, 'iniciar', { estado: 'en_curso', llegado_en: null }, AHORA).llegadoEn).toBeNull();
  });
});

describe('005 · tarjeta del viaje (criterios 1 y 2)', () => {
  test('arma el viaje con total, personas y recogida', () => {
    expect(VIAJE).toMatchObject({ estado: 'aceptado', encomienda: false, tarifa: 1.5, pasajeros: 3, paquete: null });
  });

  test('encomienda: sin precio y con el paquete', () => {
    const paquete = { descripcion: 'Caja', destinatario: 'Luis' };
    const v = viajeDesdeFila({ ...FILA, tipo_servicio: 'encomienda', tarifa: null }, { ...EXTRA, paquete });
    expect(v).toMatchObject({ encomienda: true, tarifa: null, paquete });
  });

  test('un viaje que ya no está abierto no se muestra', () => {
    for (const estado of ['finalizado', 'cancelado', 'solicitado', 'sin_conductor']) {
      expect(viajeDesdeFila({ ...FILA, estado }, EXTRA)).toBeNull();
    }
  });

  test('«Cómo llegar» abre la app de mapas con el punto de recogida, sin clave', () => {
    expect(enlaceComoLlegar({ lat: -0.8712345678, lng: -80.54 }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=-0.871235,-80.540000');
  });

  test('lee el viaje y sus datos; los datos de apoyo pueden fallar sin romperlo', async () => {
    const lector: LectorViajeConductor = {
      viajeAbierto: jest.fn(async () => FILA),
      pasajero: jest.fn(async () => { throw new Error('sin red'); }),
      hilo: jest.fn(async () => 't1'),
      paquete: jest.fn(async () => null),
      recogida: jest.fn(async () => ({ lat: 1, lng: 2 })),
    };
    const v = await leerViajeConductor(lector, 'c1');
    expect(v).toMatchObject({ id: 'v1', threadId: 't1', recogida: { lat: 1, lng: 2 }, pasajero: { nombre: null, telefono: null } });
    // Un viaje normal no pide el paquete.
    expect(lector.paquete).not.toHaveBeenCalled();
  });

  test('si falla la lectura del viaje, lanza (se conserva lo que se veía)', async () => {
    const lector = { viajeAbierto: async () => { throw new Error('sin red'); } } as unknown as LectorViajeConductor;
    await expect(leerViajeConductor(lector, 'c1')).rejects.toThrow('sin red');
  });

  test('sin viaje abierto devuelve null', async () => {
    const lector = { viajeAbierto: async () => null } as unknown as LectorViajeConductor;
    await expect(leerViajeConductor(lector, 'c1')).resolves.toBeNull();
  });
});

describe('005 · motivos y avisos (criterios 5b y 8)', () => {
  test('cada uno ve los motivos que le corresponden, siempre con «Otro»', () => {
    expect(motivosPara('conductor')).toEqual(['no_encuentro_al_pasajero', 'otro']);
    expect(motivosPara('pasajero')).toEqual(['ya_no_lo_necesito', 'tarda_demasiado', 'otro']);
  });

  test('el conductor se entera si el pasajero cancela o termina; lo demás no le toca', () => {
    expect(avisoParaConductor({ viajeId: 'v1', cambio: 'cancelado_por_pasajero' })?.titulo).toMatch(/canceló/);
    expect(avisoParaConductor({ viajeId: 'v1', cambio: 'finalizado_por_pasajero' })?.titulo).toMatch(/terminó/);
    expect(avisoParaConductor({ viajeId: 'v1', cambio: 'llegada' })).toBeNull();
  });
});

describe('005 · reseñas (criterios 17 y 18)', () => {
  test('«★ 4,8 · 23 reseñas», singular y «Nuevo»', () => {
    expect(textoResenas(4.8, 23)).toBe('★ 4,8 · 23 reseñas');
    expect(textoResenas(5, 1)).toBe('★ 5,0 · 1 reseña');
    expect(textoResenas(null, 0)).toBe('Nuevo');
    expect(textoResenas(4, 0)).toBe('Nuevo');
  });

  test('lee la respuesta del servidor y descarta lo que no tiene forma', () => {
    const r = leerResenas({
      promedio: 4.5,
      total: 2,
      resenas: [{ estrellas: 5, comentario: 'Puntual', fecha: '2026-10-20' }, { estrellas: 4, comentario: '  ', fecha: '2026-10-19' }, { nada: 1 }],
    });
    expect(r).toEqual({
      promedio: 4.5,
      total: 2,
      resenas: [{ estrellas: 5, comentario: 'Puntual', fecha: '2026-10-20' }, { estrellas: 4, comentario: null, fecha: '2026-10-19' }],
    });
    expect(leerResenas(null)).toEqual({ promedio: null, total: 0, resenas: [] });
  });

  test('la fecha se muestra sin hora ni zona horaria', () => {
    expect(textoFecha('2026-10-20')).toBe('20 oct 2026');
    expect(textoFecha('basura')).toBe('');
  });
});

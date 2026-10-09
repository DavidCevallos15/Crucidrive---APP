/**
 * Paso 003, T5: guion que convierte la respuesta de Overpass en la migración de lugares.
 * Criterio 22: filtra, quita duplicados y genera SQL idempotente que no pisa al administrador.
 */
const {
  construirConsulta, procesar, generarSql, categoria, esGenerico, ordenarMayusculas,
} = require('../scripts/importar-lugares');

const nodo = (id, lat, lon, tags) => ({ type: 'node', id, lat, lon, tags });
const via = (id, lat, lon, tags) => ({ type: 'way', id, center: { lat, lon }, tags });

const respuesta = {
  elements: [
    nodo(1, -0.8745, -80.5419, { amenity: 'pharmacy', name: 'FARMACIAS SANTA MARTHA' }),
    nodo(2, -0.8575, -80.5339, { amenity: 'restaurant', name: 'Cevichería El Manaba', cuisine: 'seafood' }),
    // El mismo restaurante mapeado como punto y como edificio, a ~10 m: queda uno.
    nodo(3, -0.8690, -80.5395, { amenity: 'cafe', name: 'BOLON y TIGRILLO' }),
    via(4, -0.86905, -80.5394, { amenity: 'restaurant', building: 'yes', name: 'BOLON Y TIGRILLO' }),
    // Mismo nombre a ~190 m: son dos locales distintos.
    nodo(5, -0.8708, -80.5402, { amenity: 'restaurant', name: 'PIZZA Station' }),
    nodo(6, -0.8725, -80.5410, { amenity: 'restaurant', name: 'PIZZA Station' }),
    // Genéricos y cosas que nadie pide como destino.
    nodo(7, -0.8576, -80.5351, { tourism: 'hostel', name: 'Hospedaje' }),
    nodo(8, -0.8683, -80.5359, { shop: 'variety_store', name: 'A' }),
    via(9, -0.8471, -80.5022, { building: 'yes', name: 'Construcción cercana a vía secundaria' }),
    via(10, -0.8675, -80.5056, { building: 'house', name: '2 casas' }),
    via(11, -0.8352, -80.5044, { landuse: 'forest', name: 'Bosque' }),
    { type: 'relation', id: 12, center: { lat: -0.8763, lon: -80.5378 }, tags: { place: 'municipality', name: 'Crucita' } },
    nodo(13, -0.8711, -80.5381, { place: 'town', name: 'Crucita' }),
    // Útiles.
    nodo(14, -0.8014, -80.5098, { place: 'hamlet', name: 'La Palmita' }),
    via(15, -0.8748, -80.5381, { landuse: 'cemetery', name: 'Cementerio de Crucita' }),
    nodo(16, -0.8769, -80.5417, { amenity: 'police', name: 'UPC Crucita' }),
    nodo(17, -0.8704, -80.5402, { tourism: 'attraction', name: 'Letras Crucita' }),
    nodo(18, -0.8575, -80.5341, { amenity: 'fuel', name: 'FENAPET' }),
    nodo(19, -0.8607, -80.5352, { tourism: 'hotel', name: "Ocean Blue Hotel's" }),
    nodo(20, -0.8778, -80.5430, { amenity: 'restaurant' }), // sin nombre
  ],
};

describe('importar-lugares (T5, criterio 22)', () => {
  const lugares = procesar(respuesta);
  const nombres = lugares.map((l) => l.nombre);

  test('la consulta cubre la parroquia y un radio alrededor de los 5 sectores, sin calles ni ríos', () => {
    const q = construirConsulta();
    expect(q).toContain('area.parroquia');
    expect((q.match(/around:1500/g) || []).length).toBe(5);
    expect(q).toContain('[!"highway"]');
    expect(q).toContain('[!"waterway"]');
    expect(q).toContain('out tags center;');
  });

  test('descarta genéricos, casas, bosques, divisiones administrativas y lugares sin nombre', () => {
    for (const fuera of ['Hospedaje', 'A', 'Construcción cercana a vía secundaria', '2 casas', 'Bosque', 'Crucita']) {
      expect(nombres).not.toContain(fuera);
    }
    expect(lugares.some((l) => l.osmId === 'node/20')).toBe(false);
  });

  test('conserva lugares útiles con su categoría', () => {
    const porNombre = Object.fromEntries(lugares.map((l) => [l.nombre, l]));
    expect(porNombre['Farmacias Santa Martha'].categoria).toBe('salud');
    expect(porNombre['Cevichería El Manaba'].categoria).toBe('comida');
    expect(porNombre['La Palmita'].categoria).toBe('poblado');
    expect(porNombre['Cementerio de Crucita']).toBeDefined();
    expect(porNombre['UPC Crucita'].categoria).toBe('gobierno');
    expect(porNombre['Letras Crucita'].categoria).toBe('turismo');
    expect(porNombre['Fenapet'].categoria).toBe('transporte');
    expect(porNombre["Ocean Blue Hotel's"].categoria).toBe('hospedaje');
  });

  test('fusiona el mismo lugar mapeado dos veces, pero no dos locales con el mismo nombre lejos', () => {
    expect(nombres.filter((n) => n.toLowerCase() === 'bolon y tigrillo')).toHaveLength(1);
    // Gana la vía, que tiene más etiquetas.
    expect(lugares.find((l) => l.nombre.toLowerCase() === 'bolon y tigrillo').osmId).toBe('way/4');
    expect(nombres.filter((n) => n === 'PIZZA Station')).toHaveLength(2);
  });

  test('las coordenadas de vías y relaciones salen de su centro', () => {
    const cementerio = lugares.find((l) => l.osmId === 'way/15');
    expect(cementerio).toMatchObject({ lat: -0.8748, lng: -80.5381 });
  });

  test('solo pasa a minúsculas los nombres escritos todo en mayúsculas', () => {
    expect(ordenarMayusculas('FARMACIAS SANTA MARTHA')).toBe('Farmacias Santa Martha');
    expect(ordenarMayusculas('RESTAURANTE EL DELFÍN')).toBe('Restaurante el Delfín');
    expect(ordenarMayusculas('C.N.T')).toBe('C.N.T');
    expect(ordenarMayusculas('PIZZA Station')).toBe('PIZZA Station');
    expect(ordenarMayusculas('tío sam')).toBe('Tío sam');
  });

  test('categoría y genéricos: casos límite', () => {
    expect(categoria({ shop: 'bakery' })).toBe('tienda');
    expect(categoria({ amenity: 'bank' })).toBe('otro');
    expect(esGenerico('Panadería')).toBe(true);
    expect(esGenerico('Panadería Tío Sam')).toBe(false);
  });

  test('el resultado es estable: misma entrada, misma salida', () => {
    expect(procesar(respuesta)).toEqual(lugares);
  });

  describe('SQL generado', () => {
    const sql = generarSql(lugares, { fecha: '2026-10-08', fuente: 'prueba' });

    test('atribuye a OpenStreetMap con la licencia ODbL', () => {
      expect(sql).toContain('© OpenStreetMap contributors, licencia ODbL');
    });

    test('registra la fecha de los datos de OSM cuando se conoce', () => {
      expect(generarSql(lugares, { datosAl: '2026-10-09T00:31:15Z' })).toContain('(datos de OSM al 2026-10-09T00:31:15Z)');
    });

    test('es idempotente y no pisa lo editado por el administrador', () => {
      expect(sql).toContain('on conflict (osm_id) do update');
      expect(sql).toContain('where not public.lugares.editado_por_admin;');
    });

    test('escapa comillas simples', () => {
      expect(sql).toContain("'Ocean Blue Hotel''s'");
    });

    test('una fila por lugar, marcada como fuente osm', () => {
      expect((sql.match(/, 'osm', '/g) || []).length).toBe(lugares.length);
      expect(sql).toContain("POINT(-80.5419 -0.8745)");
    });

    test('se niega a generar una migración vacía', () => {
      expect(() => generarSql([])).toThrow('No hay lugares');
    });
  });
});

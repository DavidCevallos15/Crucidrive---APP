/**
 * Importa el catálogo de lugares de Crucita desde OpenStreetMap (paso 003, D-09; plan R17 y R18).
 *
 * No escribe en la BD: genera una migración SQL que se revisa en el PR, se prueba en Docker y
 * se aplica como cualquier otra. Volver a importar genera otra migración; el `on conflict`
 * actualiza lo que viene de OSM y no pisa lo que corrigió el administrador (criterio 22).
 *
 * Uso (desde backend/):
 *   npm run lugares:importar                       # consulta Overpass
 *   npm run lugares:importar -- --entrada osm.json # usa una respuesta guardada
 *   npm run lugares:importar -- --salida ../supabase/migrations/0014_lugares_osm.sql
 *
 * Datos © OpenStreetMap contributors, licencia ODbL (https://www.openstreetmap.org/copyright).
 */
const fs = require('fs');
const path = require('path');
const { normalizar } = require('../src/utils/texto');

// Centros de los 5 sectores (migración 0009). El límite administrativo de Crucita en OSM
// no llega a La Boca, así que también entra lo que esté cerca de cada centro.
const CENTROS_SECTORES = [
  { id: 'la_boca', lat: -0.80147852, lng: -80.52098189 },
  { id: 'las_gilces', lat: -0.82141437, lng: -80.52405601 },
  { id: 'los_arenales', lat: -0.8567572, lng: -80.53186699 },
  { id: 'malecon', lat: -0.8699838, lng: -80.53995042 },
  { id: 'la_loma', lat: -0.88463806, lng: -80.54802452 },
];
const RADIO_SECTOR_M = 1500;
const DISTANCIA_DUPLICADO_M = 150;
const SALIDA_POR_DEFECTO = path.join(__dirname, '..', '..', 'supabase', 'migrations', '0013_lugares_osm.sql');
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
// Sin User-Agent propio, overpass-api.de responde 406.
const USER_AGENT = 'CruciDrive-importar-lugares/1.0 (+https://github.com/DavidCevallos15/Crucidrive---APP)';

// Nombres que no identifican un lugar concreto (se comparan normalizados).
const NOMBRES_GENERICOS = new Set([
  'hospedaje', 'hostal', 'hotel', 'panaderia', 'tienda', 'bar', 'restaurante', 'restaurant',
  'iglesia', 'escuela', 'colegio', 'subcentro', 'cementerio', 'parque', 'cancha', 'casa',
  'garaje', 'bosque', 'farm', 'sembrio', 'tennis court', 'cancha de voleibol', 'crucita',
]);
const PATRONES_GENERICOS = [/cercana a via/, /^\d+ casas?$/, /^construccion/];

const LUGARES_POBLADOS = new Set(['hamlet', 'village', 'town', 'neighbourhood', 'locality', 'isolated_dwelling']);
const EDIFICIOS_SIN_INTERES = new Set(['house', 'residential', 'construction', 'shed', 'garage', 'roof']);
const PALABRAS_MENORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'a', 'en']);


/** Distancia en metros entre dos puntos (haversine). */
const distanciaM = (a, b) => {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/** Consulta Overpass: la parroquia de Crucita más un radio alrededor de cada sector. */
const construirConsulta = () => {
  const filtro = '["name"][!"highway"][!"waterway"][!"boundary"][!"natural"][!"power"]';
  const alrededor = CENTROS_SECTORES
    .map((s) => `  nwr(around:${RADIO_SECTOR_M},${s.lat},${s.lng})${filtro};`)
    .join('\n');
  return [
    '[out:json][timeout:90];',
    'rel(-0.95,-80.6,-0.75,-80.45)["boundary"="administrative"]["name"="Crucita"];',
    'map_to_area->.parroquia;',
    '(',
    `  nwr(area.parroquia)${filtro};`,
    alrededor,
    ');',
    'out tags center;',
  ].join('\n');
};

/** Categoría del catálogo (CHECK de lugares.categoria) a partir de las etiquetas de OSM. */
const categoria = (t) => {
  const { amenity, shop, tourism, leisure, place, office, landuse, healthcare } = t;
  if (place && LUGARES_POBLADOS.has(place)) return 'poblado';
  if (['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'ice_cream', 'food_court', 'biergarten'].includes(amenity)) return 'comida';
  if (['pharmacy', 'clinic', 'doctors', 'hospital', 'dentist'].includes(amenity) || healthcare) return 'salud';
  if (['school', 'college', 'university', 'kindergarten', 'driving_school'].includes(amenity) || office === 'educational_institution') return 'educacion';
  if (amenity === 'place_of_worship') return 'religion';
  if (['police', 'fire_station', 'townhall', 'post_office', 'courthouse', 'community_centre'].includes(amenity) || office === 'government') return 'gobierno';
  if (['fuel', 'bus_station', 'taxi', 'parking', 'ferry_terminal'].includes(amenity)) return 'transporte';
  if (['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'alpine_hut', 'chalet'].includes(tourism)) return 'hospedaje';
  if (shop) return 'tienda';
  if (tourism || ['park', 'playground', 'beach_resort', 'nature_reserve', 'resort', 'garden'].includes(leisure)) return 'turismo';
  if (landuse === 'cemetery') return 'otro';
  return 'otro';
};

/** ¿Las etiquetas describen un lugar al que alguien pediría una tricimoto? */
const esLugarUtil = (t) => {
  if (t.place) return LUGARES_POBLADOS.has(t.place);
  if (t.amenity || t.shop || t.tourism || t.leisure || t.office || t.craft || t.healthcare) return true;
  if (t.landuse) return t.landuse === 'cemetery';
  if (t.building) return !EDIFICIOS_SIN_INTERES.has(t.building);
  return false;
};

const esGenerico = (nombre) => {
  const n = normalizar(nombre);
  return n.length < 3 || NOMBRES_GENERICOS.has(n) || PATRONES_GENERICOS.some((p) => p.test(n));
};

const capitalizarInicio = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * "FARMACIAS SANTA MARTHA" → "Farmacias Santa Martha" y "tío sam" → "Tío sam".
 * Fuera de eso, los nombres se respetan como están en OSM.
 */
const ordenarMayusculas = (nombre) => {
  const limpio = String(nombre).replace(/\s+/g, ' ').trim();
  if (!/\p{L}/u.test(limpio) || limpio !== limpio.toUpperCase()) return capitalizarInicio(limpio);
  return limpio
    .split(' ')
    .map((palabra, i) => {
      if (palabra.includes('.') || palabra.includes('&') || palabra.length <= 1) return palabra;
      const minus = palabra.toLowerCase();
      if (i > 0 && PALABRAS_MENORES.has(minus)) return minus;
      return minus.charAt(0).toUpperCase() + minus.slice(1);
    })
    .join(' ');
};

/** Convierte la respuesta de Overpass en lugares limpios: filtra, categoriza y quita duplicados. */
const procesar = (respuesta) => {
  const candidatos = [];
  for (const e of respuesta.elements || []) {
    const t = e.tags || {};
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (!t.name || lat == null || lng == null) continue;
    if (!esLugarUtil(t) || esGenerico(t.name)) continue;
    const nombre = ordenarMayusculas(t.name).slice(0, 120);
    if (nombre.length < 2) continue;
    candidatos.push({
      osmId: `${e.type}/${e.id}`,
      nombre,
      categoria: categoria(t),
      lat: Number(lat.toFixed(7)),
      lng: Number(lng.toFixed(7)),
      etiquetas: Object.keys(t).length,
    });
  }

  // Mismo nombre a menos de 150 m: es el mismo lugar mapeado dos veces (p. ej. punto y edificio).
  // Gana el que tiene más etiquetas; a igualdad, el de osm_id menor, para que el resultado sea estable.
  candidatos.sort((a, b) => b.etiquetas - a.etiquetas || a.osmId.localeCompare(b.osmId));
  const elegidos = [];
  const vistos = new Set();
  for (const c of candidatos) {
    if (vistos.has(c.osmId)) continue;
    const repetido = elegidos.some(
      (x) => normalizar(x.nombre) === normalizar(c.nombre) && distanciaM(x, c) < DISTANCIA_DUPLICADO_M
    );
    vistos.add(c.osmId);
    if (!repetido) elegidos.push(c);
  }
  return elegidos
    .map(({ etiquetas, ...resto }) => resto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.osmId.localeCompare(b.osmId));
};

const sqlTexto = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Migración SQL idempotente con los lugares procesados. */
const generarSql = (lugares, { fecha = new Date().toISOString().slice(0, 10), fuente = 'Overpass API', datosAl = null } = {}) => {
  if (lugares.length === 0) throw new Error('No hay lugares para importar.');
  const filas = lugares.map(
    (l) => `  (${sqlTexto(l.nombre)}, ${sqlTexto(l.categoria)}, extensions.st_geogfromtext('SRID=4326;POINT(${l.lng} ${l.lat})'), 'osm', ${sqlTexto(l.osmId)})`
  );
  return [
    `-- Paso 003 · Catálogo de lugares desde OpenStreetMap (D-09). Generado por backend/scripts/importar-lugares.js`,
    `-- el ${fecha} desde ${fuente}${datosAl ? ` (datos de OSM al ${datosAl})` : ''}: ${lugares.length} lugares de la parroquia Crucita y alrededor de sus sectores.`,
    '-- Datos © OpenStreetMap contributors, licencia ODbL (https://www.openstreetmap.org/copyright).',
    '-- No se edita a mano: se corrige en OSM o desde el panel del administrador y se vuelve a generar.',
    '-- Volver a aplicarla no duplica lugares ni pisa lo que el administrador corrigió (criterio 22).',
    'insert into public.lugares (nombre, categoria, ubicacion, fuente, osm_id) values',
    filas.join(',\n'),
    'on conflict (osm_id) do update',
    '  set nombre = excluded.nombre, categoria = excluded.categoria, ubicacion = excluded.ubicacion',
    '  where not public.lugares.editado_por_admin;',
    '',
  ].join('\n');
};

const consultarOverpass = async (consulta) => {
  let ultimoError;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: consulta }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`${url} respondió ${res.status}`);
      return { respuesta: await res.json(), fuente: new URL(url).host };
    } catch (err) {
      ultimoError = err;
      console.warn(`[lugares] ${err.message}; se prueba el siguiente servidor.`);
    }
  }
  throw ultimoError;
};

const leerArgumento = (nombre) => {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? null : process.argv[i + 1];
};

const main = async () => {
  const entrada = leerArgumento('--entrada');
  const salida = path.resolve(leerArgumento('--salida') || SALIDA_POR_DEFECTO);
  const { respuesta, fuente } = entrada
    ? { respuesta: JSON.parse(fs.readFileSync(entrada, 'utf8')), fuente: `una respuesta guardada de Overpass (${path.basename(entrada)})` }
    : await consultarOverpass(construirConsulta());
  const lugares = procesar(respuesta);
  const datosAl = respuesta.osm3s?.timestamp_osm_base || null;
  fs.writeFileSync(salida, generarSql(lugares, { fuente, datosAl }), 'utf8');
  const porCategoria = lugares.reduce((acc, l) => ({ ...acc, [l.categoria]: (acc[l.categoria] || 0) + 1 }), {});
  console.log(`[lugares] ${lugares.length} lugares → ${salida}`);
  console.log(`[lugares] por categoría: ${JSON.stringify(porCategoria)}`);
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`[lugares] Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { construirConsulta, procesar, generarSql, categoria, esGenerico, ordenarMayusculas, normalizar, distanciaM };

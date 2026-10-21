import { SECTORS } from '../src/constants/sectors';
import { estadoZona, gpsDeServicio, ZONA_PILOTO } from '../src/utils/zonaServicio';
import { parametrosLugares } from '../src/utils/lugaresAdmin';
import { abrirTrasDeslizar, cerrarTrasDeslizar } from '../src/utils/menuGesture';
import { resolverOrigen } from '../src/utils/solicitud';

describe('012 · zona orientativa del piloto', () => {
  test.each(SECTORS)('$name y la posición de prueba están dentro', (sector) => {
    expect(estadoZona(sector.center)).toBe('dentro');
    expect(estadoZona({ lat: -0.8710, lng: -80.5440 })).toBe('dentro');
  });
  test.each([{ lat: 40.4168, lng: -3.7038 }, { lat: -2.19, lng: -79.88 }])('un GPS exterior no sirve como origen: %j', (coords) => {
    expect(estadoZona(coords)).toBe('fuera');
    expect(gpsDeServicio(coords, 'la_loma')).toBeNull();
    expect(resolverOrigen(null, gpsDeServicio(coords, 'la_loma'))).toBeNull();
    expect(resolverOrigen({ tipo: 'sector', sectorId: 'malecon' }, gpsDeServicio(coords, 'la_loma'))).toEqual({ tipo: 'sector', sectorId: 'malecon' });
  });
  test.each([null, { lat: NaN, lng: -80.54 }, { lat: -0.87, lng: Infinity }, { lat: 91, lng: 0 }])('sin posición válida no se inventa estar fuera: %j', (coords) => {
    expect(estadoZona(coords)).toBe('desconocida');
    expect(gpsDeServicio(coords, 'malecon')).toBeNull();
  });
  test('incluye el borde, excluye lo que queda fuera y recupera GPS al regresar', () => {
    expect(estadoZona({ lat: ZONA_PILOTO.sur, lng: ZONA_PILOTO.oeste })).toBe('dentro');
    expect(estadoZona({ lat: ZONA_PILOTO.sur - 0.001, lng: ZONA_PILOTO.oeste })).toBe('fuera');
    expect(gpsDeServicio(SECTORS[0].center, SECTORS[0].id)).toEqual({ coords: SECTORS[0].center, sectorId: SECTORS[0].id });
  });
});

describe('012 · filtros combinados', () => {
  test('visibles por defecto, texto recortado y sector viajan juntos', () => {
    const params = new URLSearchParams(parametrosLugares('  Letras Crucita  ', 'visibles', 'malecon'));
    expect(Object.fromEntries(params)).toEqual({ q: 'Letras Crucita', visible: 'true', sector: 'malecon' });
  });
  test('ocultos y todos conservan sector, sin mandar filtros vacíos', () => {
    expect(parametrosLugares('', 'ocultos', 'la_boca')).toBe('visible=false&sector=la_boca');
    expect(parametrosLugares(' ', 'todos', '')).toBe('');
  });
});

describe('012 · intención del gesto del menú', () => {
  test('un desplazamiento corto o en dirección contraria no abre el menú', () => {
    expect(abrirTrasDeslizar(10, 1000)).toBe(false);
    expect(abrirTrasDeslizar(-60, -800)).toBe(false);
    expect(abrirTrasDeslizar(48, 0)).toBe(true);
    expect(abrirTrasDeslizar(24, 650)).toBe(true);
  });
  test('el panel cierra por distancia o velocidad y recupera los desplazamientos cortos', () => {
    expect(cerrarTrasDeslizar(-100, 0, 324)).toBe(true);
    expect(cerrarTrasDeslizar(-20, -650, 324)).toBe(true);
    expect(cerrarTrasDeslizar(-10, -650, 324)).toBe(false);
    expect(cerrarTrasDeslizar(100, 800, 324)).toBe(false);
  });
});

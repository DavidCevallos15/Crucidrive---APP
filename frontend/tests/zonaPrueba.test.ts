import { estadoZona, leerZonaPrueba } from '../src/utils/zonaServicio';

/**
 * 012, criterio 8a: el APK de prueba puede aceptar otra ciudad como zona válida para probar
 * fuera de Crucita (pedido de David, 21 oct 2026). Producción no trae zona de prueba.
 */
const CRUCITA = { lat: -0.871, lng: -80.544 };
// Caja de ejemplo de otra ciudad (sur, oeste, norte, este).
const ZONA = '-1.10,-80.50,-1.00,-80.40';
const DENTRO_DE_ZONA = { lat: -1.05, lng: -80.45 };

describe('zona de prueba (012, criterio 8a)', () => {
  it('sin zona de prueba, solo vale Crucita', () => {
    expect(estadoZona(CRUCITA, null)).toBe('dentro');
    expect(estadoZona(DENTRO_DE_ZONA, null)).toBe('fuera');
  });

  it('con zona de prueba, un GPS dentro de ella cuenta como dentro, y Crucita sigue valiendo', () => {
    const zona = leerZonaPrueba(ZONA);
    expect(zona).not.toBeNull();
    expect(estadoZona(DENTRO_DE_ZONA, zona)).toBe('dentro');
    expect(estadoZona(CRUCITA, zona)).toBe('dentro');
    expect(estadoZona({ lat: 40.4, lng: -3.7 }, zona)).toBe('fuera'); // Madrid
  });

  it.each([
    ['vacía', ''],
    ['undefined', undefined],
    ['con texto', 'portoviejo'],
    ['incompleta', '-1.1,-80.5,-1.0'],
    ['invertida (sur mayor que norte)', '-1.00,-80.50,-1.10,-80.40'],
    ['fuera de rango', '-1.1,-200,-1.0,-80.4'],
    ['demasiado grande (más de 2°)', '-5,-82,-0,-78'],
  ])('una zona %s se ignora', (_nombre, texto) => {
    expect(leerZonaPrueba(texto)).toBeNull();
  });
});

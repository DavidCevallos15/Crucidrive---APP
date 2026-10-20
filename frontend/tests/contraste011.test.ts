import { COLORS } from '../src/constants/theme';
import { COLORES_OFERTA, contraste } from '../src/utils/oferta';
import { COLORES_DESLIZA } from '../src/utils/compacto';
import { COLORES_RESENAS } from '../src/utils/viajeConductor';

/**
 * 011 sobre las pantallas del 005 y del 010: con la paleta clara, los alias `primaryLight`
 * (vino) y `secondary` (crema) dejaron de leerse sobre la tarjeta oscura y sobre blanco.
 * Íconos y bordes: 3:1 (WCAG 1.4.11). Texto: 4,5:1.
 */
describe('011 · contraste de las tarjetas del conductor con la paleta nueva', () => {
  test('el ícono de recogida se distingue sobre la tarjeta oscura (≥ 3:1)', () => {
    expect(contraste(COLORES_OFERTA.origen, COLORES_OFERTA.fondo)).toBeGreaterThanOrEqual(3);
  });

  test('las estrellas y el promedio de «Tus reseñas» se leen sobre blanco (≥ 4,5:1)', () => {
    expect(contraste(COLORES_RESENAS.estrellas, COLORS.glassSurface)).toBeGreaterThanOrEqual(3);
    expect(contraste(COLORES_RESENAS.promedio, COLORS.glassSurface)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(['claro', 'oscuro'] as const)('«Desliza para ver más» (%s) se lee sobre su fondo', (variante) => {
    const c = COLORES_DESLIZA[variante];
    expect(contraste(c.texto, c.pastilla)).toBeGreaterThanOrEqual(4.5);
  });

  test('en las tarjetas oscuras el degradado termina en el color de la tarjeta, no en blanco', () => {
    expect(COLORES_DESLIZA.oscuro.fondo).toBe(COLORES_OFERTA.fondo);
    expect(COLORES_DESLIZA.claro.fondo).toBe(COLORS.glassSurface);
  });
});

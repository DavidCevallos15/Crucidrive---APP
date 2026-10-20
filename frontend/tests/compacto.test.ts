import { altoMaximoHoja, BORDE_HOJA, esCompacta, hayMasAbajo, HOJA_ALTO_MIN, MAPA_VISIBLE_MIN } from '../src/utils/compacto';

describe('interfaz compacta (010, parte A)', () => {
  it('360 × 640, 360 × 800 y 393 × 852 son compactos; 412 × 915 no', () => {
    expect(esCompacta(640)).toBe(true);
    expect(esCompacta(800)).toBe(true);
    expect(esCompacta(852)).toBe(true);
    expect(esCompacta(915)).toBe(false);
  });

  it('la hoja deja al menos el 35 % del alto para el mapa (criterio 2)', () => {
    for (const [alto, barra] of [[640, 0], [640, 133], [915, 0], [915, 109]]) {
      const hoja = altoMaximoHoja(alto, barra);
      const mapa = alto - barra - hoja - BORDE_HOJA;
      if (hoja > HOJA_ALTO_MIN) expect(mapa).toBeGreaterThanOrEqual(alto * MAPA_VISIBLE_MIN);
    }
  });

  it('la hoja nunca baja del mínimo usable', () => {
    expect(altoMaximoHoja(400, 200)).toBe(HOJA_ALTO_MIN);
  });

  it('la hoja avisa que hay más abajo hasta que se llega al fondo (criterios 2 y 3)', () => {
    expect(hayMasAbajo(300, 600, 0)).toBe(true);
    expect(hayMasAbajo(300, 600, 296)).toBe(false);
    expect(hayMasAbajo(300, 300, 0)).toBe(false);
    expect(hayMasAbajo(0, 600, 0)).toBe(false);
  });
});

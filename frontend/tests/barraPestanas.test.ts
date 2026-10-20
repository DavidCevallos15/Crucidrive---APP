import { alturaBarraPestanas, BARRA_PESTANAS_BASE, separacionInferior } from '../src/utils/barraPestanas';

describe('barra de pestañas', () => {
  it('suma lo que ocupa la navegación del sistema', () => {
    expect(alturaBarraPestanas(0)).toBe(BARRA_PESTANAS_BASE);
    expect(alturaBarraPestanas(48)).toBe(BARRA_PESTANAS_BASE + 48);
  });

  it('un inset negativo o inválido no encoge la barra', () => {
    expect(alturaBarraPestanas(-10)).toBe(BARRA_PESTANAS_BASE);
  });

  it('las hojas suben lo que mide la barra solo cuando hay barra (con sesión)', () => {
    expect(separacionInferior(true, 48)).toBe(BARRA_PESTANAS_BASE + 48);
    expect(separacionInferior(false, 48)).toBe(0);
  });
});

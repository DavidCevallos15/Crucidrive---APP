import { ESTILO_MAPA } from '../src/utils/estiloMapa';

describe('mapa: lugares de Google visibles (campo, 20 oct 2026)', () => {
  it('ninguna regla oculta los lugares (restaurantes, tiendas, iglesias)', () => {
    const ocultos = ESTILO_MAPA.filter((r) => r.stylers.some((s) => 'visibility' in s && s.visibility === 'off'));
    expect(ocultos.map((r) => r.featureType)).toEqual(['transit']);
  });
});

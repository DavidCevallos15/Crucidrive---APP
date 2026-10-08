import { regionToBbox } from '../src/utils/mapBbox';
import { LOCATION_CONFIG } from '../src/constants/config';
import { SECTORS } from '../src/constants/sectors';

describe('regionToBbox', () => {
  it('returns west,south,east,north with 5 decimals', () => {
    const bbox = regionToBbox({
      latitude: -0.8425,
      longitude: -80.531,
      latitudeDelta: 0.11,
      longitudeDelta: 0.06,
    });
    expect(bbox).toBe('-80.56100,-0.89750,-80.50100,-0.78750');
  });
});

describe('default map region', () => {
  it('frames every sector (La Boca to La Loma)', () => {
    const r = LOCATION_CONFIG.defaultRegion;
    for (const s of SECTORS) {
      expect(Math.abs(s.center.lat - r.latitude)).toBeLessThanOrEqual(r.latitudeDelta / 2);
      expect(Math.abs(s.center.lng - r.longitude)).toBeLessThanOrEqual(r.longitudeDelta / 2);
    }
  });
});

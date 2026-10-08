import * as sectorsModule from '../src/constants/sectors';
import {
  SECTORS,
  PRICE_PER_PERSON_USD,
  MAX_PASSENGERS,
  calculateFare,
  findNearestSector,
} from '../src/constants/sectors';

describe('sectors constants', () => {
  describe('SECTORS', () => {
    it('should have 6 defined sectors', () => {
      expect(SECTORS).toHaveLength(6);
    });

    it('should have unique sector IDs', () => {
      const ids = SECTORS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have valid coordinate centers for all sectors', () => {
      for (const sector of SECTORS) {
        expect(sector.center.lat).toBeDefined();
        expect(sector.center.lng).toBeDefined();
        expect(typeof sector.center.lat).toBe('number');
        expect(typeof sector.center.lng).toBe('number');
      }
    });

    it('should contain the expected sector IDs', () => {
      const ids = SECTORS.map((s) => s.id);
      expect(ids).toContain('centro');
      expect(ids).toContain('playa');
      expect(ids).toContain('las_gilces');
      expect(ids).toContain('los_arenales');
      expect(ids).toContain('san_jacinto');
      expect(ids).toContain('la_boca');
    });

    it('each sector should have a name and markerColor', () => {
      for (const sector of SECTORS) {
        expect(sector.name.length).toBeGreaterThan(0);
        expect(sector.markerColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('pricing (D-08: 0.50 USD per person)', () => {
    it('charges 0.50 USD per person', () => {
      expect(PRICE_PER_PERSON_USD).toBe(0.5);
    });

    it.each([
      [1, 0.5],
      [2, 1.0],
      [3, 1.5],
      [4, 2.0],
      [7, 3.5],
    ])('%i passenger(s) cost %f USD', (passengers, expected) => {
      expect(calculateFare(passengers)).toBe(expected);
    });

    it.each([0, -3, 1.5, NaN])('falls back to one passenger for invalid count %p', (passengers) => {
      expect(calculateFare(passengers)).toBe(0.5);
    });

    it('does not depend on sectors or distance (no route fare matrix)', () => {
      expect('TARIFFS' in sectorsModule).toBe(false);
      expect('findTariff' in sectorsModule).toBe(false);
    });

    it('allows up to the technical passenger limit', () => {
      expect(MAX_PASSENGERS).toBe(20);
      expect(calculateFare(MAX_PASSENGERS)).toBe(10);
    });
  });

  describe('findNearestSector', () => {
    it('should return centro sector for coordinates near centro', () => {
      const result = findNearestSector(-0.86297781, -80.53690632);
      expect(result.id).toBe('centro');
    });

    it('should return playa sector for coordinates near playa', () => {
      const result = findNearestSector(-0.8652, -80.5422);
      expect(result.id).toBe('playa');
    });

    it('should return las_gilces for coordinates near las_gilces', () => {
      const result = findNearestSector(-0.82141437, -80.52405601);
      expect(result.id).toBe('las_gilces');
    });

    it('should return los_arenales for coordinates near los_arenales', () => {
      const result = findNearestSector(-0.8702, -80.5347);
      expect(result.id).toBe('los_arenales');
    });

    it('should return la_boca for coordinates near la_boca', () => {
      const result = findNearestSector(-0.80147852, -80.52098189);
      expect(result.id).toBe('la_boca');
    });

    it('should return san_jacinto for coordinates near san_jacinto', () => {
      const result = findNearestSector(-0.8782, -80.5307);
      expect(result.id).toBe('san_jacinto');
    });

    it('should return the closest sector even for distant coordinates', () => {
      // Far north - closest to la_boca (most northern sector)
      const result = findNearestSector(-0.7500, -80.5200);
      expect(result.id).toBe('la_boca');
    });

    it('should handle edge case of equidistant points by returning first match', () => {
      // Use exact midpoint between two sectors - should return one of them
      const result = findNearestSector(-0.8641, -80.5396);
      expect(SECTORS.map(s => s.id)).toContain(result.id);
    });

    it('should always return a valid Sector object', () => {
      const result = findNearestSector(0, 0);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('center');
      expect(result).toHaveProperty('markerColor');
    });
  });
});

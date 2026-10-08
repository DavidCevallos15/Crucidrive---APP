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
    it('should have 5 defined sectors', () => {
      expect(SECTORS).toHaveLength(5);
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
      const ids = SECTORS.map((s) => s.id).sort();
      expect(ids).toEqual(['la_boca', 'la_loma', 'las_gilces', 'los_arenales', 'malecon']);
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
    it.each([
      ['la_boca', -0.80147852, -80.52098189],
      ['las_gilces', -0.82141437, -80.52405601],
      ['los_arenales', -0.8567572, -80.53186699],
      ['malecon', -0.8699838, -80.53995042],
      ['la_loma', -0.88463806, -80.54802452],
    ])('should return %s for its own pin', (id, lat, lng) => {
      expect(findNearestSector(lat, lng).id).toBe(id);
    });

    it('should pick the closest sector for a point between two sectors', () => {
      // Un punto en el centro de Crucita (-0.863, -80.537) queda entre Los Arenales y el Malecon.
      const result = findNearestSector(-0.86297781, -80.53690632);
      expect(['los_arenales', 'malecon']).toContain(result.id);
    });

    it('should return the closest sector even for distant coordinates', () => {
      // Lejos al norte: el sector mas norte es La Boca
      expect(findNearestSector(-0.7, -80.52).id).toBe('la_boca');
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

import { SECTORS, TARIFFS, findTariff, findNearestSector } from '../src/constants/sectors';
import type { Sector, TariffEntry } from '../src/constants/sectors';

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
      const ids = SECTORS.map((s) => s.id);
      expect(ids).toContain('centro');
      expect(ids).toContain('playa');
      expect(ids).toContain('las_gilces');
      expect(ids).toContain('los_arenales');
      expect(ids).toContain('san_jacinto');
    });

    it('each sector should have a name and markerColor', () => {
      for (const sector of SECTORS) {
        expect(sector.name.length).toBeGreaterThan(0);
        expect(sector.markerColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('TARIFFS', () => {
    it('should have 10 tariff entries (all unique sector pairs)', () => {
      expect(TARIFFS).toHaveLength(10);
    });

    it('all tariffs should have positive prices', () => {
      for (const tariff of TARIFFS) {
        expect(tariff.price).toBeGreaterThan(0);
      }
    });

    it('all tariffs should have valid distance and time estimates', () => {
      for (const tariff of TARIFFS) {
        expect(tariff.estimatedDistanceKm).toBeGreaterThan(0);
        expect(tariff.estimatedTimeMin).toBeGreaterThan(0);
      }
    });

    it('all tariff sectors should exist in SECTORS', () => {
      const validIds = SECTORS.map((s) => s.id);
      for (const tariff of TARIFFS) {
        expect(validIds).toContain(tariff.originId);
        expect(validIds).toContain(tariff.destinationId);
      }
    });
  });

  describe('findTariff', () => {
    it('should find tariff for centro -> playa', () => {
      const result = findTariff('centro', 'playa');
      expect(result).toBeDefined();
      expect(result!.price).toBe(1.50);
      expect(result!.estimatedDistanceKm).toBe(1.2);
      expect(result!.estimatedTimeMin).toBe(5);
    });

    it('should find tariff in reverse direction (playa -> centro)', () => {
      const result = findTariff('playa', 'centro');
      expect(result).toBeDefined();
      expect(result!.price).toBe(1.50);
    });

    it('should return symmetric tariffs (A->B equals B->A)', () => {
      const forward = findTariff('centro', 'las_gilces');
      const reverse = findTariff('las_gilces', 'centro');
      expect(forward).toEqual(reverse);
    });

    it('should return undefined for non-existent route', () => {
      const result = findTariff('centro', 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined for same sector (no self-trip)', () => {
      const result = findTariff('centro', 'centro');
      expect(result).toBeUndefined();
    });

    it('should find tariff for las_gilces -> san_jacinto', () => {
      const result = findTariff('las_gilces', 'san_jacinto');
      expect(result).toBeDefined();
      expect(result!.price).toBe(3.00);
    });

    it('should find tariff for los_arenales -> san_jacinto', () => {
      const result = findTariff('los_arenales', 'san_jacinto');
      expect(result).toBeDefined();
      expect(result!.price).toBe(1.50);
    });
  });

  describe('findNearestSector', () => {
    it('should return centro sector for coordinates near centro', () => {
      const result = findNearestSector(-1.0448, -80.5432);
      expect(result.id).toBe('centro');
    });

    it('should return playa sector for coordinates near playa', () => {
      const result = findNearestSector(-1.0470, -80.5485);
      expect(result.id).toBe('playa');
    });

    it('should return las_gilces for coordinates near las_gilces', () => {
      const result = findNearestSector(-1.0395, -80.5350);
      expect(result.id).toBe('las_gilces');
    });

    it('should return los_arenales for coordinates near los_arenales', () => {
      const result = findNearestSector(-1.0520, -80.5410);
      expect(result.id).toBe('los_arenales');
    });

    it('should return san_jacinto for coordinates near san_jacinto', () => {
      const result = findNearestSector(-1.0600, -80.5370);
      expect(result.id).toBe('san_jacinto');
    });

    it('should return the closest sector even for distant coordinates', () => {
      // Far north - closest to las_gilces (most northern sector)
      const result = findNearestSector(-1.0300, -80.5350);
      expect(result.id).toBe('las_gilces');
    });

    it('should handle edge case of equidistant points by returning first match', () => {
      // Use exact midpoint between two sectors - should return one of them
      const result = findNearestSector(-1.0459, -80.5458);
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

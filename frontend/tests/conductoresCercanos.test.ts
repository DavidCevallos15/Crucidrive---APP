/**
 * Paso 007 · T7: tricimotos del mapa por marcador efímero, sin datos personales, y caducidad a
 * los 60 s (criterios 3 y 4; plan P4).
 */
import * as fs from 'fs';
import * as path from 'path';
import { useLocationStore, CADUCIDAD_CONDUCTOR_MS, type NearbyDriver } from '../src/store/useLocationStore';

const tricimoto = (marcador: string, lat = -0.87, lng = -80.54): NearbyDriver => ({
  marcador,
  coords: { lat, lng },
  estado: 'disponible',
  lastUpdate: 0,
});

const marcadores = () => [...useLocationStore.getState().nearbyDrivers.keys()].sort();

describe('T7 · tricimotos cercanas por marcador (criterios 3 y 4)', () => {
  beforeEach(() => {
    useLocationStore.setState({ nearbyDrivers: new Map() });
    jest.restoreAllMocks();
  });

  test('la misma tricimoto se mueve en lugar de duplicarse', () => {
    const { updateNearbyDriver } = useLocationStore.getState();
    updateNearbyDriver(tricimoto('a1b2c3d4e5f60718', -0.87, -80.54));
    updateNearbyDriver(tricimoto('a1b2c3d4e5f60718', -0.871, -80.541));
    updateNearbyDriver(tricimoto('ffffeeeeddddcccc'));
    expect(marcadores()).toEqual(['a1b2c3d4e5f60718', 'ffffeeeeddddcccc']);
    expect(useLocationStore.getState().nearbyDrivers.get('a1b2c3d4e5f60718')!.coords).toEqual({ lat: -0.871, lng: -80.541 });
  });

  test('un evento sin marcador (backend viejo) no dibuja nada', () => {
    useLocationStore.getState().updateNearbyDriver({ ...tricimoto(''), marcador: undefined as unknown as string });
    expect(marcadores()).toEqual([]);
  });

  test('una tricimoto sin actualizar durante 60 s sale del mapa', () => {
    const t0 = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(t0);
    useLocationStore.getState().updateNearbyDriver(tricimoto('vieja'));
    jest.spyOn(Date, 'now').mockReturnValue(t0 + 50_000);
    useLocationStore.getState().updateNearbyDriver(tricimoto('reciente'));

    useLocationStore.getState().podarConductores(t0 + CADUCIDAD_CONDUCTOR_MS - 1);
    expect(marcadores()).toEqual(['reciente', 'vieja']);

    useLocationStore.getState().podarConductores(t0 + CADUCIDAD_CONDUCTOR_MS);
    expect(marcadores()).toEqual(['reciente']);
  });

  test('si nada caducó, no se crea un mapa nuevo (no se vuelve a dibujar)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5_000);
    useLocationStore.getState().updateNearbyDriver(tricimoto('x'));
    const antes = useLocationStore.getState().nearbyDrivers;
    useLocationStore.getState().podarConductores(6_000);
    expect(useLocationStore.getState().nearbyDrivers).toBe(antes);
  });

  test('el tipo de la tricimoto no tiene nombre ni id del conductor', () => {
    const fuente = fs.readFileSync(path.join(__dirname, '../src/store/useLocationStore.ts'), 'utf8');
    const tipo = fuente.slice(fuente.indexOf('export interface NearbyDriver'), fuente.indexOf('}', fuente.indexOf('export interface NearbyDriver')));
    expect(tipo).not.toMatch(/nombre|conductorId/);
  });

  test('el mapa del pasajero vacía la lista al cambiar de sector y poda cada 10 s', () => {
    const mapa = fs.readFileSync(path.join(__dirname, '../src/screens/MapScreen.tsx'), 'utf8');
    expect(mapa).toMatch(/clearNearbyDrivers\(\);\s*\n\s*joinSector\(currentSectorId\)/);
    expect(mapa).toMatch(/setInterval\(\(\) => podarConductores\(Date\.now\(\)\), 10_000\)/);
    expect(mapa).toContain('key={driver.marcador}');
    expect(mapa).not.toContain('title={driver.nombre}');
  });
});

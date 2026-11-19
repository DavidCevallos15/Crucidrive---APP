// Spec 018, Enmienda 1: Google Maps en la web con respaldo de OpenStreetMap (criterios 14 y 15).
import * as fs from 'fs';
import * as path from 'path';
import {
  REGION_CRUCITA,
  claveValida,
  eventoToque,
  urlScriptGoogleMaps,
  usarGoogleMaps,
  vistaDesdeRegion,
  zoomDesdeDelta,
} from '../src/utils/mapaWeb';

const CLAVE = 'AIza' + 'x'.repeat(35);

describe('018 · Google Maps en la web', () => {
  test('criterio 15: sin clave o con una clave mal formada se usa el respaldo de OpenStreetMap', () => {
    expect(usarGoogleMaps(undefined)).toBe(false);
    expect(usarGoogleMaps('')).toBe(false);
    expect(usarGoogleMaps('no-es-una-clave')).toBe(false);
    expect(usarGoogleMaps('AIza-corta')).toBe(false);
    expect(claveValida(CLAVE)).toBe(true);
    expect(usarGoogleMaps(CLAVE)).toBe(true);
  });

  test('la URL del script lleva la clave, el callback, carga asíncrona y español de Ecuador', () => {
    const url = new URL(urlScriptGoogleMaps(` ${CLAVE} `, '__listo'));
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(url.searchParams.get('key')).toBe(CLAVE);
    expect(url.searchParams.get('callback')).toBe('__listo');
    expect(url.searchParams.get('loading')).toBe('async');
    expect(url.searchParams.get('language')).toBe('es');
    expect(url.searchParams.get('region')).toBe('EC');
  });

  test('el zoom sale del alto visible (latitudeDelta) y se acota', () => {
    // Crucita completa (~0,11°) en un teléfono: zoom de barrio, como en Android.
    expect(zoomDesdeDelta(0.11, 640)).toBe(13);
    // Un punto del administrador (~0,01°): zoom de calle.
    expect(zoomDesdeDelta(0.01, 640)).toBe(16);
    expect(zoomDesdeDelta(0)).toBe(14);
    expect(zoomDesdeDelta(undefined)).toBe(14);
    expect(zoomDesdeDelta(1e-9)).toBe(20);
    expect(zoomDesdeDelta(500)).toBe(3);
  });

  test('sin región, la vista es el centro de Crucita', () => {
    expect(vistaDesdeRegion(null).center).toEqual({ lat: REGION_CRUCITA.latitude, lng: REGION_CRUCITA.longitude });
  });

  test('el toque tiene la misma forma que en react-native-maps (punto del administrador)', () => {
    expect(eventoToque(-0.87, -80.54)).toEqual({ nativeEvent: { coordinate: { latitude: -0.87, longitude: -80.54 } } });
  });

  test('el componente usa el estilo de Android, vuelve a OpenStreetMap si Google falla y no expone otra clave', () => {
    const fuente = fs.readFileSync(path.join(__dirname, '../src/components/Map.web.tsx'), 'utf8');
    expect(fuente).toContain('styles: ESTILO_MAPA');
    expect(fuente).toContain('gm_authFailure');
    expect(fuente).toMatch(/\.catch\(volverAOsm\)/);
    expect(fuente).toContain('process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY');
    expect(fuente).not.toMatch(/GOOGLE_MAPS_API_KEY/);
  });
});

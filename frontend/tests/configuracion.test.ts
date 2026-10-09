import { variablesFaltantes } from '../src/constants/config';

// Sin @types/node en el frontend: solo lo que usa esta prueba.
declare const __dirname: string;
declare function require(id: string): any;
const fs = require('fs') as { readFileSync: (ruta: string, codificacion: string) => string };
const path = require('path') as { join: (...partes: string[]) => string };

/**
 * El APK preview se cerraba al abrirse: se compiló sin las variables EXPO_PUBLIC_*
 * (el .env no sube a EAS), createClient('') lanzaba al importar y, aunque estuvieran en
 * EAS, config.ts las leía con acceso dinámico, que Expo no incrusta en el bundle.
 */

const COMPLETAS = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  EXPO_PUBLIC_API_BASE_URL: 'https://api.example',
  EXPO_PUBLIC_SOCKET_URL: 'https://api.example',
};

describe('configuración de la app', () => {
  test('con todas las variables no falta ninguna', () => {
    expect(variablesFaltantes(COMPLETAS)).toEqual([]);
  });

  test('nombra las que faltan o están vacías, sin mostrar valores', () => {
    expect(variablesFaltantes({ ...COMPLETAS, EXPO_PUBLIC_SUPABASE_URL: undefined, EXPO_PUBLIC_SOCKET_URL: '' }))
      .toEqual(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SOCKET_URL']);
  });

  test('config.ts lee las variables con acceso literal, el único que Expo incrusta', () => {
    const fuente = fs.readFileSync(path.join(__dirname, '../src/constants/config.ts'), 'utf8');
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/process\.env\[/);
    for (const nombre of Object.keys(COMPLETAS)) {
      expect(codigo).toContain(`process.env.${nombre}`);
    }
  });
});

describe('app.config.js (Google Maps y Firebase)', () => {
  const appConfig = require('../app.config.js') as (c: { config: Record<string, any> }) => Record<string, any>;
  const base = { name: 'CruciDrive', android: { package: 'com.crucidrive.app' }, plugins: ['expo-router'], extra: { eas: { projectId: 'p' } } };
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  test('con GOOGLE_MAPS_API_KEY agrega la clave al manifiesto y habilita el mapa', () => {
    process.env.GOOGLE_MAPS_API_KEY = 'clave-de-prueba';
    const config = appConfig({ config: base });
    expect(config.plugins).toContainEqual(['react-native-maps', { androidGoogleMapsApiKey: 'clave-de-prueba' }]);
    expect(config.extra).toEqual({ eas: { projectId: 'p' }, mapaAndroid: true });
  });

  test('sin la clave no agrega el plugin y el mapa muestra un aviso en vez de cerrar la app', () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const config = appConfig({ config: base });
    expect(config.plugins.some((p: unknown) => Array.isArray(p) && p[0] === 'react-native-maps')).toBe(false);
    expect(config.extra.mapaAndroid).toBe(false);
  });

  test('GOOGLE_SERVICES_JSON de EAS se usa como googleServicesFile', () => {
    process.env.GOOGLE_SERVICES_JSON = '/ruta/eas/google-services.json';
    expect(appConfig({ config: base }).android.googleServicesFile).toBe('/ruta/eas/google-services.json');
  });
});

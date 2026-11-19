// Spec 018: CruciDrive en iPhone como app web instalable. Guía de instalación (criterios 1 y 2, W4),
// conductor en la web (criterio 11, W2), actualizaciones (criterio 3) y publicación (12 y 13).
import * as fs from 'fs';
import * as path from 'path';
import {
  CLAVE_GUIA_CERRADA,
  TEXTO_INSTALAR,
  esIphoneOIpad,
  esSafari,
  estaInstalada,
  guardarGuiaCerrada,
  leerGuiaCerrada,
  pasosInstalar,
  tocaGuiaInstalacion,
  type EntornoNavegador,
} from '../src/utils/instalarIphone';

const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1';
const IPAD_ESCRITORIO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const iphone = (extra: Partial<EntornoNavegador> = {}): EntornoNavegador => ({ userAgent: SAFARI_IPHONE, platform: 'iPhone', maxTouchPoints: 5, ...extra });
const raiz = path.join(__dirname, '..');
const leer = (ruta: string) => fs.readFileSync(path.join(raiz, ruta), 'utf8');

describe('018 · guía de instalación en el iPhone (criterios 1 y 2, W4)', () => {
  test('reconoce iPhone y iPad (también el iPad que dice ser Mac), no Android ni escritorio', () => {
    expect(esIphoneOIpad(iphone())).toBe(true);
    expect(esIphoneOIpad({ userAgent: IPAD_ESCRITORIO, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(esIphoneOIpad({ userAgent: IPAD_ESCRITORIO, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(esIphoneOIpad({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });

  test('sale en un iPhone sin instalar; no si ya se abrió desde el ícono o si la persona la cerró', () => {
    expect(tocaGuiaInstalacion(iphone(), false)).toBe(true);
    expect(tocaGuiaInstalacion(iphone({ standalone: true }), false)).toBe(false);
    expect(tocaGuiaInstalacion(iphone({ pantallaCompleta: true }), false)).toBe(false);
    expect(tocaGuiaInstalacion(iphone(), true)).toBe(false);
    expect(tocaGuiaInstalacion({ userAgent: ANDROID }, false)).toBe(false);
    expect(tocaGuiaInstalacion(null, false)).toBe(false);
  });

  test('estaInstalada solo con standalone o display-mode standalone', () => {
    expect(estaInstalada(iphone())).toBe(false);
    expect(estaInstalada(iphone({ standalone: true }))).toBe(true);
  });

  test('los pasos dicen dónde tocar; fuera de Safari, primero hay que abrirla en Safari', () => {
    expect(esSafari(iphone())).toBe(true);
    expect(esSafari({ userAgent: CHROME_IPHONE })).toBe(false);
    expect(pasosInstalar(iphone())).toEqual(TEXTO_INSTALAR.pasos);
    expect(pasosInstalar(iphone()).join(' ')).toMatch(/Compartir.*Añadir a pantalla de inicio/);
    expect(pasosInstalar({ userAgent: CHROME_IPHONE, platform: 'iPhone' })[0]).toBe(TEXTO_INSTALAR.otroNavegador);
  });

  test('cerrarla se recuerda; sin almacenamiento no falla y la guía vuelve a salir', () => {
    const datos: Record<string, string> = {};
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => datos[k] ?? null, setItem: (k: string, v: string) => { datos[k] = v; } },
    });
    try {
      expect(leerGuiaCerrada()).toBe(false);
      guardarGuiaCerrada();
      expect(datos[CLAVE_GUIA_CERRADA]).toBe('1');
      expect(leerGuiaCerrada()).toBe(true);
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => { throw new Error('SecurityError'); },
      });
      expect(leerGuiaCerrada()).toBe(false);
      expect(() => guardarGuiaCerrada()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  test('la guía está montada en la raíz y en Configuración, solo en la web', () => {
    expect(leer('app/_layout.tsx')).toContain('<AvisoInstalarIphone />');
    expect(leer('src/components/AvisoInstalarIphone.tsx')).toContain("Platform.OS !== 'web'");
    expect(leer('src/screens/SettingsScreen.tsx')).toMatch(/Platform\.OS === 'web' && row\('Instalar en el iPhone'/);
  });

  test('la página se puede agregar a la pantalla de inicio a pantalla completa (criterio 2)', () => {
    const html = leer('public/index.html');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-touch-icon');
    expect(JSON.parse(leer('public/manifest.json'))).toMatchObject({ display: 'standalone', name: 'CruciDrive' });
  });
});

describe('018 · conductor en la web (criterio 11, W2)', () => {
  test('ni la consola ni la verificación se abren en la web: remiten a Android', () => {
    for (const ruta of ['app/(app)/(driver)/_layout.tsx', 'app/(app)/verificacion.tsx']) {
      const fuente = leer(ruta);
      expect(fuente).toMatch(/if \(Platform\.OS === 'web'\) return <ConductorSoloAndroidScreen \/>/);
    }
    expect(TEXTO_INSTALAR.conductor).toMatch(/app de Android/);
    expect(TEXTO_INSTALAR.conductor).toMatch(/pantalla apagada/);
  });
});

describe('018 · publicación (criterios 3, 12 y 13)', () => {
  const vercel = JSON.parse(leer('vercel.json'));
  const cabeceras = (fuente: string) =>
    Object.fromEntries((vercel.headers.find((h: { source: string }) => h.source === fuente)?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]));

  test('compila la web y sirve index.html en cualquier ruta (la app es de una sola página)', () => {
    expect(vercel.buildCommand).toBe('npx expo export --platform web');
    expect(vercel.outputDirectory).toBe('dist');
    expect(vercel.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });

  test('criterio 3: index.html y sw.js se revalidan; los paquetes con hash se guardan para siempre', () => {
    expect(cabeceras('/(.*)')['Cache-Control']).toBe('no-cache');
    expect(cabeceras('/_expo/static/(.*)')['Cache-Control']).toMatch(/immutable/);
    const sw = leer('public/sw.js');
    // La navegación va primero a la red: una versión vieja solo se usa sin conexión.
    expect(sw).toMatch(/request\.mode === 'navigate'[\s\S]*fetch\(request\)[\s\S]*\.catch/);
    expect(sw).toContain("crucidrive-pwa-v3");
  });

  test('cabeceras de seguridad: sin iframes ajenos y la ubicación solo para la propia página', () => {
    const c = cabeceras('/(.*)');
    expect(c['X-Frame-Options']).toBe('DENY');
    expect(c['X-Content-Type-Options']).toBe('nosniff');
    expect(c['Permissions-Policy']).toMatch(/geolocation=\(self\)/);
  });

  test('criterio 13: la app solo lee variables públicas (EXPO_PUBLIC_*), nunca la clave de servicio', () => {
    const fuentes = ['src', 'app'].flatMap(function recorrer(dir: string): string[] {
      return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((e) => {
        const r = path.join(dir, e.name);
        if (e.isDirectory()) return recorrer(r);
        return /\.(ts|tsx)$/.test(e.name) ? [r] : [];
      });
    });
    const todo = fuentes.map(leer).join('\n');
    expect(todo).not.toMatch(/SERVICE_ROLE|service_role/i);
    const variables = new Set(todo.match(/process\.env\.[A-Z_]+/g) ?? []);
    for (const v of variables) expect(v).toMatch(/^process\.env\.(EXPO_PUBLIC_|NODE_ENV)/);
  });
});

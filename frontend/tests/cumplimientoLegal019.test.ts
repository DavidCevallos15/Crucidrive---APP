// Spec 019: Cumplimiento legal previo a Play Store y seguridad web (criterios 1 a 13).
import * as fs from 'fs';
import * as path from 'path';
import { CONSENTIMIENTO, CONSENT_VERSION, TEXTO_ACEPTACION } from '../src/constants/consentimiento';
import { LEGAL_HOLDER, LEGAL_URLS } from '../src/constants/legal';
import {
  WEB_PREFS_STORAGE_KEY,
  WEB_PREFS_TTL_DAYS,
  WEB_PREFS_VERSION,
  allowsGoogleMapsByPreferences,
  buildWebPreferences,
  isPreferenceValid,
  readWebPreferences,
  saveWebPreferences,
  shouldShowWebPreferencesBanner,
  subscribeWebPreferences,
} from '../src/utils/preferenciasWeb';

const frontendRoot = path.join(__dirname, '..');
const repoRoot = path.join(frontendRoot, '..');
const readRepo = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const wordCount = (html: string) => stripHtml(html).split(' ').filter(Boolean).length;

describe('019 · páginas legales públicas HTTPS en web/ (criterios 1 a 5)', () => {
  const privacidad = readRepo('web/privacidad.html');
  const terminos = readRepo('web/terminos.html');
  const reembolsos = readRepo('web/reembolsos.html');
  const eliminar = readRepo('web/eliminar-cuenta.html');
  const inicio = readRepo('web/index.html');

  test('criterio 1: Política de Privacidad ≤ 2000 palabras, con titular, RUC, tabla LOPDP y 911', () => {
    expect(wordCount(privacidad)).toBeGreaterThan(200);
    expect(wordCount(privacidad)).toBeLessThanOrEqual(2000);
    expect(privacidad).toContain(LEGAL_HOLDER.name);
    expect(privacidad).toContain(LEGAL_HOLDER.ruc);
    expect(privacidad).toContain('Crucita');
    expect(privacidad).toContain(LEGAL_HOLDER.supportEmail);
    expect(privacidad).toContain('<table>');
    expect(privacidad).toContain('segundo plano');
    expect(privacidad).toContain('Superintendencia de Protección de Datos Personales');
    expect(privacidad).toContain('/eliminar-cuenta');
    expect(privacidad).toMatch(/(no|ni) sustituye al 911/i);
  });

  test('criterio 2: Términos de Uso ≤ 3000 palabras, intermediación, limitación 100 % y Ecuador', () => {
    expect(wordCount(terminos)).toBeGreaterThan(200);
    expect(wordCount(terminos)).toBeLessThanOrEqual(3000);
    expect(terminos).toContain(LEGAL_HOLDER.ruc);
    expect(terminos).toMatch(/intermediación/i);
    expect(terminos).toContain('100 %');
    expect(terminos).toMatch(/ingeniería inversa/i);
    expect(terminos).toMatch(/no sustituye al 911/i);
    expect(terminos).toContain('Portoviejo');
    expect(terminos).toContain('Ecuador');
  });

  test('criterio 3: Política de Reembolsos cubre efectivo, créditos, cancelación y soporte', () => {
    expect(reembolsos).toContain(LEGAL_HOLDER.ruc);
    expect(reembolsos).toMatch(/efectivo/i);
    expect(reembolsos).toMatch(/pasajero cancela/i);
    expect(reembolsos).toContain('comprobante');
    expect(reembolsos).toContain(LEGAL_HOLDER.supportEmail);
  });

  test('criterio 4: Eliminación de cuenta explica vía app, vía web y plazos por categoría', () => {
    expect(eliminar).toContain('ELIMINAR');
    expect(eliminar).toContain(`mailto:${LEGAL_HOLDER.supportEmail}`);
    expect(eliminar).toContain('<table>');
    expect(eliminar).toContain('30 días');
    expect(eliminar).toContain('14 días');
  });

  test('criterio 5: web/index.html mantiene confirmación de correo y enlaza los 4 documentos legales', () => {
    expect(inicio).toContain('id="confirmado"');
    expect(inicio).toContain('id="vencido"');
    expect(inicio).toContain('href="/privacidad"');
    expect(inicio).toContain('href="/terminos"');
    expect(inicio).toContain('href="/reembolsos"');
    expect(inicio).toContain('href="/eliminar-cuenta"');
  });
});

describe('019 · consentimiento 1.0 y enlaces dentro de la app (criterios 6 a 8)', () => {
  test('criterio 6: versión 1.0 sincronizada entre frontend y backend y sin etiquetas de borrador', () => {
    const backendConsent = readRepo('backend/src/config/consent.js');
    expect(CONSENT_VERSION).toBe('1.1');
    expect(backendConsent).toContain("const CONSENT_VERSION = '1.1'");
    expect(backendConsent).toContain('// @ts-check');
    const joined = CONSENTIMIENTO.map((s) => `${s.titulo} ${s.texto}`).join(' ');
    expect(joined).toContain(LEGAL_HOLDER.name);
    expect(joined).toContain(LEGAL_HOLDER.ruc);
    expect(joined).toContain(LEGAL_HOLDER.supportEmail);
    expect(joined).not.toMatch(/pendiente de revisión legal|borrador/i);
    expect(TEXTO_ACEPTACION).toMatch(/Política de Privacidad.*Términos de Uso/);
  });

  test('criterio 7 y 8: Login, Completa tu perfil y Configuración enlazan documentos y exigen casilla sin premarcar', () => {
    const login = readRepo('frontend/src/screens/LoginScreen.tsx');
    expect(login).toContain('useState(false)');
    expect(login).toContain('<CheckboxRow');
    expect(login).toContain('LEGAL_URLS.privacy');
    expect(login).toContain('LEGAL_URLS.terms');

    const perfil = readRepo('frontend/src/screens/CompleteProfileScreen.tsx');
    expect(perfil).not.toMatch(/Texto en revisión legal/i);
    expect(perfil).toContain('LEGAL_URLS.privacy');
    expect(perfil).toContain('LEGAL_URLS.terms');

    const settings = readRepo('frontend/src/screens/SettingsScreen.tsx');
    expect(settings).not.toMatch(/pendiente de revisión legal/i);
    expect(settings).toContain('LEGAL_URLS.privacy');
    expect(settings).toContain('LEGAL_URLS.terms');
    expect(settings).toContain('LEGAL_URLS.refunds');
    expect(settings).toContain('LEGAL_URLS.deleteAccount');
    expect(settings).toContain('requestOpenWebPreferencesModal');
  });

  test('las URLs legales son HTTPS bajo tricimoto.app', () => {
    for (const url of Object.values(LEGAL_URLS)) {
      expect(url).toMatch(/^https:\/\/tricimoto\.app(\/[a-z-]+)?$/);
    }
  });
});

describe('019 · preferencias de cookies y almacenamiento en la web (criterios 9 a 11)', () => {
  test('construye preferencias con versión 1.0 y caducidad de 180 días', () => {
    const now = new Date('2026-11-25T12:00:00.000Z');
    const prefs = buildWebPreferences(false, now);
    expect(prefs.version).toBe(WEB_PREFS_VERSION);
    expect(prefs.essentials).toBe(true);
    expect(prefs.externalMap).toBe(false);
    expect(prefs.savedAt).toBe('2026-11-25T12:00:00.000Z');
    const diffDays = Math.round((Date.parse(prefs.expiresAt) - now.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(WEB_PREFS_TTL_DAYS);
    expect(isPreferenceValid(prefs, now)).toBe(true);
    expect(shouldShowWebPreferencesBanner(prefs, now)).toBe(false);
  });

  test('una preferencia caducada o con versión vieja vuelve a pedir elección', () => {
    const now = new Date('2026-11-25T12:00:00.000Z');
    const prefs = buildWebPreferences(true, now);
    const afterExpiry = new Date('2027-06-01T12:00:00.000Z');
    expect(isPreferenceValid(prefs, afterExpiry)).toBe(false);
    expect(shouldShowWebPreferencesBanner(prefs, afterExpiry)).toBe(true);
    expect(isPreferenceValid({ ...prefs, version: '0.9' }, now)).toBe(false);
  });

  test('criterio 11: elegir Solo esenciales bloquea Google Maps y notifica suscriptores', () => {
    const store: Record<string, string> = {};
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
      },
    });
    const received: boolean[] = [];
    const unsubscribe = subscribeWebPreferences((p) => received.push(p.externalMap));
    try {
      expect(readWebPreferences()).toBeNull();
      expect(allowsGoogleMapsByPreferences(null)).toBe(true);

      const onlyEssentials = saveWebPreferences(false);
      expect(store[WEB_PREFS_STORAGE_KEY]).toContain('"externalMap":false');
      expect(allowsGoogleMapsByPreferences(onlyEssentials)).toBe(false);
      expect(allowsGoogleMapsByPreferences(readWebPreferences())).toBe(false);

      const accepted = saveWebPreferences(true);
      expect(allowsGoogleMapsByPreferences(accepted)).toBe(true);
      expect(received).toEqual([false, true]);

      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get: () => { throw new Error('SecurityError'); },
      });
      expect(readWebPreferences()).toBeNull();
      expect(() => saveWebPreferences(false)).not.toThrow();
    } finally {
      unsubscribe();
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  test('el modal ofrece las 3 opciones, vive en _layout y Map.web respeta la preferencia', () => {
    const modal = readRepo('frontend/src/components/PreferenciasWebModal.tsx');
    expect(modal).toContain("Platform.OS !== 'web'");
    expect(modal).toContain('Solo esenciales');
    expect(modal).toContain('Personalizar');
    expect(modal).toContain('Aceptar mapa');
    expect(readRepo('frontend/app/_layout.tsx')).toContain('<PreferenciasWebModal />');

    const mapWeb = readRepo('frontend/src/components/Map.web.tsx');
    expect(mapWeb).toContain('allowsGoogleMapsByPreferences');
    expect(mapWeb).toContain('subscribeWebPreferences');
  });
});

describe('019 · cabeceras HSTS/CSP y protección de rutas de desarrollo (criterio 12 y 13)', () => {
  const getHeaders = (file: string) => {
    const cfg = JSON.parse(readRepo(file));
    const entry = cfg.headers.find((h: { source: string }) => h.source === '/(.*)');
    return Object.fromEntries((entry?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]));
  };

  test('criterio 12: web/vercel.json y frontend/vercel.json incluyen HSTS y CSP', () => {
    for (const file of ['web/vercel.json', 'frontend/vercel.json']) {
      const h = getHeaders(file);
      expect(h['Strict-Transport-Security']).toMatch(/max-age=31536000/);
      expect(h['Content-Security-Policy']).toContain("object-src 'none'");
      expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    }
    const appCsp = getHeaders('frontend/vercel.json')['Content-Security-Policy'];
    expect(appCsp).toContain('https://maps.googleapis.com');
    expect(appCsp).toContain('https://www.openstreetmap.org');
  });

  test('criterio 13: diseno.tsx se oculta fuera de __DEV__ y Claude outputs/ está en .gitignore', () => {
    expect(readRepo('frontend/app/diseno.tsx')).toContain('if (!__DEV__)');
    expect(readRepo('.gitignore')).toContain('Claude outputs/');
  });
});

// Vista previa del enlace de la app web al compartirlo (WhatsApp, Facebook, Telegram, X).
// Los rastreadores de esas apps no ejecutan JavaScript: si estas etiquetas salen de
// public/index.html, el enlace vuelve a compartirse sin logo ni título.
import * as fs from 'fs';
import * as path from 'path';

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'public/index.html'), 'utf8');

const meta = (atributo: 'property' | 'name', clave: string): string | undefined =>
  html.match(new RegExp(`<meta ${atributo}="${clave}" content="([^"]+)"`))?.[1];

/** Ancho y alto de un PNG, leídos de su cabecera IHDR. */
const medidasPng = (archivo: string) => {
  const buffer = fs.readFileSync(archivo);
  return { ancho: buffer.readUInt32BE(16), alto: buffer.readUInt32BE(20), bytes: buffer.length };
};

describe('vista previa al compartir la app web', () => {
  test('el HTML estático trae título, descripción y Open Graph', () => {
    expect(html).toMatch(/<title>CruciDrive[^<]*<\/title>/);
    expect(meta('name', 'description')).toBeTruthy();
    expect(meta('property', 'og:title')).toMatch(/CruciDrive/);
    expect(meta('property', 'og:description')).toBeTruthy();
    expect(meta('property', 'og:url')).toBe('https://app.tricimoto.app/');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
  });

  test('la imagen va con URL absoluta https y medidas declaradas', () => {
    expect(meta('property', 'og:image')).toBe('https://app.tricimoto.app/og-image.png');
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
  });

  test('la imagen existe, mide 1200x630 y pesa menos de 300 KB (WhatsApp descarta las pesadas)', () => {
    const { ancho, alto, bytes } = medidasPng(path.join(raiz, 'public/og-image.png'));
    expect({ ancho, alto }).toEqual({ ancho: 1200, alto: 630 });
    expect(bytes).toBeLessThan(300 * 1024);
  });
});

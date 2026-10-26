import { textoActualizacion, type EstadoActualizacion } from '../src/utils/actualizacion';

const base: EstadoActualizacion = {
  habilitadas: true,
  deFabrica: false,
  updateId: '3f9a2b7c-1d4e-4c8a-9b0f-6a5e2d1c0b99',
  creadaEn: new Date('2026-10-26T16:05:30Z'),
  canal: 'preview',
};

describe('008 · qué actualización por aire corre (Acerca de)', () => {
  test('con una actualización: id corto, hora UTC y canal', () => {
    expect(textoActualizacion(base)).toBe('Actualización 3f9a2b7c · 2026-10-26 16:05 UTC · canal preview');
  });

  test('con el código de la instalación lo dice, para saber que aún no llegó ningún cambio', () => {
    expect(textoActualizacion({ ...base, deFabrica: true })).toBe('Código de la instalación · canal preview');
    expect(textoActualizacion({ ...base, updateId: null })).toBe('Código de la instalación · canal preview');
  });

  test('sin actualizaciones (web, desarrollo, Expo Go) no muestra nada', () => {
    expect(textoActualizacion({ ...base, habilitadas: false })).toBe('');
  });

  test('una hora inválida o ausente no rompe el texto', () => {
    expect(textoActualizacion({ ...base, creadaEn: null, canal: null })).toBe('Actualización 3f9a2b7c');
    expect(textoActualizacion({ ...base, creadaEn: new Date('no es fecha') })).toBe('Actualización 3f9a2b7c · canal preview');
  });
});

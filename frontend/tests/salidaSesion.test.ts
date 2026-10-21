import { destinoGuardia, vistaPrivada } from '../src/utils/routing';

/**
 * Cierre de sesión en Android (campo, 21 oct 2026): la app se colgaba o se cerraba en los tres
 * roles. En un mismo instante se desmontaban el mapa, el menú y sus animaciones, y se montaba
 * otro mapa en /explorar. Ahora el layout privado primero cambia a una pantalla de salida sin
 * mapa, con la sesión todavía válida, y solo después la guardia lleva a /explorar.
 */
describe('layout privado durante el cierre de sesión', () => {
  it('sin sesión no monta nada (la guardia del layout raíz redirige)', () => {
    expect(vistaPrivada({ hasSession: false, isSigningOut: false, logoutError: null })).toBe('nada');
    expect(vistaPrivada({ hasSession: false, isSigningOut: true, logoutError: null })).toBe('nada');
  });

  it('mientras se cierra la sesión muestra la pantalla de salida, no el mapa', () => {
    expect(vistaPrivada({ hasSession: true, isSigningOut: true, logoutError: null })).toBe('salida');
  });

  it('si el cierre falla, sigue en la pantalla de salida con el error para reintentar o volver', () => {
    expect(vistaPrivada({ hasSession: true, isSigningOut: false, logoutError: 'sin red' })).toBe('salida');
  });

  it('con sesión y sin cierre en curso monta la app', () => {
    expect(vistaPrivada({ hasSession: true, isSigningOut: false, logoutError: null })).toBe('app');
  });
});

describe('guardia: cerrar sesión desde «Completa tu perfil»', () => {
  const sinSesion = {
    isInitialized: true,
    hasSession: false,
    profileChecked: false,
    rol: null,
    verificationChecked: false,
    verificacion: null,
  } as const;

  it('sin sesión, el formulario de perfil lleva al login en vez de quedarse en el formulario', () => {
    expect(destinoGuardia(['(auth)', 'perfil'], sinSesion)).toBe('/(auth)/login');
  });

  it('el login y la raíz pública siguen accesibles sin sesión', () => {
    expect(destinoGuardia(['(auth)', 'login'], sinSesion)).toBeNull();
    expect(destinoGuardia(['explorar'], sinSesion)).toBeNull();
  });
});

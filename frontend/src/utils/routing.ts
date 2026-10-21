/**
 * Decide a dónde va cada usuario según su rol y el estado de su verificación (spec 002).
 * Funciones puras: se prueban sin montar la app.
 */

export type Rol = 'pasajero' | 'conductor' | 'admin';
export type EstadoVerificacion = 'sin_enviar' | 'pendiente' | 'aprobado' | 'rechazado';

const estaAprobado = (estado: EstadoVerificacion | null) => estado === 'aprobado';

/** Pantalla principal de cada usuario. */
export const rutaInicial = (rol: Rol, verificacion: EstadoVerificacion | null): string => {
  if (rol === 'admin') return '/(app)/(admin)';
  if (rol === 'conductor') return estaAprobado(verificacion) ? '/(app)/(driver)' : '/(app)/verificacion';
  return '/(app)/(passenger)';
};

/**
 * Indica si un usuario con sesión y perfil puede estar en esa ruta del grupo (app).
 * Un conductor sin aprobar solo ve su pantalla de verificación; un pasajero nunca ve el
 * panel de conductor ni el de administrador. Fuera de (app) todo es accesible.
 */
export const rutaPermitida = (
  segmentos: string[],
  rol: Rol,
  verificacion: EstadoVerificacion | null
): boolean => {
  if (segmentos[0] !== '(app)') return true;
  const seccion = segmentos[1];
  if (rol === 'admin') return seccion === '(admin)';
  if (rol === 'conductor') return estaAprobado(verificacion) ? seccion === '(driver)' : seccion === 'verificacion';
  return seccion === '(passenger)';
};

export interface EstadoGuardia {
  isInitialized: boolean;
  hasSession: boolean;
  profileChecked: boolean;
  rol: Rol | null;
  verificationChecked: boolean;
  verificacion: EstadoVerificacion | null;
}

/**
 * Devuelve la ruta a la que debe redirigir el layout raíz, o null si puede quedarse donde está.
 * Con sesión y perfil completos, tanto `(auth)` como la raíz `/` redirigen a la pantalla del rol.
 */
export const destinoGuardia = (segmentos: string[], estado: EstadoGuardia): string | null => {
  if (!estado.isInitialized) return null;
  // Información de cuenta, privacidad y ayuda está disponible también para visitantes.
  if (segmentos[0] === '(settings)') return null;

  const inAuthGroup = segmentos[0] === '(auth)';
  const inAppGroup = segmentos[0] === '(app)';

  if (!estado.hasSession) {
    // La URL / también pertenece al índice privado del pasajero. Indicar el
    // destino público evita resolver de nuevo el privado y redirigir en bucle.
    if (inAppGroup) return '/explorar';
    // «Completa tu perfil» no sirve sin cuenta: al cerrar sesión desde ahí, al login.
    return inAuthGroup && segmentos[1] === 'perfil' ? '/(auth)/login' : null;
  }

  if (!estado.profileChecked) return null;

  if (!estado.rol) {
    return inAuthGroup && segmentos[1] === 'perfil' ? null : '/(auth)/perfil';
  }

  if (estado.rol === 'conductor' && !estado.verificationChecked) return null;

  if (!inAppGroup || !rutaPermitida(segmentos, estado.rol, estado.verificacion)) {
    return rutaInicial(estado.rol, estado.verificacion);
  }
  return null;
};

/**
 * La pantalla de carga inicial solo espera a la sesión guardada y a las fuentes.
 * No usa `isLoading` para no desmontar `<Slot />` durante `signIn` o `signUp`.
 */
export const mostrarCargaInicial = (
  isInitialized: boolean,
  fontsLoaded: boolean,
  hasFontError: boolean
): boolean => !isInitialized || (!fontsLoaded && !hasFontError);


/**
 * Qué muestra el layout privado `(app)` (campo, 21 oct 2026). Mientras se cierra la sesión, o si
 * el cierre falló, se muestra una pantalla de salida sin mapa ni animaciones: así el mapa, el
 * menú y sus animaciones se desmontan con la sesión aún válida, y no en el mismo instante en que
 * se monta otro mapa en /explorar (la app se colgaba o se cerraba en Android).
 */
export const vistaPrivada = (estado: {
  hasSession: boolean;
  isSigningOut: boolean;
  logoutError: string | null;
}): 'nada' | 'salida' | 'app' => {
  if (!estado.hasSession) return 'nada';
  return estado.isSigningOut || estado.logoutError ? 'salida' : 'app';
};

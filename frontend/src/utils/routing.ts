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

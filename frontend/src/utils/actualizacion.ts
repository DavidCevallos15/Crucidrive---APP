/**
 * Qué actualización por aire está corriendo (spec 008, «actualizaciones por aire»). Sin React ni
 * módulos nativos, para poder probarlo. Sirve para que quien prueba pueda comprobar, desde
 * Acerca de, que el teléfono ya tiene el cambio que se publicó.
 */
export interface EstadoActualizacion {
  /** `Updates.isEnabled`: falso en la web, en Expo Go y en desarrollo. */
  habilitadas: boolean;
  /** Verdadero si corre el código que vino dentro de la instalación. */
  deFabrica: boolean;
  updateId: string | null;
  creadaEn: Date | null;
  /** Canal de la compilación («preview» o «production»). */
  canal: string | null;
}

const fechaCorta = (fecha: Date): string =>
  Number.isNaN(fecha.getTime()) ? '' : `${fecha.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** Texto para «Acerca de». Vacío cuando las actualizaciones no existen (web, desarrollo). */
export const textoActualizacion = (e: EstadoActualizacion): string => {
  if (!e.habilitadas) return '';
  const canal = e.canal ? ` · canal ${e.canal}` : '';
  if (e.deFabrica || !e.updateId) return `Código de la instalación${canal}`;
  const cuando = e.creadaEn ? fechaCorta(e.creadaEn) : '';
  return `Actualización ${e.updateId.slice(0, 8)}${cuando ? ` · ${cuando}` : ''}${canal}`;
};

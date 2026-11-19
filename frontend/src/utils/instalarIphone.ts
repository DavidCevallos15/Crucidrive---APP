/**
 * Guía para instalar la app web en el iPhone (spec 018, criterios 1 y 2; W4). Puro, sin React,
 * para probarlo. En el iPhone no hay botón «Instalar»: se agrega desde Safari con «Compartir».
 */

/** Lo que se lee del navegador. Todo opcional: fuera del navegador no hay nada que leer. */
export interface EntornoNavegador {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  /** `navigator.standalone`: solo existe en iOS y es verdadero si se abrió desde el ícono. */
  standalone?: boolean;
  /** `matchMedia('(display-mode: standalone)')`. */
  pantallaCompleta?: boolean;
}

/** iPhone, iPod o iPad. Un iPad moderno dice ser «MacIntel», pero tiene pantalla táctil. */
export const esIphoneOIpad = (e: EntornoNavegador): boolean =>
  /iPhone|iPad|iPod/i.test(e.userAgent) || (e.platform === 'MacIntel' && (e.maxTouchPoints ?? 0) > 1);

/** Ya se abrió desde el ícono de la pantalla de inicio. */
export const estaInstalada = (e: EntornoNavegador): boolean => e.standalone === true || e.pantallaCompleta === true;

/** Safari de verdad: en el iPhone, Chrome y Firefox se identifican con CriOS y FxiOS. */
export const esSafari = (e: EntornoNavegador): boolean =>
  /Safari/i.test(e.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(e.userAgent);

/** La guía sale en un iPhone que todavía no la instaló, si la persona no la cerró antes. */
export const tocaGuiaInstalacion = (e: EntornoNavegador | null, cerrada: boolean): boolean =>
  Boolean(e && esIphoneOIpad(e) && !estaInstalada(e) && !cerrada);

export const TEXTO_INSTALAR = {
  titulo: 'Instala CruciDrive en tu iPhone',
  pasos: [
    'Toca Compartir (el cuadrado con la flecha hacia arriba) en la barra de Safari.',
    'Elige «Añadir a pantalla de inicio».',
    'Toca «Añadir». CruciDrive queda como una app, con su ícono.',
  ],
  otroNavegador: 'Abre esta página en Safari para poder instalarla.',
  cerrar: 'Entendido',
  /** Por qué el modo conductor no está en el iPhone (W2). */
  conductor: 'Para recibir viajes necesitas la app de Android. El iPhone no deja que una página web comparta tu ubicación con la pantalla apagada, así que no te llegarían las ofertas.',
} as const;

/** Pasos para mostrar según el navegador: fuera de Safari, primero hay que abrirla en Safari. */
export const pasosInstalar = (e: EntornoNavegador | null): string[] =>
  e && esIphoneOIpad(e) && !esSafari(e) ? [TEXTO_INSTALAR.otroNavegador, ...TEXTO_INSTALAR.pasos] : [...TEXTO_INSTALAR.pasos];

export const CLAVE_GUIA_CERRADA = 'crucidrive.guiaInstalarCerrada';

/** Lee el navegador actual; null fuera de la web. */
export const leerEntorno = (): EntornoNavegador | null => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
  const nav = navigator as Navigator & { standalone?: boolean };
  let pantallaCompleta = false;
  try {
    pantallaCompleta = Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
  } catch {
    pantallaCompleta = false;
  }
  return {
    userAgent: nav.userAgent ?? '',
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: nav.standalone,
    pantallaCompleta,
  };
};

/** El almacenamiento puede faltar o fallar (modo privado): sin él, la guía se muestra. */
export const leerGuiaCerrada = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(CLAVE_GUIA_CERRADA) === '1';
  } catch {
    return false;
  }
};

export const guardarGuiaCerrada = (): void => {
  try {
    globalThis.localStorage?.setItem(CLAVE_GUIA_CERRADA, '1');
  } catch {
    // Sin almacenamiento, la guía vuelve a salir la próxima vez; no es un error para la persona.
  }
};

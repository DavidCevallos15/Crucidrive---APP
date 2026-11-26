/**
 * Datos legales del responsable y URLs públicas HTTPS de CruciDrive (spec 019).
 * Módulo puro sin dependencias de React Native para poder importarlo en constantes y tests.
 */
export const LEGAL_HOLDER = {
  name: 'David Cevallos',
  ruc: '1350766547001',
  address: 'Crucita, Portoviejo, Manabí, Ecuador',
  supportEmail: 'soporte@tricimoto.app',
} as const;

export const LEGAL_URLS = {
  base: 'https://tricimoto.app',
  privacy: 'https://tricimoto.app/privacidad',
  terms: 'https://tricimoto.app/terminos',
  refunds: 'https://tricimoto.app/reembolsos',
  deleteAccount: 'https://tricimoto.app/eliminar-cuenta',
} as const;

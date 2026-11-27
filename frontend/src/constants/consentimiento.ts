import { LEGAL_HOLDER, LEGAL_URLS } from './legal';

/**
 * Texto de consentimiento y aviso de privacidad (LOPDP Ecuador, spec 002 y spec 019).
 * Versión 1.1 (020, créditos de conductores): debe coincidir con specs/002-identidad/consentimiento-lopdp.md,
 * https://tricimoto.app/privacidad y CONSENT_VERSION del backend.
 */
export const CONSENT_VERSION = '1.1';

export interface SeccionConsentimiento {
  titulo: string;
  texto: string;
}

export const CONSENTIMIENTO: SeccionConsentimiento[] = [
  {
    titulo: 'Responsable y contacto',
    texto: `Responsable: ${LEGAL_HOLDER.name} (RUC ${LEGAL_HOLDER.ruc}), domiciliado en ${LEGAL_HOLDER.address}. Consultas de privacidad y soporte: ${LEGAL_HOLDER.supportEmail}. Documentos completos disponibles en ${LEGAL_URLS.privacy} y ${LEGAL_URLS.terms}.`,
  },
  {
    titulo: 'Encomiendas y datos de entrega',
    texto:
      'Si solicitas una encomienda, guardamos su descripción y el nombre de quien recibe. Debes tener autorización para compartir esos datos. Solo tu cuenta, el conductor asignado después de aceptar y los administradores pueden consultarlos. El precio se acuerda directamente por el chat antes de entregar el paquete; no envíes objetos ilícitos ni peligrosos.',
  },
  {
    titulo: 'Qué datos recogemos y para qué',
    texto:
      'Tu nombre, teléfono y correo para crear tu cuenta y comunicarte con el conductor o el pasajero. Tu ubicación mientras pides o das un viaje, para mostrar tricimotos cercanas, asignar el viaje y atender una emergencia. Si eres conductor, tu ubicación también mientras estás disponible, aunque la app esté en segundo plano o la pantalla bloqueada (un aviso permanente en el teléfono lo indica); se detiene al ponerte no disponible o cerrar sesión. El identificador de tu teléfono para avisarte de viajes con la app cerrada; se borra al cerrar sesión. Los mensajes del chat del viaje. Si eres conductor, también tu cédula y fotos tuyas, de tu cédula y de tu tricimoto, para verificar tu identidad y aprobarte, y tus movimientos de créditos (recargas con su canal y número de comprobante, comisiones, devoluciones y bonos) para llevar tu saldo.',
  },
  {
    titulo: 'Quién puede verlos',
    texto:
      'El conductor o pasajero de tu viaje ve solo tu nombre y teléfono (y la placa del conductor) únicamente mientras el servicio está activo. Durante el viaje, el pasajero ve en el mapa dónde viene su conductor; nadie más lo ve. Los administradores de CruciDrive ven lo necesario para operar. La cédula y las fotos solo las ven el propio conductor y los administradores. Usamos Supabase para guardar los datos, Microsoft Azure para el servidor API, Google Maps para el mapa, Brevo para correos de verificación y Expo junto a Google (Firebase) para los avisos al teléfono, que no llevan el nombre, el teléfono ni la ubicación del pasajero. Del conductor solo guardamos su última posición, no un historial de recorridos. No vendemos tus datos ni usamos cookies publicitarias ni de analítica.',
  },
  {
    titulo: 'Cuánto tiempo los guardamos',
    texto:
      'Mientras tengas la cuenta activa y hasta 12 meses después de cerrarla por seguridad o exigencia legal. La cédula y las fotos de un conductor rechazado o dado de baja se borran en un máximo de 30 días. Los registros técnicos de acceso del servidor (sin nombres ni teléfonos) se conservan 14 días. Si eliminas tu cuenta de conductor, tus movimientos de créditos quedan sin tu identidad para la contabilidad y guardamos solo una huella (hash) de tu cédula, no la cédula, para no entregar el bono de bienvenida dos veces.',
  },
  {
    titulo: 'Tus derechos',
    texto: `Puedes pedir acceso, rectificación, eliminación, oposición, limitación y portabilidad de tus datos, y retirar este consentimiento en cualquier momento desde Configuración → Mi cuenta, en ${LEGAL_URLS.deleteAccount} o escribiendo a ${LEGAL_HOLDER.supportEmail}. También puedes reclamar ante la Superintendencia de Protección de Datos Personales del Ecuador.`,
  },
  {
    titulo: 'El 911',
    texto: 'El botón SOS abre una llamada al 911. CruciDrive no sustituye al 911.',
  },
];

export const TEXTO_ACEPTACION = 'He leído y acepto la Política de Privacidad y los Términos de Uso';

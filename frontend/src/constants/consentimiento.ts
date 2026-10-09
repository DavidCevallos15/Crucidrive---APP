/**
 * Texto de consentimiento y aviso de privacidad (LOPDP).
 * Versión 0.2, BORRADOR pendiente de revisión legal: debe coincidir con
 * specs/002-identidad/consentimiento-lopdp.md y con CONSENT_VERSION del backend.
 */
export const CONSENT_VERSION = '0.2';

export interface SeccionConsentimiento {
  titulo: string;
  texto: string;
}

export const CONSENTIMIENTO: SeccionConsentimiento[] = [
  {
    titulo: 'Qué datos recogemos y para qué',
    texto:
      'Tu nombre, teléfono y correo para crear tu cuenta y comunicarte con el conductor o el pasajero. Tu ubicación mientras pides o das un viaje, para mostrar tricimotos cercanas, asignar el viaje y atender una emergencia. Si eres conductor, tu ubicación también mientras estás disponible, aunque la app esté en segundo plano o la pantalla bloqueada (un aviso permanente en el teléfono lo indica); se detiene al ponerte no disponible o cerrar sesión. El identificador de tu teléfono para avisarte de viajes con la app cerrada; se borra al cerrar sesión. Los mensajes del chat del viaje. Si eres conductor, también tu cédula y fotos tuyas, de tu cédula y de tu tricimoto, para verificar tu identidad y aprobarte.',
  },
  {
    titulo: 'Quién puede verlos',
    texto:
      'El conductor o pasajero de tu viaje ve solo tu nombre y teléfono (y la placa del conductor). Durante el viaje, el pasajero ve en el mapa dónde viene su conductor; nadie más lo ve. Los administradores de CruciDrive ven lo necesario para operar. La cédula y las fotos solo las ven el propio conductor y los administradores. Usamos Supabase para guardar los datos, Google Maps para el mapa, y Expo y Google (Firebase) para los avisos al teléfono, que no llevan el nombre, el teléfono ni la ubicación del pasajero. Del conductor solo guardamos su última posición, no un historial de recorridos. No vendemos tus datos ni los usamos para publicidad.',
  },
  {
    titulo: 'Cuánto tiempo los guardamos',
    texto:
      'Mientras tengas la cuenta activa y un plazo después de cerrarla, salvo que la ley exija otra cosa. La cédula y las fotos de un conductor rechazado o dado de baja se borran a los 30 días.',
  },
  {
    titulo: 'Tus derechos',
    texto:
      'Puedes pedir acceso, rectificación, eliminación, oposición, limitación y portabilidad de tus datos, y retirar este consentimiento, en cualquier momento. También puedes reclamar ante la Superintendencia de Protección de Datos Personales.',
  },
  {
    titulo: 'El 911',
    texto: 'El botón SOS abre una llamada al 911. CruciDrive no sustituye al 911.',
  },
];

export const TEXTO_ACEPTACION = 'He leído y acepto el tratamiento de mis datos personales';

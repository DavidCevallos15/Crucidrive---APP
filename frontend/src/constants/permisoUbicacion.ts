/**
 * Textos de la explicación previa al permiso de ubicación en segundo plano (paso 004,
 * criterio 5, P19) y del aviso cuando no se concede (criterio 4). Google Play exige que la
 * explicación diga qué se usa, para qué y cuándo se detiene, antes del diálogo del sistema.
 */
export const PERMISO_UBICACION = {
  titulo: 'Recibe viajes con la pantalla apagada',
  puntos: [
    {
      icono: 'location',
      texto: 'Qué usamos: tu ubicación mientras estás disponible o en un viaje, también con la app en segundo plano o la pantalla bloqueada.',
    },
    {
      icono: 'car',
      texto: 'Para qué: ofrecerte los viajes más cercanos y que tu pasajero vea por dónde vienes. Solo guardamos tu última posición.',
    },
    {
      icono: 'power',
      texto: 'Cuándo se detiene: al ponerte no disponible o cerrar sesión. Mientras tanto verás un aviso permanente en el teléfono.',
    },
  ],
  indicacion: 'En la siguiente pantalla elige "Permitir todo el tiempo".',
  continuar: 'Continuar',
  ahoraNo: 'Ahora no',
} as const;

export const AVISO_SEGUIMIENTO = {
  solo_abierta: {
    texto: 'Solo recibirás ofertas con la app abierta. Para recibirlas con la pantalla apagada, permite la ubicación "todo el tiempo".',
    accion: 'Abrir ajustes',
  },
  sin_ubicacion: {
    texto: 'Sin permiso de ubicación no puedes recibir viajes. Actívalo en los ajustes de la app.',
    accion: 'Abrir ajustes',
  },
} as const;

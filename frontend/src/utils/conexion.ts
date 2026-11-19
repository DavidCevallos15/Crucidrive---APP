/**
 * Estado «sin internet» del pasajero (017, P1). Sin React, para poder probarlo.
 *
 * Se mide con el socket que la app ya mantiene con el servidor: sin megas, Android sigue
 * diciendo «conectado a la red móvil», y lo que importa es llegar a CruciDrive. La gracia
 * evita que el aviso parpadee al abrir la app, mientras el socket todavía conecta.
 */
export const GRACIA_SIN_INTERNET_MS = 6000;

export interface EstadoConexion {
  /** Sin sesión no hay socket ni se puede pedir: no se muestra el aviso. */
  conSesion: boolean;
  conectado: boolean;
  /** Desde cuándo (ms) el socket no está conectado; null si está conectado. */
  desconectadoDesde: number | null;
  ahora: number;
}

export const estaSinInternet = (
  { conSesion, conectado, desconectadoDesde, ahora }: EstadoConexion,
  graciaMs: number = GRACIA_SIN_INTERNET_MS
): boolean => conSesion && !conectado && desconectadoDesde !== null && ahora - desconectadoDesde >= graciaMs;

/** Aviso siempre visible mientras no haya conexión (regla 6; 017, criterio 2). */
export const TEXTO_SIN_INTERNET = {
  titulo: 'Sin internet',
  detalle: 'Revisa tus datos o megas',
  /** Para el lector de pantalla; en la leyenda va `planoCorto`, que cabe en 360 px. */
  plano: 'Plano simple de Crucita. El mapa vuelve cuando haya señal.',
  planoCorto: 'Plano aproximado',
} as const;

/** Pedido sin respuesta (017, criterio 3). Reintentar no duplica: lo impide la BD (0012). */
export const TEXTO_NO_SE_PUDO_ENVIAR = {
  titulo: 'No se pudo enviar',
  mensaje: 'No llegó la respuesta de CruciDrive. Revisa tus datos o megas y vuelve a intentarlo: si tu pedido ya había llegado, no se crea otro viaje.',
  reintentar: 'Reintentar',
  cerrar: 'Cerrar',
} as const;

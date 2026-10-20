/**
 * Medidas de la barra de pestañas (pasajero y conductor). La barra es `position: absolute`:
 * no reserva espacio, así que lo que va pegado abajo (hojas del mapa, caja del chat) debe
 * subir lo que ella mide. Con navegación de 3 botones de Android, la barra además tiene que
 * crecer lo que ocupa el sistema, o sus etiquetas quedan debajo.
 */
export const BARRA_PESTANAS_BASE = 85;

/** Alto de la barra: la base más el espacio que el sistema ocupa abajo. */
export const alturaBarraPestanas = (insetInferior: number): number =>
  BARRA_PESTANAS_BASE + Math.max(0, insetInferior);

/** Lo que una hoja pegada abajo debe separarse del borde: la barra, si hay sesión; si no, nada. */
export const separacionInferior = (conBarra: boolean, insetInferior: number): number =>
  conBarra ? alturaBarraPestanas(insetInferior) : 0;

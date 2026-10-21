/** Borde reservado al menú: los gestos del resto del mapa no participan. */
export const BORDE_MENU = 24;

export function abrirTrasDeslizar(distancia: number, velocidad: number): boolean {
  'worklet';
  return distancia >= 48 || (distancia >= 18 && velocidad >= 600);
}

export function cerrarTrasDeslizar(distancia: number, velocidad: number, ancho: number): boolean {
  'worklet';
  return distancia <= -ancho * 0.3 || (distancia <= -18 && velocidad <= -600);
}

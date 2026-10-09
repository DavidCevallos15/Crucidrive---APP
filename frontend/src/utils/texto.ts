/**
 * Minúsculas, sin tildes y con espacios simples. Es la misma regla que private.normalizar
 * en la BD (0011), así lo que la app decide buscar coincide con lo que la BD compara.
 */
export const normalizar = (texto: string | null | undefined): string =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Límites de buscar_lugares (0011): al menos 2 letras y como mucho 80. */
export const MIN_BUSQUEDA = 2;
export const MAX_BUSQUEDA = 80;

export const puedeBuscar = (texto: string): boolean => {
  const n = normalizar(texto);
  return n.length >= MIN_BUSQUEDA && n.length <= MAX_BUSQUEDA;
};

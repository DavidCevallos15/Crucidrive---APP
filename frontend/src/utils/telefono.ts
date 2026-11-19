/**
 * El teléfono de la otra parte llega de `telefono_contraparte` (0018, paso 007): un texto mientras
 * el viaje está aceptado o en curso, y null en cualquier otro caso o si la llamada falla.
 */
export const textoONulo = (valor: unknown): string | null =>
  typeof valor === 'string' && valor.trim() !== '' ? valor : null;

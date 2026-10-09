/** Minúsculas, sin tildes y con espacios simples (igual que private.normalizar en la BD). */
const normalizar = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

module.exports = { normalizar };

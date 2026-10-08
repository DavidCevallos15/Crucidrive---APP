/**
 * Validaciones de entrada compartidas por REST y sockets.
 * Deben coincidir con los CHECK de supabase/migrations (la BD es la última barrera).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOMBRE_RE = /^[\p{L}\s.'-]{2,100}$/u;
const TELEFONO_RE = /^\+?[0-9]{7,15}$/;
// Igual que el CHECK de tricimotos.placa. El formato exacto de placas de
// tricimoto se confirmará en campo (paso 0) antes de endurecerlo.
const PLACA_RE = /^[A-Z0-9-]{3,10}$/;
const SECTOR_RE = /^[a-z0-9_]{1,40}$/;
const MAX_MENSAJE = 1000;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const isSectorId = (v) => typeof v === 'string' && SECTOR_RE.test(v);

const normalizarNombre = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const normalizarTelefono = (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : '');
const normalizarPlaca = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : '');

module.exports = {
  MAX_MENSAJE,
  isUuid,
  isSectorId,
  isNombreValido: (v) => NOMBRE_RE.test(v),
  isTelefonoValido: (v) => TELEFONO_RE.test(v),
  isPlacaValida: (v) => PLACA_RE.test(v),
  normalizarNombre,
  normalizarTelefono,
  normalizarPlaca,
};

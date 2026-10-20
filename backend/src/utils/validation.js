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
const CEDULA_RE = /^[0-9]{10}$/;
const MAX_MENSAJE = 1000;
const MOTIVO_MIN = 3;
const MOTIVO_MAX = 300;
const MAX_DESCRIPCION = 200;
// Igual que el CHECK de lugares.categoria (0011).
const CATEGORIAS_LUGAR = ['comida', 'hospedaje', 'tienda', 'salud', 'educacion', 'religion',
  'gobierno', 'turismo', 'transporte', 'poblado', 'otro'];
const NOMBRE_LUGAR_MIN = 2;
const NOMBRE_LUGAR_MAX = 120;
// Barrera técnica anti-abuso; la regla de negocio no fija capacidad (D-08).
const MAX_PASAJEROS = 20;
// Igual que el CHECK de viajes.motivo_cancelacion (0017, criterio 8 del 005).
const MOTIVOS_CANCELACION = ['ya_no_lo_necesito', 'tarda_demasiado', 'no_encuentro_al_pasajero', 'otro'];
const COMENTARIO_MAX = 280;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const isSectorId = (v) => typeof v === 'string' && SECTOR_RE.test(v);
const isPasajerosValido = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_PASAJEROS;

/**
 * Cédula ecuatoriana: 10 dígitos, provincia 01-24 o 30, tercer dígito menor a 6 y
 * dígito verificador por módulo 10. Evita errores de digitación y datos basura.
 */
const isCedulaValida = (v) => {
  if (typeof v !== 'string' || !CEDULA_RE.test(v)) return false;
  const provincia = Number(v.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(v[2]) > 5) return false;
  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    let n = Number(v[i]) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    suma += n;
  }
  return (10 - (suma % 10)) % 10 === Number(v[9]);
};
const isCategoriaLugar = (v) => CATEGORIAS_LUGAR.includes(v);
const isNombreLugarValido = (v) => typeof v === 'string' && v.length >= NOMBRE_LUGAR_MIN && v.length <= NOMBRE_LUGAR_MAX;
const isMotivoValido = (v) => typeof v === 'string' && v.length >= MOTIVO_MIN && v.length <= MOTIVO_MAX;
const isMotivoCancelacion = (v) => MOTIVOS_CANCELACION.includes(v);
const isEstrellas = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

/**
 * Comentario de una calificación (005, criterio 19). Igual que el CHECK de
 * calificaciones.comentario (0017): sin enlaces ni teléfonos (7 o más dígitos, aunque vayan
 * separados). Devuelve el mensaje para el usuario o null si es válido; vacío = sin comentario.
 */
const errorComentario = (v) => {
  if (v == null) return null;
  if (typeof v !== 'string') return 'El comentario no es válido.';
  const texto = v.trim();
  if (texto === '') return null;
  if (texto.length > COMENTARIO_MAX) return `El comentario no puede superar ${COMENTARIO_MAX} caracteres.`;
  if (/(https?:\/\/|www\.)/i.test(texto)) return 'El comentario no puede tener enlaces.';
  if (/[0-9]{7,}/.test(texto.replace(/[\s.-]/g, ''))) return 'El comentario no puede tener números de teléfono.';
  return null;
};

const normalizarCedula = (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : '');
const normalizarNombre = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const normalizarTelefono = (v) => (typeof v === 'string' ? v.replace(/[\s-]/g, '') : '');
// Texto libre opcional (referencia de origen/destino): sin saltos de línea; '' si no hay.
const normalizarDescripcion = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');
const normalizarPlaca = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : '');

module.exports = {
  CATEGORIAS_LUGAR,
  NOMBRE_LUGAR_MAX,
  isCategoriaLugar,
  isNombreLugarValido,
  MAX_MENSAJE,
  MOTIVO_MIN,
  MOTIVO_MAX,
  MAX_DESCRIPCION,
  MAX_PASAJEROS,
  MOTIVOS_CANCELACION,
  COMENTARIO_MAX,
  isMotivoCancelacion,
  isEstrellas,
  errorComentario,
  isUuid,
  isSectorId,
  isPasajerosValido,
  isCedulaValida,
  isMotivoValido,
  normalizarCedula,
  normalizarDescripcion,
  isNombreValido: (v) => NOMBRE_RE.test(v),
  isTelefonoValido: (v) => TELEFONO_RE.test(v),
  isPlacaValida: (v) => PLACA_RE.test(v),
  normalizarNombre,
  normalizarTelefono,
  normalizarPlaca,
};

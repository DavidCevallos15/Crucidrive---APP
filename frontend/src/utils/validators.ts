/**
 * Validaciones de formularios. Cada función devuelve un mensaje de error en español
 * o null si el valor es válido. Reglas iguales a las del backend (backend/src/utils/validation.js)
 * y de la BD, que siguen siendo la última barrera.
 */

/** Longitud mínima de contraseña (spec 002, criterio 7). Supabase Auth también la exige. */
export const PASSWORD_MIN = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOMBRE_RE = /^[\p{L}\s.'-]{2,100}$/u;
const TELEFONO_RE = /^\+?[0-9]{7,15}$/;
const PLACA_RE = /^[A-Z0-9-]{3,10}$/;
const CEDULA_RE = /^[0-9]{10}$/;

export const normalizarEmail = (v: string): string => v.trim().toLowerCase();
export const normalizarNombre = (v: string): string => v.trim().replace(/\s+/g, ' ');
export const normalizarTelefono = (v: string): string => v.replace(/[\s-]/g, '');
export const normalizarPlaca = (v: string): string => v.trim().toUpperCase();
export const normalizarCedula = (v: string): string => v.replace(/[\s-]/g, '');

export const validarEmail = (v: string): string | null => {
  if (!v.trim()) return 'Escribe tu correo.';
  return EMAIL_RE.test(normalizarEmail(v)) ? null : 'El correo no tiene un formato válido.';
};

export const validarPassword = (v: string): string | null => {
  if (!v) return 'Escribe tu contraseña.';
  return v.length >= PASSWORD_MIN ? null : `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
};

export const validarNombre = (v: string): string | null => {
  if (!normalizarNombre(v)) return 'Escribe tu nombre.';
  return NOMBRE_RE.test(normalizarNombre(v)) ? null : 'El nombre debe tener entre 2 y 100 letras.';
};

export const validarTelefono = (v: string): string | null => {
  if (!normalizarTelefono(v)) return 'Escribe tu teléfono.';
  return TELEFONO_RE.test(normalizarTelefono(v)) ? null : 'El teléfono debe tener entre 7 y 15 dígitos.';
};

export const validarPlaca = (v: string): string | null => {
  if (!normalizarPlaca(v)) return 'Escribe la placa de tu tricimoto.';
  return PLACA_RE.test(normalizarPlaca(v))
    ? null
    : 'La placa solo puede tener letras, números y guiones (3 a 10 caracteres).';
};

/**
 * Cédula ecuatoriana: 10 dígitos, provincia 01-24 o 30, tercer dígito menor a 6 y
 * dígito verificador por módulo 10.
 */
export const esCedulaValida = (valor: string): boolean => {
  const v = normalizarCedula(valor);
  if (!CEDULA_RE.test(v)) return false;
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

export const validarCedula = (v: string): string | null => {
  if (!normalizarCedula(v)) return 'Escribe tu número de cédula.';
  return esCedulaValida(v) ? null : 'La cédula no es válida. Revisa los 10 dígitos.';
};

export const validarMotivo = (v: string): string | null => {
  const t = v.trim();
  return t.length >= 3 && t.length <= 300 ? null : 'El motivo debe tener entre 3 y 300 caracteres.';
};

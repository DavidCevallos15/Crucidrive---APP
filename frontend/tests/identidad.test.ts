/**
 * Paso 002: validaciones de formularios, reducción de fotos y enrutamiento por rol.
 * Criterios de la spec: 6 (fotos ligeras), 7 (contraseña de 8), 8 (sesión), 5 y 9 (quién ve qué).
 */
import {
  PASSWORD_MIN,
  esCedulaValida,
  validarCedula,
  validarEmail,
  validarMotivo,
  validarNombre,
  validarPassword,
  validarPlaca,
  validarTelefono,
  normalizarCedula,
  normalizarEmail,
  normalizarPlaca,
} from '../src/utils/validators';
import { rutaInicial, rutaPermitida } from '../src/utils/routing';
import { CONSENT_VERSION, CONSENTIMIENTO } from '../src/constants/consentimiento';
import { useAuthStore } from '../src/store/useAuthStore';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
// eslint-disable-next-line import/first
import { manipulateAsync } from 'expo-image-manipulator';
// eslint-disable-next-line import/first
import {
  CALIDAD_JPEG,
  LADO_MAXIMO_PX,
  TAMANO_MAXIMO_BYTES,
  dimensionesReducidas,
  reducirFoto,
} from '../src/utils/imagen';

describe('contraseña (criterio 7)', () => {
  it(`exige al menos ${PASSWORD_MIN} caracteres`, () => {
    expect(validarPassword('1234567')).toMatch(/al menos 8/);
    expect(validarPassword('12345678')).toBeNull();
  });

  it('pide la contraseña si está vacía', () => {
    expect(validarPassword('')).toMatch(/Escribe tu contraseña/);
  });
});

describe('correo', () => {
  it.each(['a@b.co', 'maria.alcivar@utm.edu.ec', 'x+y@correo.com'])('acepta %s', (e) => {
    expect(validarEmail(e)).toBeNull();
  });

  it.each(['', 'sin-arroba', 'a@b', '@b.com', 'a b@c.com'])('rechaza "%s"', (e) => {
    expect(validarEmail(e)).not.toBeNull();
  });

  it('normaliza a minúsculas y sin espacios', () => {
    expect(normalizarEmail('  Maria@UTM.edu.ec ')).toBe('maria@utm.edu.ec');
  });
});

describe('datos del perfil', () => {
  it('valida nombre, teléfono y placa con las reglas de la BD', () => {
    expect(validarNombre('María Alcívar')).toBeNull();
    expect(validarNombre('A')).not.toBeNull();
    expect(validarNombre('<script>')).not.toBeNull();
    expect(validarTelefono('099 123-4567')).toBeNull();
    expect(validarTelefono('099-ABC')).not.toBeNull();
    expect(validarPlaca(' abc-123 ')).toBeNull();
    expect(validarPlaca('AB$12')).not.toBeNull();
    expect(normalizarPlaca(' abc-123 ')).toBe('ABC-123');
  });

  it('el motivo de rechazo tiene entre 3 y 300 caracteres', () => {
    expect(validarMotivo('ab')).not.toBeNull();
    expect(validarMotivo('La foto no se lee')).toBeNull();
    expect(validarMotivo('x'.repeat(301))).not.toBeNull();
  });
});

describe('cédula ecuatoriana', () => {
  it('acepta una cédula con dígito verificador correcto, con o sin guiones', () => {
    expect(esCedulaValida('1710034065')).toBe(true);
    expect(esCedulaValida('171003-4065')).toBe(true);
    expect(validarCedula('1710034065')).toBeNull();
  });

  it.each(['1710034066', '0000000000', '9910034065', '1760034065', '171003406', '17100340a5'])(
    'rechaza %s',
    (c) => {
      expect(esCedulaValida(c)).toBe(false);
      expect(validarCedula(c)).not.toBeNull();
    }
  );

  it('normaliza espacios y guiones', () => {
    expect(normalizarCedula(' 171003-4065 ')).toBe('1710034065');
  });
});

describe('reducción de fotos (criterio 6)', () => {
  it('no toca una imagen que ya cabe', () => {
    expect(dimensionesReducidas(1200, 900)).toBeNull();
    expect(dimensionesReducidas(LADO_MAXIMO_PX, 720)).toBeNull();
  });

  it('reduce una foto de teléfono al lado largo máximo y conserva la proporción', () => {
    expect(dimensionesReducidas(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(dimensionesReducidas(3000, 4000)).toEqual({ width: 960, height: 1280 });
  });

  it('ignora medidas inválidas', () => {
    expect(dimensionesReducidas(0, 100)).toBeNull();
    expect(dimensionesReducidas(NaN, 100)).toBeNull();
  });

  it('el límite de peso coincide con el del bucket (1 MB)', () => {
    expect(TAMANO_MAXIMO_BYTES).toBe(1024 * 1024);
  });

  it('reducirFoto pide JPEG a calidad 0,6 y redimensiona si hace falta', async () => {
    (manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file:///reducida.jpg' });
    const uri = await reducirFoto('file:///original.jpg', 4000, 3000);
    expect(uri).toBe('file:///reducida.jpg');
    expect(manipulateAsync).toHaveBeenCalledWith(
      'file:///original.jpg',
      [{ resize: { width: 1280, height: 960 } }],
      { compress: CALIDAD_JPEG, format: 'jpeg' }
    );
  });

  it('reducirFoto no redimensiona una imagen pequeña, pero igual la comprime', async () => {
    (manipulateAsync as jest.Mock).mockClear();
    (manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file:///c.jpg' });
    await reducirFoto('file:///chica.jpg', 800, 600);
    expect(manipulateAsync).toHaveBeenCalledWith('file:///chica.jpg', [], { compress: CALIDAD_JPEG, format: 'jpeg' });
  });
});

describe('enrutamiento por rol (criterios 2, 5 y 9)', () => {
  it('cada rol tiene su pantalla inicial', () => {
    expect(rutaInicial('pasajero', null)).toBe('/(app)/(passenger)');
    expect(rutaInicial('admin', null)).toBe('/(app)/(admin)');
  });

  it.each([null, 'sin_enviar', 'pendiente', 'rechazado'] as const)(
    'un conductor con verificación "%s" va a verificarse',
    (estado) => {
      expect(rutaInicial('conductor', estado)).toBe('/(app)/verificacion');
    }
  );

  it('un conductor aprobado va a su consola', () => {
    expect(rutaInicial('conductor', 'aprobado')).toBe('/(app)/(driver)');
  });

  it('un conductor sin aprobar no puede entrar a la consola', () => {
    expect(rutaPermitida(['(app)', '(driver)'], 'conductor', 'pendiente')).toBe(false);
    expect(rutaPermitida(['(app)', 'verificacion'], 'conductor', 'pendiente')).toBe(true);
  });

  it('un conductor aprobado no vuelve a la verificación', () => {
    expect(rutaPermitida(['(app)', 'verificacion'], 'conductor', 'aprobado')).toBe(false);
    expect(rutaPermitida(['(app)', '(driver)'], 'conductor', 'aprobado')).toBe(true);
  });

  it('un pasajero no ve el panel de conductor ni el de administrador', () => {
    expect(rutaPermitida(['(app)', '(driver)'], 'pasajero', null)).toBe(false);
    expect(rutaPermitida(['(app)', '(admin)'], 'pasajero', null)).toBe(false);
    expect(rutaPermitida(['(app)', '(passenger)'], 'pasajero', null)).toBe(true);
  });

  it('solo el administrador ve su panel y nada del resto', () => {
    expect(rutaPermitida(['(app)', '(admin)'], 'admin', null)).toBe(true);
    expect(rutaPermitida(['(app)', '(driver)'], 'admin', null)).toBe(false);
  });

  it('fuera del grupo (app) (mapa y login) nada está restringido', () => {
    expect(rutaPermitida([], 'pasajero', null)).toBe(true);
    expect(rutaPermitida(['(auth)', 'login'], 'conductor', 'pendiente')).toBe(true);
  });
});

describe('consentimiento', () => {
  it('la versión de la app coincide con la del servidor y el texto cubre los puntos clave', () => {
    // 0.2 (paso 004): ubicación del conductor en segundo plano, avisos y sin historial de recorridos.
    expect(CONSENT_VERSION).toBe('0.2');
    const texto = CONSENTIMIENTO.map((s) => s.texto).join(' ');
    expect(texto).toContain('segundo plano');
    expect(texto).toContain('avisos');
    expect(texto).toContain('última posición');
    const titulos = CONSENTIMIENTO.map((s) => s.titulo.toLowerCase()).join(' | ');
    expect(titulos).toContain('datos');
    expect(titulos).toContain('derechos');
    expect(titulos).toContain('911');
  });
});

describe('store de autenticación (criterio 8)', () => {
  beforeEach(() => useAuthStore.getState().clearSession());

  it('distingue "cargando el perfil" de "no tiene perfil"', () => {
    expect(useAuthStore.getState().profileChecked).toBe(false);
    useAuthStore.getState().setProfile(null);
    expect(useAuthStore.getState().profileChecked).toBe(true);
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('guarda la verificación del conductor y marca que ya se consultó', () => {
    useAuthStore.getState().setVerification({ estado: 'rechazado', motivo_rechazo: 'La foto no se lee' });
    expect(useAuthStore.getState().verificationChecked).toBe(true);
    expect(useAuthStore.getState().verification?.estado).toBe('rechazado');
  });

  it('cerrar sesión limpia perfil y verificación', () => {
    useAuthStore.getState().setProfile({ id: 'u', nombre: 'Carla', telefono: '0992222222', rol: 'conductor' });
    useAuthStore.getState().setVerification({ estado: 'aprobado' });
    useAuthStore.getState().clearSession();
    const s = useAuthStore.getState();
    expect([s.profile, s.verification, s.profileChecked, s.verificationChecked, s.session]).toEqual([
      null, null, false, false, null,
    ]);
  });
});

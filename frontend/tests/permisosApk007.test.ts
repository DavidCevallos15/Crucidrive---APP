// Paso 007, T19 (criterio 26): hallazgos de la auditoría del APK corregidos en la configuración.
// Ver specs/007-hardening/auditoria-apk.md. El manifiesto final se comprobó con
// `npx expo config --type introspect`; esta prueba evita que la configuración vuelva atrás.
import * as fs from 'fs';
import * as path from 'path';

const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8')).expo;

describe('007 · permisos del APK', () => {
  test('sin copia de seguridad en la nube de Android (A2)', () => {
    expect(app.android.allowBackup).toBe(false);
  });

  test('se quitan los permisos que la app no usa (A1)', () => {
    expect(app.android.blockedPermissions).toEqual(expect.arrayContaining([
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ]));
  });

  test('el selector de fotos no pide el micrófono: solo se toman fotos', () => {
    const picker = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-image-picker');
    expect(picker[1].microphonePermission).toBe(false);
    const fuente = fs.readFileSync(path.join(__dirname, '../src/components/PhotoSlot.tsx'), 'utf8');
    expect(fuente).not.toMatch(/videos/i);
  });

  test('los permisos que sí se usan siguen: ubicación en segundo plano para el conductor y cámara para la verificación', () => {
    const ubicacion = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-location');
    expect(ubicacion[1].isAndroidBackgroundLocationEnabled).toBe(true);
    expect(app.android.blockedPermissions).not.toContain('android.permission.CAMERA');
    expect(app.android.blockedPermissions).not.toContain('android.permission.ACCESS_BACKGROUND_LOCATION');
  });
});

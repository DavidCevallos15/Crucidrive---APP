import { avisosDisponibles, crearCargador } from '../src/utils/cargadorAvisos';

// Sin @types/node en el frontend: solo lo que usa esta prueba.
declare const __dirname: string;
declare function require(id: string): any;
const fs = require('fs') as {
  readFileSync: (ruta: string, codificacion: string) => string;
  readdirSync: (ruta: string) => string[];
  statSync: (ruta: string) => { isDirectory: () => boolean };
};
const path = require('path') as { join: (...partes: string[]) => string; relative: (a: string, b: string) => string };

/**
 * Expo Go (Android, SDK 53 o más) lanza al IMPORTAR expo-notifications:
 * "Android Push notifications ... was removed from Expo Go". La pantalla roja tapaba la app.
 * El módulo solo debe cargarse donde existe, y ningún archivo puede importarlo de forma estática.
 */
describe('avisos: carga de expo-notifications', () => {
  test('hay avisos fuera de la web y fuera de Expo Go', () => {
    expect(avisosDisponibles({ web: false, expoGo: false })).toBe(true);
    expect(avisosDisponibles({ web: true, expoGo: false })).toBe(false);
    expect(avisosDisponibles({ web: false, expoGo: true })).toBe(false);
  });

  test('en Expo Go o en la web el módulo ni se carga', () => {
    const cargar = jest.fn(() => ({ modulo: true }));
    const cargador = crearCargador(false, cargar);
    expect(cargador()).toBeNull();
    expect(cargador()).toBeNull();
    expect(cargar).not.toHaveBeenCalled();
  });

  test('donde existe, se carga una sola vez', () => {
    const modulo = { modulo: true };
    const cargar = jest.fn(() => modulo);
    const cargador = crearCargador(true, cargar);
    expect(cargador()).toBe(modulo);
    expect(cargador()).toBe(modulo);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  test('si cargar lanza, la app sigue sin avisos y no reintenta', () => {
    const cargar = jest.fn(() => { throw new Error('Android Push notifications ... removed from Expo Go'); });
    const avisar = jest.fn();
    const cargador = crearCargador(true, cargar, avisar);
    expect(cargador()).toBeNull();
    expect(cargador()).toBeNull();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  test('ningún archivo importa expo-notifications de forma estática', () => {
    const raiz = path.join(__dirname, '..');
    const archivos: string[] = [];
    const recorrer = (carpeta: string) => {
      for (const nombre of fs.readdirSync(carpeta)) {
        const ruta = path.join(carpeta, nombre);
        if (fs.statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(ts|tsx)$/.test(nombre)) archivos.push(ruta);
      }
    };
    recorrer(path.join(raiz, 'src'));
    recorrer(path.join(raiz, 'app'));
    archivos.push(path.join(raiz, 'index.ts'));

    const estaticos = archivos
      .filter((ruta) => ruta !== path.join(raiz, 'src', 'servicios', 'notificaciones.ts'))
      .filter((ruta) => {
        const codigo = fs.readFileSync(ruta, 'utf8');
        // `import type` se borra al compilar y no ejecuta el módulo.
        return /^import\s+(?!type\b)[^;]*from\s+['"]expo-notifications['"]/m.test(codigo)
          || /require\(\s*['"]expo-notifications['"]\s*\)/.test(codigo);
      })
      .map((ruta) => path.relative(raiz, ruta));
    expect(estaticos).toEqual([]);
  });
});

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Los gestos de Gesture Handler corren en el hilo de UI de Android e iOS. Llamar desde ahí a una
 * función normal de JavaScript (un `useCallback`, por ejemplo) cierra la app: en la web no pasa
 * nada, y por eso las pruebas en el navegador no lo ven. Hay que usar `runOnJS(fn)()`.
 * Campo, 26 oct 2026: al pulsar «Enviar» en el chat del pasajero la app se cerraba.
 */
const archivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });

/**
 * Las cadenas `Gesture.Tap()...` de un archivo: desde la línea que empieza el gesto hasta la
 * primera línea con la misma indentación o menos que ella.
 */
const cadenas = (fuente: string): string[] => {
  const lineas = fuente.split('\n');
  const resultado: string[] = [];
  lineas.forEach((linea, i) => {
    if (!/Gesture\.\w+\(/.test(linea)) return;
    const sangria = linea.length - linea.trimStart().length;
    const cadena = [linea];
    for (let j = i + 1; j < lineas.length; j += 1) {
      const sig = lineas[j];
      if (sig.trim() !== '' && sig.length - sig.trimStart().length <= sangria) break;
      cadena.push(sig);
    }
    resultado.push(cadena.join('\n'));
  });
  return resultado;
};

/** Funciones de JS declaradas con useCallback en el archivo. */
const funcionesJs = (fuente: string): string[] =>
  [...fuente.matchAll(/const (\w+) = useCallback\(/g)].map((m) => m[1]);

describe('los gestos no llaman a JavaScript directo desde el hilo de UI', () => {
  const origen = join(__dirname, '..', 'src');
  const conGestos = archivos(origen).filter((f) => /Gesture\.\w+\(/.test(readFileSync(f, 'utf8')));

  test('hay gestos que revisar', () => {
    expect(conGestos.length).toBeGreaterThan(0);
  });

  test.each(conGestos.map((f) => [f.slice(origen.length + 1), f]))('%s', (_nombre, ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    const peligrosas: string[] = [];
    for (const cadena of cadenas(fuente)) {
      for (const fn of funcionesJs(fuente)) {
        // `fn(` suelto es una llamada directa; `runOnJS(fn)()` no contiene `fn(`.
        if (new RegExp(`(?<![\\w.])${fn}\\(`).test(cadena)) peligrosas.push(fn);
      }
    }
    expect(peligrosas).toEqual([]);
  });
});

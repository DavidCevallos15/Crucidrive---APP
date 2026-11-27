/**
 * Numeración de supabase/migrations (constitución, regla 9). El historial de producción
 * (supabase_migrations.schema_migrations) se registra con el mismo número que el archivo; si dos
 * archivos comparten número o hay un hueco, el historial deja de poder compararse con el repo.
 * Ver supabase/README.md.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'supabase', 'migrations');
const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

describe('migraciones de supabase/migrations', () => {
  test('cada archivo se llama NNNN_nombre.sql (4 dígitos, minúsculas y guiones bajos)', () => {
    const malos = archivos.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f));
    expect(malos).toEqual([]);
  });

  test('los números van de 0001 en adelante, sin huecos ni repetidos', () => {
    const numeros = archivos.map((f) => Number(f.slice(0, 4)));
    expect(numeros).toEqual(numeros.map((_, i) => i + 1));
  });

  test('ningún archivo está vacío', () => {
    const vacios = archivos.filter((f) => fs.readFileSync(path.join(DIR, f), 'utf8').trim() === '');
    expect(vacios).toEqual([]);
  });
});

// Exportación reproducible desde la única fuente de tokens; no mantiene una segunda paleta.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = new URL('../src/constants/theme.ts', import.meta.url);
const code = ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context, { filename: 'theme.ts', timeout: 1000 });
fs.writeFileSync(new URL('../assets/premium/design-tokens.json', import.meta.url), JSON.stringify(context.exports, null, 2) + '\n');
console.log('Tokens exportados a assets/premium/design-tokens.json');

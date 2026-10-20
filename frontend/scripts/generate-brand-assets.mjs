// Derivados de los originales de marca. Requiere ffmpeg en PATH.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const mark = path.join(root, 'assets/brand/mark-source.png');
const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: root, stdio: 'inherit' });
const resize = (source, size, output) => run(['-i', source, '-vf', `scale=${size}:${size}:flags=lanczos`, '-frames:v', '1', output]);

resize(mark, 256, 'assets/brand-mark.png');
resize(mark, 1024, 'assets/android-icon-foreground.png');
resize(mark, 512, 'assets/splash-icon.png');
run(['-i', mark, '-vf', 'scale=96:96:flags=lanczos,lutrgb=r=255:g=255:b=255', '-frames:v', '1', 'assets/android-icon-monochrome.png']);
run(['-f', 'lavfi', '-i', 'color=c=0x061C23:s=1024x1024', '-i', mark, '-filter_complex', '[1:v]scale=1024:1024:flags=lanczos[mark];[0:v][mark]overlay=0:0:format=auto,format=rgb24', '-frames:v', '1', 'assets/icon.png']);
run(['-f', 'lavfi', '-i', 'color=c=0x061C23:s=1024x1024', '-frames:v', '1', 'assets/android-icon-background.png']);
for (const [size, output] of [[48, 'assets/favicon.png'], [192, 'public/pwa-192.png'], [512, 'public/pwa-512.png'], [512, 'public/pwa-maskable-512.png'], [180, 'public/apple-touch-icon.png']]) {
  resize('assets/icon.png', size, output);
}
run(['-i', 'assets/brand/coast-source.png', '-q:v', '3', 'assets/coast-login.jpg']);
console.log('Recursos de marca generados para Android, iOS, splash y PWA.');

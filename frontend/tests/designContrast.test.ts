import { COLORS } from '../src/constants/theme';
function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
test.each([
  ['cuerpo sobre papel', COLORS.ink, COLORS.paper], ['ayuda sobre papel', COLORS.glassTextMutedDark, COLORS.paper],
  ['ayuda sobre tarjeta', COLORS.glassTextMutedDark, COLORS.surface], ['acción vino', COLORS.white, COLORS.wine],
  ['acción arena', COLORS.ink, COLORS.sand], ['tinta sobre azul', COLORS.ink, COLORS.blue],
  ['foco y contenido en azul suave', COLORS.blueInk, COLORS.blueLight], ['error en papel', COLORS.danger, COLORS.paper],
])('%s cumple AA para texto normal', (_name, foreground, background) => {
  const a = luminance(foreground); const b = luminance(background);
  expect((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toBeGreaterThanOrEqual(4.5);
});

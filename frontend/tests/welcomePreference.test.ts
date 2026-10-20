import { needsWelcome, rememberWelcome, WELCOME_KEY } from '../src/utils/welcomePreference';
describe('bienvenida solo la primera vez', () => {
  const storage = () => ({ getItem: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null), setItem: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined) });
  it('muestra la bienvenida si aún no existe preferencia', async () => { const s = storage(); expect(await needsWelcome(s)).toBe(true); expect(s.getItem).toHaveBeenCalledWith(WELCOME_KEY); });
  it('entra directo si la bienvenida ya terminó o se omitió', async () => { const s = storage(); s.getItem.mockResolvedValue('seen'); expect(await needsWelcome(s)).toBe(false); });
  it('un fallo de lectura no bloquea el mapa', async () => { const s = storage(); s.getItem.mockRejectedValue(new Error('storage')); expect(await needsWelcome(s)).toBe(false); });
  it('solo guarda una bandera local sin datos personales', async () => { const s = storage(); await rememberWelcome(s); expect(s.setItem).toHaveBeenCalledWith(WELCOME_KEY, 'seen'); });
  it('un fallo de escritura no bloquea la navegación', async () => { const s = storage(); s.setItem.mockRejectedValue(new Error('full')); await expect(rememberWelcome(s)).resolves.toBeUndefined(); });
});

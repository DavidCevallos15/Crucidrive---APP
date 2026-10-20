export const WELCOME_KEY = 'crucidrive:welcome:v1';
export interface WelcomeStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }

/** Fallar al leer nunca impide llegar al mapa. Solo se guarda una preferencia local. */
export async function needsWelcome(storage: WelcomeStorage): Promise<boolean> {
  try { return await storage.getItem(WELCOME_KEY) !== 'seen'; } catch { return false; }
}
export async function rememberWelcome(storage: WelcomeStorage): Promise<void> {
  try { await storage.setItem(WELCOME_KEY, 'seen'); } catch { /* La navegación no depende de poder guardar. */ }
}

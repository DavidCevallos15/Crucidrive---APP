/**
 * En la web (PWA) no hay avisos push: `Notifications.useLastNotificationResponse` lanza
 * "not available on web" y derribaba toda la app (paso 004). Metro usa este archivo en vez de
 * `useRespuestaAvisos.ts` cuando la plataforma es web; en Android sigue el original.
 */
export const useRespuestaAvisos = (_rol: string | null): void => {};

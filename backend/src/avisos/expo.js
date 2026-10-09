/**
 * Cliente del servicio de avisos de Expo (paso 004, D-12; plan P1, P2 y P4). Es un POST con JSON:
 * no hace falta el SDK (regla 8). Expo entrega por FCM a Android.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
const URL_EXPO = 'https://exp.host/--/api/v2/push/send';
const LOTE = 100; // máximo de mensajes por petición que acepta Expo

/**
 * @param {object} [opciones]
 * @param {typeof fetch} [opciones.fetchImpl]
 * @param {string} [opciones.token] - EXPO_ACCESS_TOKEN (seguridad reforzada de Expo, P2). Opcional.
 * @param {number} [opciones.timeoutMs]
 */
const crearClienteExpo = ({ fetchImpl = globalThis.fetch, token = process.env.EXPO_ACCESS_TOKEN, timeoutMs = 5000 } = {}) => ({
  /**
   * Envía los mensajes en lotes. No reintenta: un aviso tardío de una oferta ya no sirve.
   * @param {Array<{ to: string }>} mensajes
   * @returns {Promise<{ enviados: number, invalidos: string[], fallidos: number }>}
   *   `invalidos`: tokens que Expo da por desinstalados (DeviceNotRegistered), para borrarlos.
   */
  async enviar(mensajes) {
    const resultado = { enviados: 0, invalidos: [], fallidos: 0 };
    for (let i = 0; i < mensajes.length; i += LOTE) {
      const lote = mensajes.slice(i, i + LOTE);
      try {
        const res = await fetchImpl(URL_EXPO, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(lote),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          console.error(`[Avisos] Expo respondió HTTP ${res.status}`);
          resultado.fallidos += lote.length;
          continue;
        }
        const { data = [] } = await res.json();
        data.forEach((ticket, j) => {
          if (ticket?.status === 'ok') {
            resultado.enviados += 1;
            return;
          }
          resultado.fallidos += 1;
          if (ticket?.details?.error === 'DeviceNotRegistered') resultado.invalidos.push(lote[j].to);
          else console.error(`[Avisos] Expo rechazó un aviso: ${ticket?.details?.error || ticket?.message || 'sin detalle'}`);
        });
      } catch (err) {
        console.error(`[Avisos] No se pudo contactar a Expo: ${err.message}`);
        resultado.fallidos += lote.length;
      }
    }
    return resultado;
  },
});

module.exports = { crearClienteExpo, URL_EXPO, LOTE };

const { isIP } = require('node:net');

/** Nunca convierte un error tipográfico ni "false" en un proxy confiable. */
const leerTrustProxy = (value) => {
  const texto = String(value ?? '').trim();
  if (!texto || texto === 'false' || texto === '0') return false;
  if (/^[1-9]\d*$/.test(texto) && Number.isSafeInteger(Number(texto))) return Number(texto);
  const redes = texto.split(',').map((red) => red.trim());
  const valida = (red) => {
    if (red === 'loopback') return true;
    const partes = red.split('/');
    const version = isIP(partes[0]);
    if (!version || partes.length > 2) return false;
    if (partes.length === 1) return true;
    return /^\d+$/.test(partes[1]) && Number(partes[1]) >= 1
      && Number(partes[1]) <= (version === 4 ? 32 : 128);
  };
  if (redes.every(valida)) return redes;
  throw new Error('TRUST_PROXY inválido: usa vacío/false/0, un número de saltos, loopback o IPs/CIDR explícitas.');
};

module.exports = { leerTrustProxy };

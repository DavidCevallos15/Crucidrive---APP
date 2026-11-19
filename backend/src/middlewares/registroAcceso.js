// @ts-check
/**
 * Registro de acceso (007, criterios 19 y 20; plan P11; E3). Una línea JSON por petición, en la
 * salida estándar, al terminar la respuesta: { t, uid, m, ruta, st, ms, ip, ua }. En la VM la
 * guarda journald 14 días (deploy/vm/journald-crucidrive.conf).
 *
 * Nunca lleva el cuerpo ni la consulta (?lat=…): ahí van nombre, teléfono y coordenadas.
 */

const UA_MAX = 200;

/** @param {string | undefined} url */
const sinConsulta = (url) => String(url ?? '').split('?')[0];

/** @param {unknown} ua */
const cortarUa = (ua) => (typeof ua === 'string' ? ua.slice(0, UA_MAX) : '');

/**
 * La línea de una petición terminada (función pura, para probarla).
 * @param {{ uid?: string | null, metodo: string, url?: string, estado: number, ms: number, ip?: string, ua?: unknown, ahora?: Date }} d
 */
const lineaAcceso = (d) => JSON.stringify({
  t: (d.ahora ?? new Date()).toISOString(),
  uid: d.uid || 'anonimo',
  m: d.metodo,
  ruta: sinConsulta(d.url),
  st: d.estado,
  ms: Math.round(d.ms),
  ip: d.ip ?? '',
  ua: cortarUa(d.ua),
});

/**
 * La línea de un evento del socket (conectar o desconectar), con el mismo formato.
 * @param {{ uid?: string | null, evento: 'conectar' | 'desconectar', ip?: string, ua?: unknown, ahora?: Date }} d
 */
const lineaSocket = (d) => JSON.stringify({
  t: (d.ahora ?? new Date()).toISOString(),
  uid: d.uid || 'anonimo',
  m: 'SOCKET',
  ruta: d.evento,
  ip: d.ip ?? '',
  ua: cortarUa(d.ua),
});

/**
 * IP del cliente de un socket. Detrás de Caddy (TRUST_PROXY configurado), la última entrada de
 * X-Forwarded-For es la que puso Caddy; sin proxy, la dirección de la conexión.
 * @param {{ address?: string, headers?: Record<string, unknown> }} [handshake]
 * @param {boolean} [detrasDeProxy]
 */
const ipDeSocket = (handshake, detrasDeProxy = false) => {
  const reenviada = handshake?.headers?.['x-forwarded-for'];
  if (detrasDeProxy && typeof reenviada === 'string' && reenviada.trim()) {
    const partes = reenviada.split(',').map((p) => p.trim()).filter(Boolean);
    return partes[partes.length - 1] ?? handshake?.address ?? '';
  }
  return handshake?.address ?? '';
};

/** @param {string} linea */
const escribirPorDefecto = (linea) => { process.stdout.write(`${linea}\n`); };

/**
 * Middleware de Express. En las pruebas (NODE_ENV=test) no escribe nada, salvo que se le pase
 * `escribir`, para no llenar la salida de jest.
 * @param {{ escribir?: (linea: string) => void }} [opciones]
 * @returns {(req: any, res: any, next: () => void) => void}
 */
const crearRegistroAcceso = (opciones = {}) => {
  const escribir = opciones.escribir ?? (process.env.NODE_ENV === 'test' ? null : escribirPorDefecto);
  return (req, res, next) => {
    if (!escribir) return next();
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
      escribir(lineaAcceso({
        uid: /** @type {any} */ (req).user?.id,
        metodo: req.method,
        url: req.originalUrl,
        estado: res.statusCode,
        ms,
        ip: req.ip,
        ua: req.get('user-agent'),
      }));
    });
    return next();
  };
};

module.exports = { crearRegistroAcceso, lineaAcceso, lineaSocket, ipDeSocket, UA_MAX };

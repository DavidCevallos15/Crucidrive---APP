/**
 * Texto de los avisos (paso 004, plan P7 y P9). Funciones puras.
 * Lo que va aquí lo ven Expo y Google: nada de teléfono, nombre ni coordenadas del pasajero
 * (criterio 6; criterio 15 del 003). Solo lo justo para decidir.
 */

/** "Muelle de Crucita · Los Arenales", o solo el sector. */
const textoPunto = ({ sectorId, descripcion } = {}, nombreSector) => {
  const sector = nombreSector(sectorId) || '';
  const ref = (descripcion || '').trim();
  if (ref && sector) return `${ref} · ${sector}`;
  return ref || sector || 'Sin referencia';
};

const dinero = (n) => `$${Number(n).toFixed(2)}`;

/**
 * Oferta al conductor. `ttl` hasta que vence: Expo y FCM descartan el aviso si llega tarde (P7).
 * @param {object} oferta - Payload de armarOferta (src/despacho/oferta.js).
 * @param {string[]} tokens
 * @param {(id: string) => string} nombreSector
 * @param {number} [ahora]
 */
const avisoOferta = (oferta, tokens, nombreSector, ahora = Date.now()) => {
  const personas = `${oferta.pasajeros} ${oferta.pasajeros === 1 ? 'persona' : 'personas'}`;
  const ttl = Math.max(1, Math.ceil((oferta.venceEn - ahora) / 1000));
  return tokens.map((to) => ({
    to,
    title: `Nuevo viaje · ${dinero(oferta.tarifa)}`,
    body: `${personas} · ${textoPunto(oferta.origen, nombreSector)} → ${textoPunto(oferta.destino, nombreSector)}`,
    data: { tipo: 'oferta', viajeId: oferta.viajeId, venceEn: oferta.venceEn },
    ttl,
    priority: 'high',
    channelId: 'ofertas',
    sound: 'default',
  }));
};

/** Aviso de datos, sin texto: la app borra la notificación de la oferta si lo recibe (P8). */
const avisoRetirada = (viajeId, tokens) => tokens.map((to) => ({
  to,
  data: { tipo: 'oferta_retirada', viajeId },
  priority: 'high',
  _contentAvailable: true,
  ttl: 60,
}));

/** Al pasajero: un conductor aceptó (criterio 10). Nombre y placa ya los ve en la app (002). */
const avisoAceptado = (viajeId, conductor, tokens) => tokens.map((to) => ({
  to,
  title: 'Tu tricimoto va en camino',
  body: [conductor?.nombre, conductor?.placa && `placa ${conductor.placa}`].filter(Boolean).join(' · ') || 'Un conductor aceptó tu viaje',
  data: { tipo: 'viaje_aceptado', viajeId },
  priority: 'high',
  channelId: 'viaje',
  sound: 'default',
  ttl: 300,
}));

/** Al pasajero: nadie aceptó a tiempo (criterio 10; criterio 11 del 003). */
const avisoSinConductor = (viajeId, tokens) => tokens.map((to) => ({
  to,
  title: 'No hay tricimotos disponibles ahora',
  body: 'Toca para volver a pedir.',
  data: { tipo: 'viaje_sin_conductor', viajeId },
  priority: 'high',
  channelId: 'viaje',
  sound: 'default',
  ttl: 300,
}));

module.exports = { avisoOferta, avisoRetirada, avisoAceptado, avisoSinConductor, textoPunto };

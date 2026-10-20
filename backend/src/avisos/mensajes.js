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
  // Una encomienda no tiene tarifa ni personas: el precio se acuerda por chat (D-14).
  const encomienda = oferta.tipoServicio === 'encomienda';
  const title = encomienda ? 'Nueva encomienda · Precio a convenir' : `Nuevo viaje · ${dinero(oferta.tarifa)}`;
  const detalle = encomienda ? 'Encomienda' : `${oferta.pasajeros} ${oferta.pasajeros === 1 ? 'persona' : 'personas'}`;
  const ttl = Math.max(1, Math.ceil((oferta.venceEn - ahora) / 1000));
  return tokens.map((to) => ({
    to,
    title,
    body: `${detalle} · ${textoPunto(oferta.origen, nombreSector)} → ${textoPunto(oferta.destino, nombreSector)}`,
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

/**
 * Textos del viaje en curso (005, criterios 3, 4, 5, 5b y 8). Sin nombre ni teléfono (criterio 6
 * del 004). `cambio` es lo que pasó; `encomienda` cambia el texto para el paquete.
 */
const TEXTOS_VIAJE = {
  llegada: [['Tu tricimoto llegó', 'Te espera en el punto de recogida.'], ['El conductor llegó', 'Está en el punto de recogida del paquete.']],
  en_curso: [['Tu viaje empezó', 'Puedes seguirlo en la app.'], ['Recogimos tu paquete', 'Va en camino a la entrega.']],
  finalizado: [['Tu viaje terminó', 'Confirma que llegaste y califica al conductor.'], ['Tu paquete fue entregado', 'Confírmalo y califica al conductor.']],
  finalizado_por_pasajero: [['El pasajero terminó el viaje', 'Ya puedes recibir otras solicitudes.'], ['El pasajero terminó la encomienda', 'Ya puedes recibir otras solicitudes.']],
  cancelado_por_pasajero: [['El pasajero canceló el viaje', 'Ya puedes recibir otras solicitudes.'], ['Se canceló la encomienda', 'Ya puedes recibir otras solicitudes.']],
  cancelado_por_conductor: [['El conductor canceló el viaje', 'Toca para volver a pedir.'], ['El conductor canceló la encomienda', 'Toca para volver a pedir.']],
};

const avisoEstadoViaje = ({ viajeId, cambio, encomienda = false }, tokens) => {
  const textos = TEXTOS_VIAJE[cambio];
  if (!textos) return [];
  const [title, body] = textos[encomienda ? 1 : 0];
  return tokens.map((to) => ({
    to,
    title,
    body,
    data: { tipo: 'viaje_estado', viajeId, cambio },
    priority: 'high',
    channelId: 'viaje',
    sound: 'default',
    ttl: 600,
  }));
};

module.exports = { avisoOferta, avisoRetirada, avisoAceptado, avisoSinConductor, avisoEstadoViaje, TEXTOS_VIAJE, textoPunto };

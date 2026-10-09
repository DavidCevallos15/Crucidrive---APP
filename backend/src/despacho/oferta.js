/**
 * Lo que ve el conductor en una oferta (paso 003, criterio 15; plan R13).
 * Solo lo justo para decidir: nada de teléfono, nombre ni coordenadas del pasajero antes de
 * aceptar (LOPDP), y pequeño para el presupuesto de datos (criterio 27: menos de 2 KB).
 */

/** Columnas del viaje que necesita el despachador (consulta con la clave de servicio). */
const COLUMNAS_VIAJE = 'id, pasajero_id, estado, pasajeros, tarifa, sector_origen_id, sector_destino_id, origen_descripcion, destino_descripcion, creado_en';

/**
 * @param {object} viaje - Fila de viajes con COLUMNAS_VIAJE.
 * @param {{ fase: string, vence_en: string, distancia_m: number|null }} oferta - Fila de ofertas_viaje.
 */
const armarOferta = (viaje, oferta) => ({
  viajeId: viaje.id,
  pasajeros: viaje.pasajeros,
  tarifa: Number(viaje.tarifa),
  origen: { sectorId: viaje.sector_origen_id, descripcion: viaje.origen_descripcion },
  destino: { sectorId: viaje.sector_destino_id, descripcion: viaje.destino_descripcion },
  distanciaM: oferta.distancia_m,
  fase: oferta.fase,
  venceEn: new Date(oferta.vence_en).getTime(),
});

module.exports = { armarOferta, COLUMNAS_VIAJE };

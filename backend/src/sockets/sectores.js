// @ts-check
/**
 * Catálogo de sectores en memoria para validar join_sector (007, criterio 2; plan P1).
 * Son pocos (5 en Crucita) y casi no cambian: se leen con el JWT del usuario (la tabla es de
 * lectura pública) y se guardan 10 min, en lugar de consultar la BD en cada evento.
 */

const TTL_MS = 10 * 60 * 1000;

/**
 * @param {{ ttlMs?: number }} [opciones]
 */
const crearCatalogoSectores = ({ ttlMs = TTL_MS } = {}) => {
  /** @type {Set<string> | null} */
  let ids = null;
  let leidoEn = 0;

  return {
    /**
     * @param {any} db cliente de Supabase del usuario
     * @param {string} sectorId
     * @param {number} [ahora]
     * @returns {Promise<boolean>}
     */
    async existe(db, sectorId, ahora = Date.now()) {
      if (!ids || ahora - leidoEn >= ttlMs) {
        const { data, error } = await db.from('sectores').select('id').eq('activo', true);
        if (error) throw new Error(`No se pudo leer el catálogo de sectores: ${error.message}`);
        ids = new Set((data || []).map((/** @type {{ id: string }} */ s) => s.id));
        leidoEn = ahora;
      }
      return ids.has(sectorId);
    },
  };
};

module.exports = { crearCatalogoSectores, TTL_MS };

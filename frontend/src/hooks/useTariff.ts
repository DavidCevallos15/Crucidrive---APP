import { useMemo } from 'react';
import { findTariff, SECTORS } from '../constants/sectors';
import type { TariffEntry } from '../constants/sectors';

/**
 * Resultado del cálculo de tarifa.
 */
interface TariffResult {
  /** Entrada completa de tarifa (null si no se encontró) */
  tariff: TariffEntry | null;
  /** Nombre del sector de origen */
  originName: string;
  /** Nombre del sector de destino */
  destinationName: string;
  /** Tarifa formateada como string con símbolo de moneda */
  formattedPrice: string;
  /** Tiempo estimado formateado */
  formattedTime: string;
  /** Distancia estimada formateada */
  formattedDistance: string;
}

/**
 * Hook para calcular la tarifa fija entre dos sectores geográficos.
 *
 * Utiliza la matriz de tarifas preconfigurada en constants/sectors.ts.
 * La tarifa es simétrica (A→B = B→A).
 *
 * @param originSectorId - ID del sector de origen
 * @param destinationSectorId - ID del sector de destino
 * @returns Resultado del cálculo con datos formateados
 *
 * @example
 * const { tariff, formattedPrice } = useTariff('centro', 'playa');
 * // formattedPrice → "$1.50 USD"
 */
export const useTariff = (
  originSectorId: string | null,
  destinationSectorId: string | null
): TariffResult => {
  return useMemo(() => {
    if (!originSectorId || !destinationSectorId) {
      return {
        tariff: null,
        originName: '',
        destinationName: '',
        formattedPrice: '$0.00',
        formattedTime: '--',
        formattedDistance: '--',
      };
    }

    // Buscar nombres de los sectores
    const originSector = SECTORS.find((s) => s.id === originSectorId);
    const destinationSector = SECTORS.find((s) => s.id === destinationSectorId);

    // Buscar tarifa (simétrica)
    const tariff = findTariff(originSectorId, destinationSectorId) ?? null;

    return {
      tariff,
      originName: originSector?.name ?? originSectorId,
      destinationName: destinationSector?.name ?? destinationSectorId,
      formattedPrice: tariff
        ? `$${tariff.price.toFixed(2)}`
        : '$0.00',
      formattedTime: tariff
        ? `~${tariff.estimatedTimeMin} min`
        : '--',
      formattedDistance: tariff
        ? `${tariff.estimatedDistanceKm.toFixed(1)} km`
        : '--',
    };
  }, [originSectorId, destinationSectorId]);
};

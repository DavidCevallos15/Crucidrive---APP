import { useMemo } from 'react';
import { calculateFare, PRICE_PER_PERSON_USD } from '../constants/sectors';

/**
 * Resultado del cálculo de tarifa.
 */
interface TariffResult {
  /** Total estimado en USD (precio por persona × pasajeros) */
  total: number;
  /** Total con símbolo de moneda, p. ej. "$1.50" */
  formattedPrice: string;
  /** Precio unitario con símbolo de moneda, p. ej. "$0.50" */
  formattedPricePerPerson: string;
}

/**
 * Hook para calcular la tarifa de un viaje en Crucita.
 *
 * El cobro es de 0,50 USD por persona, sin importar sectores ni distancia (D-08).
 * Es una estimación para mostrar al pasajero: el servidor calcula el valor real.
 *
 * @param passengers - Número de pasajeros
 *
 * @example
 * const { formattedPrice } = useTariff(3);
 * // formattedPrice → "$1.50"
 */
export const useTariff = (passengers: number): TariffResult => {
  return useMemo(() => {
    const total = calculateFare(passengers);
    return {
      total,
      formattedPrice: `$${total.toFixed(2)}`,
      formattedPricePerPerson: `$${PRICE_PER_PERSON_USD.toFixed(2)}`,
    };
  }, [passengers]);
};

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../utils/authFetch';
import { API_CONFIG } from '../constants/config';
import { leerResenas, type ResenasConductor } from '../utils/viajeConductor';

/**
 * Estrellas, número de reseñas y comentarios del propio conductor, sin autor (paso 005,
 * criterio 17). Se leen al montar si `activo`; `recargar` sirve para volver a pedirlas.
 */
export const useResenasConductor = (activo = true) => {
  const [resumen, setResumen] = useState<ResenasConductor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const response = await authFetch(API_CONFIG.endpoints.driver.resenas);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.message ?? 'No se pudieron leer tus reseñas.');
        return;
      }
      setResumen(leerResenas(body?.data));
      setError(null);
    } catch {
      setError('Sin conexión: no se pudieron leer tus reseñas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (activo) void recargar();
  }, [activo, recargar]);

  return { resumen, error, cargando, recargar };
};

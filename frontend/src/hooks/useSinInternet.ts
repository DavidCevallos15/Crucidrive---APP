import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { GRACIA_SIN_INTERNET_MS, estaSinInternet } from '../utils/conexion';

/**
 * true cuando hay sesión y el socket lleva `GRACIA_SIN_INTERNET_MS` sin conectar (017, P1).
 * Vuelve a false en cuanto el socket conecta.
 */
export const useSinInternet = (conectado: boolean): boolean => {
  const conSesion = useAuthStore((s) => Boolean(s.session));
  const desde = useRef<number | null>(null);
  const [sinInternet, setSinInternet] = useState(false);

  useEffect(() => {
    if (conectado || !conSesion) {
      desde.current = null;
      setSinInternet(false);
      return;
    }
    if (desde.current === null) desde.current = Date.now();
    const revisar = () => setSinInternet(estaSinInternet({
      conSesion, conectado, desconectadoDesde: desde.current, ahora: Date.now(),
    }));
    const restante = Math.max(0, GRACIA_SIN_INTERNET_MS - (Date.now() - desde.current));
    const timer = setTimeout(revisar, restante);
    return () => clearTimeout(timer);
  }, [conectado, conSesion]);

  return sinInternet;
};

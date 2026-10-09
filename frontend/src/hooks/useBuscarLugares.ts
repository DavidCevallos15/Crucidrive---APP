import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import {
  buscarLugares,
  crearBuscadorLugares,
  ESTADO_INICIAL,
  type ClienteRpc,
  type EstadoBusqueda,
} from '../utils/lugares';

/**
 * Busca lugares del catálogo mientras el usuario escribe (paso 003, criterio 18).
 * Espera 250 ms entre teclas y descarta respuestas viejas. Funciona sin sesión:
 * buscar_lugares es pública (criterio 26).
 */
export const useBuscarLugares = () => {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<EstadoBusqueda>(ESTADO_INICIAL);

  const buscador = useMemo(
    () =>
      crearBuscadorLugares({
        buscar: (q) => buscarLugares(supabase as unknown as ClienteRpc, q),
        alCambiar: setEstado,
      }),
    []
  );

  useEffect(() => () => buscador.cancelar(), [buscador]);

  const escribir = (q: string) => {
    setTexto(q);
    buscador.escribir(q);
  };

  const limpiar = () => escribir('');

  return { texto, escribir, limpiar, ...estado };
};

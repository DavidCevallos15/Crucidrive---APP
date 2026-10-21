import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Si el teclado está abierto. Con el teclado arriba, la barra de pestañas queda tapada y su
 * espacio sobra: el campo de escribir debe pegarse al teclado (chat, campo 20 oct 2026).
 */
export const useTecladoVisible = (): boolean => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const mostrar = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const ocultar = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return visible;
};

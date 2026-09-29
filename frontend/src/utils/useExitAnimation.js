import { useEffect, useState } from 'react';
import { PREFERS_REDUCED_MOTION } from './motion';

/**
 * Mantiene montado un elemento `ms` milisegundos después de cerrarse, para su fundido de salida.
 * Devuelve { mounted, closing }: se renderiza mientras `mounted` y se añade `.is-closing` mientras `closing`.
 * Con prefers-reduced-motion (o ms = 0) se desmonta al instante.
 */
export function useExitAnimation(isOpen, ms = 140) {
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [closing, setClosing] = useState(false);

  // Ajuste durante el render (patrón de React): sin un cuadro intermedio desmontado al cerrar
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    setClosing(!isOpen && !PREFERS_REDUCED_MOTION && ms > 0);
  }

  useEffect(() => {
    if (!closing) return undefined;
    const t = setTimeout(() => setClosing(false), ms);
    return () => clearTimeout(t);
  }, [closing, ms]);

  return { mounted: isOpen || closing, closing: !isOpen && closing };
}

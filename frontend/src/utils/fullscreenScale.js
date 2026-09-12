import { useState, useEffect } from 'react';

/**
 * Factor de escala para modo fullscreen.
 * En vista normal siempre es 1 (sin cambios visuales).
 * En fullscreen parte de un mínimo notorio de 1.25 y crece con la ventana:
 * s = min(vw/1280, vh/720), limitado a [1.25, 1.75].
 * (A 1080p da ~1.5: ticks 11→17px. La curva anterior daba solo 1.2.)
 * Se recalcula al redimensionar con el overlay abierto.
 */
export function useFullscreenScale(isFullScreen) {
  const compute = () => {
    if (typeof window === 'undefined') return 1;
    if (!isFullScreen) return 1;
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    return Math.min(1.75, Math.max(1.25, Math.round(s * 20) / 20));
  };

  const [scale, setScale] = useState(compute);

  useEffect(() => {
    setScale(compute());
    if (!isFullScreen) return undefined;
    const onResize = () => setScale(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen]);

  return scale;
}

/** Escala un tamaño base (número) con el factor, redondeado para SVG. */
export function scaleSize(base, scale) {
  return Math.max(1, Math.round(base * scale));
}

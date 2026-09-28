/**
 * Preferencias de movimiento compartidas por las gráficas.
 * Animaciones cortas (300ms, ease-out) y ninguna con prefers-reduced-motion.
 */
export const PREFERS_REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Props de animación para Bar/Line/Area de Recharts (el default de 1500ms se siente lento al aplicar). */
export const CHART_ANIM = {
  isAnimationActive: !PREFERS_REDUCED_MOTION,
  animationDuration: 300,
  animationEasing: 'ease-out',
};

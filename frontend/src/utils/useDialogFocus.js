import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pila de diálogos abiertos: solo el de arriba atrapa Tab y responde a Escape
// (p. ej. el desglose abierto desde el mapa en pantalla completa).
const stack = [];

// Lectura diferida de una ref: al cerrar se quiere su valor ACTUAL (el disparador ya re-montado)
const readRef = (ref) => ref?.current ?? null;

/**
 * Manejo de foco de un diálogo (mismo enfoque que admin/ConfirmDialog):
 * - al abrir, foco en `initialFocusRef` (p. ej. "Cerrar") o en el contenedor;
 * - Tab y Shift+Tab quedan atrapados dentro de `containerRef`;
 * - Escape llama a `onEscape` (si se pasa);
 * - al cerrar, el foco vuelve a `returnFocusRef` (si el disparador se volvió a montar) o al
 *   elemento que tenía el foco al abrir.
 * `containerRef` puede ser cualquier objeto con `current` (también un getter).
 */
export function useDialogFocus(active, { containerRef, initialFocusRef, returnFocusRef, onEscape } = {}) {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => { onEscapeRef.current = onEscape; }, [onEscape]);
  // Devolución de foco pendiente y disparador original. Si el efecto se vuelve a montar antes de que
  // corra la devolución (StrictMode en desarrollo), se cancela y se conserva el disparador original.
  const restoreTimer = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const token = {};
    stack.push(token);
    if (restoreTimer.current) {
      clearTimeout(restoreTimer.current);
      restoreTimer.current = null;
    } else {
      triggerRef.current = document.activeElement;
    }
    const first = initialFocusRef?.current || containerRef?.current;
    first?.focus?.({ preventScroll: true });

    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        if (onEscapeRef.current) {
          e.preventDefault();
          onEscapeRef.current();
        }
        return;
      }
      const root = containerRef?.current;
      if (e.key !== 'Tab' || !root) return;
      const focusables = [...root.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      } else if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      // Tras el commit: en pantalla completa el disparador se desmonta y vuelve a montarse al cerrar
      restoreTimer.current = setTimeout(() => {
        restoreTimer.current = null;
        const ret = readRef(returnFocusRef);
        const target = (ret?.isConnected && ret) || triggerRef.current;
        if (target && target.isConnected && typeof target.focus === 'function') {
          target.focus({ preventScroll: true });
        }
      }, 0);
    };
    // Solo al abrir/cerrar; las refs se leen en el momento de usarse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

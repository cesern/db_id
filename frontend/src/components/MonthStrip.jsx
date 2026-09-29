import React, { useContext, useRef, useState } from 'react';
import { MesFinalContext } from '../utils/mesFinalContext';
import { monthsLabel } from '../utils/labels';

// Nombres completos (valor del filtro), cortos (escritorio) e iniciales (móvil)
const NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const INICIALES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const rango = (a, b) => {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
};
// Índices → nombres en orden de calendario
const aNombres = (set) => [...set].sort((a, b) => a - b).map(i => NOMBRES[i]);

/**
 * Tira de 12 meses: clic = solo ese mes; arrastre = rango contiguo; Shift+clic = rango desde el ancla;
 * Ctrl/Cmd+clic = alterna uno. Selección vacía = año completo. Meses posteriores al último publicado
 * (si el año/dataset elegidos coinciden con los aplicados) llevan rayado y la pista "Aún no publicado".
 */
const MonthStrip = ({ meses, onChange, mesFinalAplica }) => {
  const mesFinalCtx = useContext(MesFinalContext);
  const mesFinal = mesFinalAplica && typeof mesFinalCtx === 'number' ? mesFinalCtx : null;
  const seleccion = new Set((meses || []).map(m => NOMBRES.indexOf(m)).filter(i => i >= 0));

  const [cursor, setCursor] = useState(0);
  const [arrastre, setArrastre] = useState(null); // true mientras se arrastra (solo para quitar la transición)
  const anclaRef = useRef(0);
  const inicioArrastreRef = useRef(null); // ref: el relleno sigue al puntero sin esperar un render

  const emitir = (set) => onChange(aNombres(set));

  const indiceEnPunto = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-mes]');
    return el ? Number(el.dataset.mes) : null;
  };

  const onPointerDown = (e, i) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.parentElement.focus({ preventScroll: true });
    setCursor(i);
    if (e.shiftKey) {
      emitir(new Set(rango(anclaRef.current, i)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const s = new Set(seleccion);
      if (s.has(i)) s.delete(i); else s.add(i);
      anclaRef.current = i;
      emitir(s);
      return;
    }
    anclaRef.current = i;
    e.currentTarget.parentElement.setPointerCapture?.(e.pointerId);
    inicioArrastreRef.current = i;
    setArrastre({ inicio: i });
    emitir(new Set([i]));
  };

  const onPointerMove = (e) => {
    if (inicioArrastreRef.current === null) return;
    const i = indiceEnPunto(e.clientX, e.clientY);
    if (i === null) return;
    setCursor(i);
    emitir(new Set(rango(inicioArrastreRef.current, i)));
  };

  const finArrastre = () => { inicioArrastreRef.current = null; setArrastre(null); };

  const onKeyDown = (e) => {
    let nuevo = cursor;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nuevo = Math.min(11, cursor + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nuevo = Math.max(0, cursor - 1);
    else if (e.key === 'Home') nuevo = 0;
    else if (e.key === 'End') nuevo = 11;
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const s = new Set(seleccion);
      if (s.has(cursor)) s.delete(cursor); else s.add(cursor);
      anclaRef.current = cursor;
      emitir(s);
      return;
    } else return;
    e.preventDefault();
    setCursor(nuevo);
    if (e.shiftKey) emitir(new Set(rango(anclaRef.current, nuevo)));
    else anclaRef.current = nuevo;
  };

  const n = seleccion.size;
  const resumen = n === 0 ? 'Año completo' : `${monthsLabel(meses) || 'Ene–Dic'} · ${n} ${n === 1 ? 'mes' : 'meses'}`;
  const idBase = 'month-strip-opt-';

  return (
    <div className="month-strip-wrap">
      <div className="month-strip-summary">
        <span className="tabular" aria-live="polite">{resumen}</span>
        {n > 0 && (
          <button type="button" className="month-strip-clear" onClick={() => emitir(new Set())}>
            Limpiar meses
          </button>
        )}
      </div>
      <div
        className={`month-strip${arrastre ? ' is-dragging' : ''}${n === 0 ? ' is-empty' : ''}`}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Meses (sin selección = año completo)"
        aria-activedescendant={`${idBase}${cursor}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerUp={finArrastre}
        onPointerCancel={finArrastre}
      >
        {NOMBRES.map((nombre, i) => {
          const sel = seleccion.has(i);
          const noPublicado = mesFinal !== null && i + 1 > mesFinal;
          return (
            <div
              key={nombre}
              id={`${idBase}${i}`}
              data-mes={i}
              role="option"
              aria-selected={sel}
              aria-label={noPublicado ? `${nombre}, aún no publicado` : nombre}
              title={noPublicado ? `${nombre} · Aún no publicado` : nombre}
              className={`month-seg${sel ? ' is-selected' : ''}${noPublicado ? ' is-unpublished' : ''}${i === cursor ? ' is-cursor' : ''}`}
              onPointerDown={(e) => onPointerDown(e, i)}
            >
              <span className="month-seg-long" aria-hidden="true">{CORTOS[i]}</span>
              <span className="month-seg-short" aria-hidden="true">{INICIALES[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthStrip;

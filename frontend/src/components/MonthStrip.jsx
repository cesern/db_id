import React, { useContext, useId, useRef, useState } from 'react';
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
// Nombres → conjunto de índices (ignora valores desconocidos)
const aIndices = (lista) => new Set((lista || []).map(m => NOMBRES.indexOf(m)).filter(i => i >= 0));
const mismos = (a, b) => a.size === b.size && [...a].every(i => b.has(i));

// Resumen visible y texto del anuncio para lector de pantalla
const resumenDe = (set) => {
  const n = set.size;
  return n === 0 ? 'Año completo' : `${monthsLabel(aNombres(set)) || 'Ene–Dic'} · ${n} ${n === 1 ? 'mes' : 'meses'}`;
};
const anuncioDe = (set) => {
  const n = set.size;
  return n === 0 ? 'Meses: año completo' : `Meses: ${monthsLabel(aNombres(set)) || 'Ene–Dic'}, ${n} ${n === 1 ? 'mes elegido' : 'meses elegidos'}`;
};

/**
 * Tira de 12 meses. Ratón: clic = solo ese mes; arrastre = rango contiguo; Shift+clic = rango desde el
 * ancla; Ctrl/Cmd+clic = alterna uno. Táctil: toque = alterna ese mes (conserva el resto); deslizar en
 * horizontal = rango. Selección vacía = año completo. Meses posteriores al último publicado (si el
 * año/dataset elegidos coinciden con los aplicados) llevan rayado y la pista "Aún no publicado".
 * onApplyShortcut(meses): periodos rápidos (Ene–{último publicado}, trimestres, semestres, año) que
 * eligen y aplican en un solo paso.
 */
const MonthStrip = ({ meses, mesesAplicados, onChange, onApplyShortcut, mesFinalAplica }) => {
  const mesFinalCtx = useContext(MesFinalContext);
  const mesFinal = mesFinalAplica && typeof mesFinalCtx === 'number' ? mesFinalCtx : null;
  const seleccion = aIndices(meses);
  const aplicados = aIndices(mesesAplicados);

  const [cursor, setCursor] = useState(0);
  const [arrastre, setArrastre] = useState(null); // true mientras se arrastra (solo para quitar la transición)
  const [presionado, setPresionado] = useState(null); // segmento donde empezó la presión (escala 0.97)
  const [anuncio, setAnuncio] = useState(''); // región aria-live: solo cambios confirmados
  const uid = useId();
  const anclaRef = useRef(0);
  const stripRef = useRef(null);
  const inicioArrastreRef = useRef(null); // ref: el relleno sigue al puntero sin esperar un render
  const ultimoSetRef = useRef(null); // última selección emitida durante el arrastre (se anuncia al soltar)

  // anunciar=false durante el arrastre: el lector solo oye el resultado al soltar
  const emitir = (set, anunciar = true) => {
    onChange(aNombres(set));
    if (anunciar) setAnuncio(anuncioDe(set));
    else ultimoSetRef.current = set;
  };

  const indiceEnPunto = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-mes]');
    return el ? Number(el.dataset.mes) : null;
  };

  // Toque pendiente: { x, y, i, id } hasta decidir si es tap, arrastre horizontal o desplazamiento vertical
  const toqueRef = useRef(null);
  const ultimoIdxRef = useRef(null);

  const iniciarArrastre = (strip, pointerId, i) => {
    try { strip.setPointerCapture?.(pointerId); } catch { /* puntero ya liberado: el arrastre sigue sin captura */ }
    anclaRef.current = i;
    inicioArrastreRef.current = i;
    ultimoIdxRef.current = i;
    setArrastre(true);
    setCursor(i);
    emitir(new Set([i]), false);
  };

  const alternar = (i) => {
    const s = new Set(seleccion);
    if (s.has(i)) s.delete(i); else s.add(i);
    anclaRef.current = i;
    setCursor(i);
    emitir(s);
  };

  const onPointerDown = (e, i) => {
    if (e.button !== 0) return;
    const strip = e.currentTarget.parentElement;
    setPresionado(i);
    if (e.pointerType === 'touch') {
      // Sin preventDefault: el navegador puede desplazar la página si el gesto es vertical
      toqueRef.current = { x: e.clientX, y: e.clientY, i, id: e.pointerId };
      return;
    }
    e.preventDefault();
    strip.focus({ preventScroll: true });
    // Captura siempre: el pointerup llega a la tira aunque se suelte fuera (quita la escala de presión)
    try { strip.setPointerCapture?.(e.pointerId); } catch { /* sin captura: pointercancel limpia */ }
    setCursor(i);
    if (e.shiftKey) {
      emitir(new Set(rango(anclaRef.current, i)));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      alternar(i);
      return;
    }
    iniciarArrastre(strip, e.pointerId, i);
  };

  const onPointerMove = (e) => {
    const t = toqueRef.current;
    if (t && inicioArrastreRef.current === null) {
      const dx = Math.abs(e.clientX - t.x);
      const dy = Math.abs(e.clientY - t.y);
      if (dx > 8 && dx > dy) {
        toqueRef.current = null;
        iniciarArrastre(e.currentTarget, t.id, t.i);
        setPresionado(null); // al arrastrar ya no es una presión: sin escala
      } else if (dy > 8) {
        toqueRef.current = null; // gesto vertical: se suelta para que la página se desplace
        setPresionado(null);
      }
      if (inicioArrastreRef.current === null) return;
    }
    if (inicioArrastreRef.current === null) return;
    const i = indiceEnPunto(e.clientX, e.clientY);
    if (i === null || i === ultimoIdxRef.current) return; // emitir solo al cambiar de mes
    ultimoIdxRef.current = i;
    setPresionado(null); // el arrastre ya salió del mes inicial: sin escala
    setCursor(i);
    emitir(new Set(rango(inicioArrastreRef.current, i)), false);
  };

  const onPointerUp = () => {
    const t = toqueRef.current;
    if (t) {
      // Toque sin arrastre: alterna ese mes y conserva el resto de la selección
      toqueRef.current = null;
      alternar(t.i);
    } else if (inicioArrastreRef.current !== null && ultimoSetRef.current) {
      // Fin del arrastre: se anuncia una sola vez el rango final
      setAnuncio(anuncioDe(ultimoSetRef.current));
    }
    finArrastre();
  };

  const finArrastre = () => {
    toqueRef.current = null;
    inicioArrastreRef.current = null;
    ultimoIdxRef.current = null;
    ultimoSetRef.current = null;
    setArrastre(null);
    setPresionado(null);
  };

  // Al recibir el foco, el cursor va al primer mes elegido (o a Enero)
  const onFocus = () => {
    if (inicioArrastreRef.current !== null) return;
    const primero = seleccion.size ? Math.min(...seleccion) : 0;
    setCursor(primero);
  };

  const onKeyDown = (e) => {
    let nuevo = cursor;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nuevo = Math.min(11, cursor + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nuevo = Math.max(0, cursor - 1);
    else if (e.key === 'Home') nuevo = 0;
    else if (e.key === 'End') nuevo = 11;
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      alternar(cursor);
      return;
    } else return;
    e.preventDefault();
    setCursor(nuevo);
    if (e.shiftKey) emitir(new Set(rango(anclaRef.current, nuevo)));
    else anclaRef.current = nuevo;
  };

  const n = seleccion.size;
  const pendiente = !mismos(seleccion, aplicados);
  const idBase = `${uid}-opt-`;

  // Periodos rápidos: cada chip elige y aplica en un paso (onApplyShortcut → handleApply(nextFilters)).
  // "Ene–{último publicado}" solo con año incompleto y último mes conocido; "Año" = sin filtro de meses.
  const tramo = (a, b) => new Set(rango(a, b));
  const grupos = [
    mesFinal !== null && mesFinal >= 1 && mesFinal < 12
      ? [{ id: 'pub', texto: mesFinal === 1 ? 'Ene' : `Ene–${CORTOS[mesFinal - 1]}`, titulo: 'Hasta el último mes publicado', set: tramo(0, mesFinal - 1) }]
      : [],
    [
      { id: 't1', texto: 'T1', titulo: '1er trimestre: Ene–Mar', set: tramo(0, 2) },
      { id: 't2', texto: 'T2', titulo: '2º trimestre: Abr–Jun', set: tramo(3, 5) },
      { id: 't3', texto: 'T3', titulo: '3er trimestre: Jul–Sep', set: tramo(6, 8) },
      { id: 't4', texto: 'T4', titulo: '4º trimestre: Oct–Dic', set: tramo(9, 11) },
    ],
    [
      { id: 's1', texto: '1er sem', titulo: '1er semestre: Ene–Jun', set: tramo(0, 5) },
      { id: 's2', texto: '2º sem', titulo: '2º semestre: Jul–Dic', set: tramo(6, 11) },
    ],
    // "Año" no lleva rayado: significa "sin filtro de meses", no un periodo concreto
    [{ id: 'anio', texto: 'Año', titulo: 'Año completo (sin filtro de meses)', set: new Set(), anio: true }],
  ].filter(g => g.length > 0);
  const aplicarPeriodo = (set) => {
    anclaRef.current = set.size ? Math.min(...set) : 0;
    setAnuncio(`${anuncioDe(set)}, aplicado`);
    onApplyShortcut(aNombres(set));
    stripRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="month-strip-wrap">
      <div className="month-strip-summary">
        <span className="month-strip-status">
          <span className="tabular">
            {resumenDe(seleccion)}
            {pendiente && <span className="month-strip-pending"> · sin aplicar</span>}
          </span>
          {/* Siempre montado: reserva su espacio para que el resumen no salte */}
          <button
            type="button"
            className={`month-strip-clear${n === 0 ? ' is-hidden' : ''}`}
            onClick={() => emitir(new Set())}
            aria-hidden={n === 0 || undefined}
            tabIndex={n === 0 ? -1 : undefined}
          >
            Limpiar meses
          </button>
        </span>
        {onApplyShortcut && (
          <div className="month-quick" role="group" aria-label="Periodos rápidos (eligen y aplican)">
            {grupos.map((grupo, gi) => (
              <React.Fragment key={grupo[0].id}>
                {gi > 0 && <span className="month-quick-sep" aria-hidden="true" />}
                {grupo.map(p => {
                  const activo = p.anio ? n === 0 : mismos(seleccion, p.set);
                  const noPublicado = !p.anio && mesFinal !== null && [...p.set].some(i => i + 1 > mesFinal);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`month-chip${activo ? ' is-active' : ''}${noPublicado ? ' is-unpublished' : ''}`}
                      aria-pressed={activo}
                      title={noPublicado ? `${p.titulo} · aún no publicado` : p.titulo}
                      onClick={() => aplicarPeriodo(p.set)}
                    >
                      {p.texto}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
      <div
        ref={stripRef}
        className={`month-strip${arrastre ? ' is-dragging' : ''}${n === 0 ? ' is-empty' : ''}`}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Meses (sin selección = año completo)"
        aria-activedescendant={`${idBase}${cursor}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onFocus={onFocus}
        onPointerCancel={finArrastre}
      >
        {NOMBRES.map((nombre, i) => {
          const sel = seleccion.has(i);
          const noPublicado = mesFinal !== null && i + 1 > mesFinal;
          // Banda: solo el primer y el último segmento de cada tramo contiguo redondean su lado exterior
          const inicioTramo = sel && !seleccion.has(i - 1);
          const finTramo = sel && !seleccion.has(i + 1);
          return (
            <div
              key={nombre}
              id={`${idBase}${i}`}
              data-mes={i}
              role="option"
              aria-selected={sel}
              aria-label={noPublicado ? `${nombre}, aún no publicado` : nombre}
              title={noPublicado ? `${nombre} · Aún no publicado` : nombre}
              className={`month-seg${sel ? ' is-selected' : ''}${inicioTramo ? ' run-start' : ''}${finTramo ? ' run-end' : ''}${noPublicado ? ' is-unpublished' : ''}${i === cursor ? ' is-cursor' : ''}${presionado === i ? ' is-pressed' : ''}`}
              onPointerDown={(e) => onPointerDown(e, i)}
            >
              <span className="month-seg-long" aria-hidden="true">{CORTOS[i]}</span>
              <span className="month-seg-short" aria-hidden="true">{INICIALES[i]}</span>
            </div>
          );
        })}
      </div>
      {n === 0 && (
        <p className="month-strip-hint" aria-hidden="true">
          <span className="month-strip-hint-fine">Arrastra para elegir un rango · Ctrl+clic para sumar meses</span>
          <span className="month-strip-hint-coarse">Toca para elegir meses · desliza para un rango</span>
        </p>
      )}
      {/* Anuncio para lector de pantalla: al soltar un arrastre, con teclado, toque o atajo */}
      <span className="sr-only" aria-live="polite">{anuncio}</span>
    </div>
  );
};

export default MonthStrip;

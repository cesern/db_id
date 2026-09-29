import React, { useContext, useId, useRef, useState } from 'react';
import { MesFinalContext } from '../utils/mesFinalContext';
import { monthsLabel } from '../utils/labels';

// Nombres completos (valor del filtro), cortos (escritorio) e iniciales (móvil)
const NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const INICIALES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
// Regla de periodos: fila 1 = trimestres, fila 2 = semestres (desde = índice del primer mes)
const TRAMOS = [
  { id: 't1', fila: 1, desde: 0, largo: 3, largoTexto: '1er trimestre', corto: 'T1', rango: 'Ene–Mar', meses: 'enero a marzo' },
  { id: 't2', fila: 1, desde: 3, largo: 3, largoTexto: '2º trimestre', corto: 'T2', rango: 'Abr–Jun', meses: 'abril a junio' },
  { id: 't3', fila: 1, desde: 6, largo: 3, largoTexto: '3er trimestre', corto: 'T3', rango: 'Jul–Sep', meses: 'julio a septiembre' },
  { id: 't4', fila: 1, desde: 9, largo: 3, largoTexto: '4º trimestre', corto: 'T4', rango: 'Oct–Dic', meses: 'octubre a diciembre', ultimo: true },
  { id: 's1', fila: 2, desde: 0, largo: 6, largoTexto: '1er semestre', corto: '1er sem', rango: 'Ene–Jun', meses: 'enero a junio' },
  { id: 's2', fila: 2, desde: 6, largo: 6, largoTexto: '2º semestre', corto: '2º sem', rango: 'Jul–Dic', meses: 'julio a diciembre', ultimo: true },
];

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
 * onApplyShortcut(meses): periodos rápidos que eligen y aplican en un solo paso: chips "Ene–{último
 * publicado}" y "Año" junto al resumen, y regla de trimestres/semestres alineada bajo la tira.
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

  // Periodos rápidos: cada botón elige y aplica en un paso (onApplyShortcut → handleApply(nextFilters)).
  const aplicarPeriodo = (set) => {
    anclaRef.current = set.size ? Math.min(...set) : 0;
    setAnuncio(`${anuncioDe(set)}, aplicado`);
    onApplyShortcut(aNombres(set));
    stripRef.current?.focus({ preventScroll: true });
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

  // Chips junto al resumen: "Ene–{último publicado}" (solo con año incompleto y último mes conocido) y "Año"
  const hastaPublicado = mesFinal !== null && mesFinal >= 1 && mesFinal < 12 ? new Set(rango(0, mesFinal - 1)) : null;
  const chips = [
    ...(hastaPublicado ? [{
      id: 'pub', texto: mesFinal === 1 ? 'Ene' : `Ene–${CORTOS[mesFinal - 1]}`, titulo: 'Hasta el último mes publicado',
      etiqueta: `Hasta el último mes publicado: enero a ${NOMBRES[mesFinal - 1].toLowerCase()}`,
      set: hastaPublicado, activo: mismos(seleccion, hastaPublicado)
    }] : []),
    { id: 'anio', texto: 'Año', titulo: 'Año completo (sin filtro de meses)', etiqueta: 'Año completo, sin filtro de meses', set: new Set(), activo: n === 0 },
  ];
  // Un solo manejador: el chip se identifica por data-periodo
  const onChipClick = (e) => {
    const chip = chips.find(c => c.id === e.currentTarget.dataset.periodo);
    if (chip) aplicarPeriodo(chip.set);
  };

  return (
    <div className="month-strip-wrap">
      <div className="month-strip-summary">
        <span className="month-strip-status">
          <span className="tabular">
            {resumenDe(seleccion)}
            {n === 0 && (
              // Pista de gesto: solo sin meses elegidos, en texto secundario dentro del propio resumen
              <span className="month-strip-hint" aria-hidden="true">
                <span className="month-strip-hint-fine"> · Arrastra para elegir un rango · Ctrl+clic para sumar</span>
                <span className="month-strip-hint-coarse"> · Toca para elegir meses · desliza para un rango</span>
              </span>
            )}
            {pendiente && <span className="month-strip-pending"> · sin aplicar</span>}
          </span>
          {onApplyShortcut && chips.map(c => (
            <button
              key={c.id}
              type="button"
              className={`month-chip${c.activo ? ' is-active' : ''}`}
              aria-pressed={c.activo}
              aria-label={c.etiqueta}
              title={c.titulo}
              data-periodo={c.id}
              onClick={onChipClick}
            >
              {c.texto}
            </button>
          ))}
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
      {/* Regla de periodos bajo la tira: misma rejilla de 12 columnas, así los bordes coinciden con los meses */}
      {onApplyShortcut && (
        <div className="month-ruler" role="group" aria-label="Periodos rápidos">
          {TRAMOS.map(t => {
            const set = new Set(rango(t.desde, t.desde + t.largo - 1));
            const activo = mismos(seleccion, set);
            // Meses del tramo posteriores al último publicado: se rayan solo esas columnas (desde la derecha)
            const sinPublicar = mesFinal === null ? 0 : Math.max(0, Math.min(t.largo, t.desde + t.largo - mesFinal));
            return (
              <button
                key={t.id}
                type="button"
                className={`month-tramo fila-${t.fila}${activo ? ' is-active' : ''}${sinPublicar > 0 ? ' is-unpublished' : ''}${t.ultimo ? ' is-last' : ''}`}
                style={{ gridColumn: `${t.desde + 1} / span ${t.largo}`, gridRow: t.fila, ...(sinPublicar > 0 ? { '--sin-publicar': `${(sinPublicar / t.largo) * 100}%` } : {}) }}
                aria-pressed={activo}
                aria-label={`${t.largoTexto}: ${t.meses}${sinPublicar > 0 ? ', con meses aún no publicados' : ''}`}
                title={`${t.largoTexto}: ${t.rango}${sinPublicar > 0 ? ' · aún no publicado' : ''}`}
                onClick={() => aplicarPeriodo(set)}
              >
                <span className="month-tramo-long" aria-hidden="true">{t.largoTexto}</span>
                <span className="month-tramo-short" aria-hidden="true">{t.corto}</span>
              </button>
            );
          })}
        </div>
      )}
      {/* Anuncio para lector de pantalla: al soltar un arrastre, con teclado, toque o atajo */}
      <span className="sr-only" aria-live="polite">{anuncio}</span>
    </div>
  );
};

export default MonthStrip;

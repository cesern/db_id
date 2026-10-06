import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { filtrarOpciones } from '../utils/buscar';

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * Selector de UN valor. Con pocas opciones (<= umbral) es el <select> nativo (en celular da el
 * selector del sistema); con más, un disparador <button> + diálogo con buscador sin acentos, hermano
 * de MultiSelectDropdown. options: [{ value, label }]; onChange recibe el valor (no el evento).
 * variant 'field' = caja de formulario (.input-select, rotulada por el llamador con htmlFor=id y
 * labelId); 'pill' = pastilla del título de Rankings (.title-select, rotulada con ariaLabel).
 */
const SearchableSelect = ({
  id, value, options, onChange, disabled = false, variant = 'field', ariaLabel, labelId,
  describedBy, selectRef, threshold = 12, className = '', style,
}) => {
  const uid = useId();
  const triggerId = id || `${uid}-trigger`;
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [arriba, setArriba] = useState(false); // sin espacio debajo, la lista se abre hacia arriba
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const isPill = variant === 'pill';

  const lista = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const actual = lista.find(o => o.value === value) || lista[0] || { value: '', label: '' };
  const visibles = useMemo(() => filtrarOpciones(lista, term), [lista, term]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const fuera = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', fuera);
    // La opción elegida a la vista al abrir (listas largas)
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    return () => document.removeEventListener('mousedown', fuera);
  }, [isOpen]);

  // Sin opciones que buscar: el <select> nativo
  if (lista.length <= threshold) {
    if (isPill) {
      return (
        <span className={`title-select${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
          <span className="title-select-value" aria-hidden="true">
            <span className="title-select-text">{actual.label}</span>
            <Chevron />
          </span>
          <select
            id={id} ref={selectRef} value={value} disabled={disabled} className="title-select-native"
            aria-label={ariaLabel} aria-describedby={describedBy}
            onChange={e => onChange(e.target.value)}
          >
            {lista.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </span>
      );
    }
    return (
      <select
        id={id} ref={selectRef} value={value} disabled={disabled} className={`input-select ${className}`.trim()}
        style={style} aria-label={labelId ? undefined : ariaLabel} aria-labelledby={labelId} aria-describedby={describedBy}
        onChange={e => onChange(e.target.value)}
      >
        {lista.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  const cerrar = (devolverFoco = true) => {
    setIsOpen(false);
    setTerm('');
    if (devolverFoco) triggerRef.current?.focus({ preventScroll: true });
  };
  const elegir = (v) => { cerrar(); if (v !== value) onChange(v); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Del buscador a las opciones y entre ellas, sin un Tab por opción
      const items = [e.currentTarget.querySelector('input'), ...e.currentTarget.querySelectorAll('[role="option"]')];
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    }
  };

  const nombre = `${ariaLabel || ''}${ariaLabel ? ': ' : ''}${actual.label}`;
  return (
    <span
      ref={wrapRef}
      style={{ position: 'relative', display: isPill ? 'inline-flex' : 'block', maxWidth: '100%', minWidth: 0 }}
      // Tab hacia fuera del selector cierra la lista (con el foco en otro lado, no queda flotando).
      // relatedTarget nulo (barra de desplazamiento, clic en vacío) no cuenta.
      onBlur={(e) => { if (isOpen && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget)) cerrar(false); }}
    >
      <button
        type="button"
        id={triggerId}
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={describedBy}
        {...(isPill
          ? { 'aria-label': nombre }
          : labelId ? { 'aria-labelledby': `${labelId} ${triggerId}` } : { 'aria-label': nombre })}
        title={actual.label}
        className={isPill ? `title-select${disabled ? ' is-disabled' : ''} ${className}`.trim() : `input-select ${className}`.trim()}
        style={isPill
          ? { cursor: disabled ? 'not-allowed' : 'pointer', gap: '0.3em', textAlign: 'left' }
          : { cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', ...style }}
        onClick={() => {
          if (isOpen) { cerrar(false); return; }
          const r = triggerRef.current?.getBoundingClientRect();
          if (r) { const debajo = window.innerHeight - r.bottom; setArriba(debajo < 340 && r.top > debajo); }
          setIsOpen(true);
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{actual.label}</span>
        {isPill && <Chevron />}
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label={`Opciones de ${ariaLabel || actual.label}`}
          onKeyDown={onKeyDown}
          style={{
            position: 'absolute', left: 0, minWidth: isPill ? '260px' : '100%',
            ...(arriba ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }), zIndex: 100, backgroundColor: 'white', border: '1px solid var(--border-color)',
            borderRadius: '8px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
            maxHeight: '320px', fontFamily: 'inherit', lineHeight: 1.4, fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-primary)',
          }}
        >
          <div style={{ padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
            <input
              type="search"
              autoFocus
              aria-label={`Buscar en ${ariaLabel || 'opciones'}`}
              placeholder="Buscar..."
              value={term}
              onChange={e => setTerm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && visibles.length > 0) { e.preventDefault(); elegir(visibles[0].value); } }}
              className="ss-search"
              style={{ width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 400 }}
            />
            <div className="tabular" aria-live="polite" style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {term ? `${visibles.length} de ${lista.length}` : `${lista.length} opciones`}
            </div>
          </div>
          <div role="listbox" aria-label={ariaLabel || 'Opciones'} ref={listRef} style={{ overflowY: 'auto', flex: 1 }}>
            {visibles.length === 0 ? (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Ninguna opción coincide con “{term}”
              </div>
            ) : visibles.map((o, idx) => {
              const sel = o.value === value;
              // Con texto en el buscador, Enter elige la primera coincidencia: se resalta y lo dice
              const primera = term !== '' && idx === 0;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  key={o.value}
                  title={o.label}
                  className={`ss-option${primera ? ' is-first' : ''}`}
                  onClick={() => elegir(o.value)}
                >
                  <span aria-hidden="true" style={{ width: '1rem', fontWeight: 800, flexShrink: 0 }}>{sel ? '✓' : ''}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                  {primera && <span className="ss-option-hint" aria-hidden="true">Enter</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
};

export default SearchableSelect;

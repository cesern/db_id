import React, { useState, useEffect, useRef } from 'react';

/**
 * Selector compacto con menú (mismo aspecto que "Letra chica ▾" de la gráfica de barras).
 * options: [{ value, label }]; el botón muestra `prefix` + la etiqueta activa.
 */
const MenuSelect = ({ value, options, onChange, title, prefix = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const active = options.find(o => o.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setIsOpen(false); } };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        title={title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
          borderRadius: '8px', border: '1px solid var(--border-color)',
          background: '#ffffff', color: 'var(--text-secondary)', cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap'
        }}
      >
        {prefix}{active.label}
        <span aria-hidden="true" style={{ fontSize: '0.6rem', color: 'var(--color-accent)' }}>▾</span>
      </button>
      {isOpen && (
        <div
          role="menu"
          className="menu-select-pop"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: '150px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '10px', boxShadow: 'var(--shadow-lg)', padding: '0.35rem', zIndex: 9999
          }}
        >
          {options.map(o => {
            const selected = o.value === value;
            return (
              <button
                type="button"
                key={o.value}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => { onChange(o.value); setIsOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  padding: '0.45rem 0.6rem', border: 'none', borderRadius: '7px',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: selected ? 700 : 500,
                  color: selected ? 'var(--color-accent)' : 'var(--text-primary)',
                  background: selected ? 'var(--color-accent-light, #eceef5)' : 'transparent'
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = 'var(--bg-main)'; }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span style={{ width: '1rem', fontWeight: 800 }}>{selected ? '✓' : ''}</span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MenuSelect;

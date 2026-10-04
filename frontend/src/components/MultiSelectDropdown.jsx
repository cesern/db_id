import React, { useState, useEffect, useRef, useId } from 'react';

// Selector múltiple con buscador (filtros del tablero y de Rankings): disparador <button>,
// casillas reales, "Seleccionar todo" con estado indeterminado y Escape que devuelve el foco.
const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const uid = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const masterCheckboxRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const safeSelected = Array.isArray(selected) ? selected : [];
  const safeOptions = Array.isArray(options) ? options : [];
  
  const filteredOptions = safeOptions.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const visibleSelectedCount = filteredOptions.filter(opt => safeSelected.includes(opt)).length;
  const isAllVisibleSelected = filteredOptions.length > 0 && visibleSelectedCount === filteredOptions.length;
  const isIndeterminate = visibleSelectedCount > 0 && visibleSelectedCount < filteredOptions.length;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggle = (opt) => {
    if (safeSelected.includes(opt)) {
      onChange(safeSelected.filter(item => item !== opt));
    } else {
      onChange([...safeSelected, opt]);
    }
  };

  const handleMasterChange = () => {
    if (isAllVisibleSelected) {
      onChange(safeSelected.filter(opt => !filteredOptions.includes(opt)));
    } else {
      const nextSelected = [...new Set([...safeSelected, ...filteredOptions])];
      onChange(nextSelected);
    }
  };

  const handleLimpiar = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  let displayText = "Todos";
  if (safeSelected.length > 0 && safeSelected.length < safeOptions.length) {
    if (safeSelected.length <= 3) {
      displayText = safeSelected.join(', ');
    } else {
      displayText = `${safeSelected.slice(0, 3).join(', ')} ... +${safeSelected.length - 3}`;
    }
  }

  return (
    <div style={{ position: 'relative', flex: '1 1 min(100%, 180px)' }} ref={containerRef}>
      <label className="label-sm" id={`${uid}-label`} htmlFor={`${uid}-trigger`}>{label}</label>
      <button
        type="button"
        id={`${uid}-trigger`}
        className="input-select"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-labelledby={`${uid}-label ${uid}-trigger`}
        style={{ cursor: 'pointer', userSelect: 'none', minHeight: 'var(--input-min-height, 30px)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
        onClick={() => setIsOpen(!isOpen)}
        title={displayText}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayText}</span>
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label={`Opciones de ${label}`}
          onKeyDown={(e) => {
            // Flechas: del buscador a "Seleccionar todo" y entre las opciones (sin un Tab por casilla)
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              const items = [...e.currentTarget.querySelectorAll('input')];
              const i = items.indexOf(document.activeElement);
              if (i < 0) return;
              e.preventDefault();
              items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              document.getElementById(`${uid}-trigger`)?.focus();
            }
          }}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            minWidth: '220px',
            backgroundColor: 'white', border: '1px solid var(--border-color)',
            borderRadius: '8px', marginTop: '4px', zIndex: 100,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '350px'
          }}
        >
          {/* Sección Fija Superior */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)',
            borderTopLeftRadius: '8px', borderTopRightRadius: '8px',
            padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'
          }}>
            <input
              type="search"
              autoFocus
              aria-label={`Buscar en ${label}`}
              placeholder="Buscar opciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '0.45rem 0.55rem',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                fontSize: '0.8125rem'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  ref={masterCheckboxRef}
                  checked={isAllVisibleSelected}
                  onChange={handleMasterChange}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Seleccionar todo</span>
              </label>

              <button
                type="button"
                onClick={handleLimpiar}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-accent)',
                  fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 700, padding: '2px 4px'
                }}
              >
                Limpiar
              </button>
            </div>

            <div className="tabular" aria-live="polite" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {safeSelected.length} de {safeOptions.length} seleccionados
            </div>
          </div>

          {/* Contenedor Scrolleable de Opciones */}
          <div role="group" aria-label={label} style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Ninguna opción coincide con “{searchTerm}”
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSel = safeSelected.includes(opt);
                return (
                  <label
                    key={opt}
                    title={opt}
                    style={{
                      padding: '0.55rem 0.75rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: '0.5rem',
                      background: isSel ? 'var(--color-accent-light)' : 'white',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => handleToggle(opt)}
                      style={{ cursor: 'pointer', accentColor: 'var(--color-accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;

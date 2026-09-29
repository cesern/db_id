import React, { useState, useEffect, useRef, useId } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { ALTO_IMPACTO_PRESETS, parseCapsule } from '../utils/altoImpacto';
import AltoImpactoModal from './AltoImpactoModal';
import { monthsLabel } from '../utils/labels';
import MonthStrip from './MonthStrip';


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
        aria-haspopup="listbox"
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

// ── Utilidad: contar diferencias entre selectedFilters y appliedFilters ─────────
function countPendingChanges(selected, applied) {
  if (!applied) return 0;
  let count = 0;
  if (selected.anio !== applied.anio) count++;
  if (selected.entidad !== applied.entidad) count++;
  if (selected.municipio !== applied.municipio) count++;

  const arrayFields = ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'meses', 'sexo', 'rangoEdad', 'altoImpacto'];
  for (const field of arrayFields) {
    const a = Array.isArray(selected[field]) ? selected[field] : [];
    const b = Array.isArray(applied[field]) ? applied[field] : [];
    if (a.length !== b.length || a.some(v => !b.includes(v))) count++;
  }
  return count;
}

const isVictimasDataset = (d) => d === 'victimas' || d === 'victimas_mun';

// ── Filters Component ──────────────────────────────────────────────────────────
const Filters = ({ dataset, metricType, setMetricType, selectedFilters, setSelectedFilters, appliedFilters, onApply, onClear, onInitialLoadComplete, customCapsules, onAddCustomCapsule, onRemoveCustomCapsule }) => {
  const isAltoImpacto = dataset === 'alto_impacto';
  const wireDataset = isAltoImpacto ? 'delitos' : dataset;
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  // Móvil: la barra de filtros inicia plegada para que los datos aparezcan primero
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // Grupo secundario "Delito": plegable, abierto por defecto; recuerda la preferencia
  const [isDelitoOpen, setIsDelitoOpen] = useState(() => {
    try { return localStorage.getItem('filters.delitoOpen') !== '0'; } catch { return true; }
  });
  const toggleDelito = () => setIsDelitoOpen(v => {
    try { localStorage.setItem('filters.delitoOpen', v ? '0' : '1'); } catch { /* noop */ }
    return !v;
  });
  const activeDelitoCount = ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'sexo', 'rangoEdad']
    .reduce((n, k) => n + (Array.isArray(selectedFilters[k]) && selectedFilters[k].length > 0 ? 1 : 0), 0);
  const [filtrosOpciones, setFiltrosOpciones] = useState({
    anios: [],
    entidades: [],
    bienesJuridicos: [],
    tiposDelito: [],
    subtiposDelito: [],
    modalidades: [],
    municipios: [],
    sexos: [],
    rangosEdad: []
  });

  // Cantidad de filtros pendientes de aplicar
  const pendingCount = countPendingChanges(selectedFilters, appliedFilters);

  // Resumen de los filtros APLICADOS para el botón plegado: "Filtros · 2026 · Sonora · Mar"
  const appliedSummary = (() => {
    const a = appliedFilters || {};
    const ent = !a.entidad || a.entidad === 'All' ? 'Nacional' : a.entidad;
    const mun = dataset !== 'victimas' && a.municipio && a.municipio !== 'All'
      ? String(a.municipio).replace(`, ${a.entidad}`, '') : null;
    return ['Filtros', a.anio, ent, mun, monthsLabel(a.meses)].filter(Boolean).join(' · ');
  })();

  // ── Efecto 1: Opciones base (año, entidad, bien jurídico) — solo al aplicar filtros
  useEffect(() => {
    const controller = new AbortController();

    const params = { dataset: wireDataset };
    if (appliedFilters.anio !== null) params.anio = appliedFilters.anio;
    if (appliedFilters.entidad !== "All") params.entidad = appliedFilters.entidad;
    if (appliedFilters.sexo && appliedFilters.sexo.length > 0) params.sexo = appliedFilters.sexo.join('|');
    if (appliedFilters.rangoEdad && appliedFilters.rangoEdad.length > 0) params.rangoEdad = appliedFilters.rangoEdad.join('|');

    axios.get(`${API_URL}/api/filtros`, { params, signal: controller.signal })
      .then(res => {
        if (res.data) {
          setFiltrosOpciones(prev => ({
            ...prev,
            anios: res.data.anios || [],
            entidades: res.data.entidades || [],
            bienesJuridicos: res.data.bienesJuridicos || [],
            sexos: res.data.sexos || [],
            rangosEdad: res.data.rangosEdad || []
          }));

          // Solo inicializar el año si está en null (PublicDashboard ya lo fija al año más reciente)
          setSelectedFilters(prev => {
            if (prev.anio === null && res.data.anios && res.data.anios.length > 0) {
              return { ...prev, anio: Math.max(...res.data.anios) };
            }
            return prev;
          });

          if (onInitialLoadComplete) {
            onInitialLoadComplete();
          }
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error fetching filtros base", err);
        if (onInitialLoadComplete) {
          onInitialLoadComplete();
        }
      });

    return () => controller.abort();
  }, [appliedFilters, dataset]);

  // ── Efecto 2: Cascada en tiempo real para tipo/subtipo/modalidad/sexo/rango
  // Se dispara al cambiar bien jurídico, tipo o subtipo en selectedFilters.
  // NO afecta los datos del dashboard (esos solo reaccionan a appliedFilters).
  useEffect(() => {
    const controller = new AbortController();

    const params = { dataset: wireDataset };
    if (selectedFilters.anio !== null) params.anio = selectedFilters.anio;
    if (selectedFilters.entidad !== "All") params.entidad = selectedFilters.entidad;

    const bj = Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : [];
    const td = Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : [];
    const sd = Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : [];
    const sx = Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : [];
    const re = Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : [];

    if (bj.length > 0) params.bienJuridico = bj.join('|');
    if (td.length > 0) params.tipoDelito = td.join('|');
    if (sd.length > 0) params.subtipoDelito = sd.join('|');
    if (sx.length > 0) params.sexo = sx.join('|');
    if (re.length > 0) params.rangoEdad = re.join('|');

    axios.get(`${API_URL}/api/filtros`, { params, signal: controller.signal })
      .then(res => {
        if (res.data) {
          setFiltrosOpciones(prev => ({
            ...prev,
            tiposDelito: res.data.tiposDelito || [],
            subtiposDelito: res.data.subtiposDelito || [],
            modalidades: res.data.modalidades || [],
            municipios: res.data.municipios || [],
            sexos: res.data.sexos || [],
            rangosEdad: res.data.rangosEdad || []
          }));

          // Limpiar selecciones que ya no son válidas con el nuevo contexto
          setSelectedFilters(prev => {
            const curTd = Array.isArray(prev.tipoDelito) ? prev.tipoDelito : [];
            const curSd = Array.isArray(prev.subtipoDelito) ? prev.subtipoDelito : [];
            const curMo = Array.isArray(prev.modalidad) ? prev.modalidad : [];
            const curSx = Array.isArray(prev.sexo) ? prev.sexo : [];
            const curRe = Array.isArray(prev.rangoEdad) ? prev.rangoEdad : [];

            const availTd = res.data.tiposDelito || [];
            const availSd = res.data.subtiposDelito || [];
            const availMo = res.data.modalidades || [];
            const availSx = res.data.sexos || [];
            const availRe = res.data.rangosEdad || [];

            const filteredTd = curTd.filter(v => availTd.includes(v));
            const filteredSd = curSd.filter(v => availSd.includes(v));
            const filteredMo = curMo.filter(v => availMo.includes(v));
            const filteredSx = curSx.filter(v => availSx.includes(v));
            const filteredRe = curRe.filter(v => availRe.includes(v));

            if (
              filteredTd.length !== curTd.length ||
              filteredSd.length !== curSd.length ||
              filteredMo.length !== curMo.length ||
              filteredSx.length !== curSx.length ||
              filteredRe.length !== curRe.length
            ) {
              return { 
                ...prev, 
                tipoDelito: filteredTd, 
                subtipoDelito: filteredSd, 
                modalidad: filteredMo,
                sexo: filteredSx,
                rangoEdad: filteredRe
              };
            }
            return prev;
          });
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error fetching filtros en cascada", err);
      });

    return () => controller.abort();
  }, [
    selectedFilters.bienJuridico,
    selectedFilters.tipoDelito,
    selectedFilters.subtipoDelito,
    selectedFilters.sexo,
    selectedFilters.rangoEdad,
    selectedFilters.anio,
    selectedFilters.entidad,
    dataset
  ]);

  const handleChange = (filterName, value) => {
    setSelectedFilters(prev => {
      const nextFilters = {
        ...prev,
        [filterName]: filterName === 'anio' ? parseInt(value) : value
      };
      if (filterName === 'entidad') {
        nextFilters.municipio = 'All';
      }
      return nextFilters;
    });
  };

  return (
    <div style={{
      padding: 'var(--filters-padding, 1.25rem 1.5rem)',
      backgroundColor: 'white',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--filters-gap, 1rem)'
    }}>
      <button
        type="button"
        className="filters-mobile-toggle"
        aria-expanded={isMobileOpen}
        aria-controls="filters-body"
        onClick={() => setIsMobileOpen(v => !v)}
      >
        <span className="filters-mobile-summary">
          {appliedSummary}{pendingCount > 0 ? ` · ${pendingCount} sin aplicar` : ''}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--color-accent)' }}>{isMobileOpen ? '▴' : '▾'}</span>
      </button>

      <div id="filters-body" className="filters-body" data-open={isMobileOpen}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--filters-select-gap, 1.5rem)', flexWrap: 'wrap' }}>
        
        {/* Contenedor principal de Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--filters-row-gap, 1.25rem)', flex: '1 1 auto', minWidth: '0' }}>
          
          {/* Fila 1: Filtros Principales (Territoriales y Temporales) */}
          <div style={{ display: 'flex', gap: 'var(--filters-select-gap, 1rem)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px', maxWidth: '200px' }}>
              <label className="label-sm">Año</label>
              <select className="input-select" value={selectedFilters.anio || ""} onChange={e => handleChange('anio', e.target.value)}>
                {filtrosOpciones.anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            
            <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
              <label className="label-sm">Entidad</label>
              <select className="input-select" value={selectedFilters.entidad} onChange={e => handleChange('entidad', e.target.value)}>
                <option value="All">Nacional</option>
                {filtrosOpciones.entidades.map(e_name => <option key={e_name} value={e_name}>{e_name}</option>)}
              </select>
            </div>
            
            {dataset !== 'victimas' && (
              <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                <label className="label-sm">Municipio</label>
                <select 
                  className="input-select" 
                  value={selectedFilters.municipio || "All"} 
                  onChange={e => handleChange('municipio', e.target.value)}
                  disabled={selectedFilters.entidad === 'All'}
                >
                  {selectedFilters.entidad === 'All' ? (
                    <option value="All">Seleccione una entidad</option>
                  ) : (
                    <>
                      <option value="All">Todos los municipios</option>
                      {(filtrosOpciones.municipios || []).map(m_name => (
                        <option key={m_name} value={m_name}>{m_name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Fila 2: Filtros Categóricos y Dependientes (o cápsulas en alto impacto) */}
          {isAltoImpacto ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="label-sm">Delitos de alto impacto</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(() => {
                  const active = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
                  const customs = Array.isArray(customCapsules) ? customCapsules : [];
                  const tokens = [...ALTO_IMPACTO_PRESETS, ...customs.filter(t => !ALTO_IMPACTO_PRESETS.includes(t))];
                  return tokens.map(token => {
                    const parsed = parseCapsule(token);
                    const isActive = active.includes(token);
                    return (
                      <button
                        key={token}
                        onClick={() => {
                          setSelectedFilters(prev => {
                            const cur = Array.isArray(prev.altoImpacto) ? prev.altoImpacto : [];
                            return {
                              ...prev,
                              altoImpacto: cur.includes(token) ? cur.filter(t => t !== token) : [...cur, token]
                            };
                          });
                        }}
                        type="button"
                        aria-pressed={isActive}
                        title={parsed.isCustom ? `Personalizado: ${token.slice(0, 120)}` : token}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                          borderRadius: '999px', cursor: 'pointer', transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1)',
                          border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                          background: isActive ? 'var(--color-accent)' : '#ffffff',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)'
                        }}
                      >
                        {parsed.name}
                        {parsed.isCustom && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRemoveCustomCapsule) onRemoveCustomCapsule(token);
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Eliminar ${parsed.name}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onRemoveCustomCapsule) onRemoveCustomCapsule(token);
                              }
                            }}
                            title="Eliminar cápsula"
                            style={{ fontWeight: 700, marginLeft: '0.15rem', lineHeight: 1 }}
                          >
                            ×
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
                <button
                  onClick={() => setIsCustomModalOpen(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
                    borderRadius: '999px', cursor: 'pointer',
                    border: '1px dashed var(--color-accent)', background: 'transparent',
                    color: 'var(--color-accent)'
                  }}
                >
                  + Agregar delito
                </button>
              </div>
            </div>
          ) : (
          <div className="filters-group" data-open={isDelitoOpen}>
            <button
              type="button"
              className="filters-group-toggle"
              aria-expanded={isDelitoOpen}
              aria-controls="filters-group-delito"
              onClick={toggleDelito}
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)', transform: isDelitoOpen ? 'none' : 'rotate(-90deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
              {isVictimasDataset(dataset) ? 'Delito y víctima' : 'Delito'}
              {activeDelitoCount > 0 && (
                <span className="filters-group-count tabular">{activeDelitoCount} {activeDelitoCount === 1 ? 'filtro activo' : 'filtros activos'}</span>
              )}
            </button>
          {isDelitoOpen && (
          <div id="filters-group-delito" style={{ display: 'flex', gap: 'var(--filters-select-gap, 1rem)', flexWrap: 'wrap' }}>
            <MultiSelectDropdown
              label="Bien jurídico afectado"
              options={filtrosOpciones.bienesJuridicos}
              selected={Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : []}
              onChange={(val) => handleChange('bienJuridico', val)}
            />
            <MultiSelectDropdown
              label="Tipo de delito"
              options={filtrosOpciones.tiposDelito}
              selected={Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : []}
              onChange={(val) => handleChange('tipoDelito', val)}
            />
            <MultiSelectDropdown
              label="Subtipo de delito"
              options={filtrosOpciones.subtiposDelito}
              selected={Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : []}
              onChange={(val) => handleChange('subtipoDelito', val)}
            />
            <MultiSelectDropdown
              label="Modalidad"
              options={filtrosOpciones.modalidades}
              selected={Array.isArray(selectedFilters.modalidad) ? selectedFilters.modalidad : []}
              onChange={(val) => handleChange('modalidad', val)}
            />
            {(dataset === 'victimas' || dataset === 'victimas_mun') && (
              <>
                <MultiSelectDropdown
                  label="Sexo"
                  options={filtrosOpciones.sexos}
                  selected={Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : []}
                  onChange={(val) => handleChange('sexo', val)}
                />
                <MultiSelectDropdown
                  label="Rango de edad"
                  options={filtrosOpciones.rangosEdad}
                  selected={Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : []}
                  onChange={(val) => handleChange('rangoEdad', val)}
                />
              </>
            )}
          </div>
          )}
          </div>
          )}
        </div>

        {/* Controles de Acción (Alineados a la derecha) */}
        <div className="filters-controls-right" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--filters-gap, 1rem)', alignItems: 'flex-end', flexShrink: 0 }}>
          <div className="btn-toggle" style={{ display: 'flex' }}>
            <button
              type="button"
              aria-pressed={metricType === 'absolute'}
              className={metricType === 'absolute' ? 'active' : ''}
              onClick={() => setMetricType('absolute')}
            >
              Cifras absolutas
            </button>
            <button
              type="button"
              aria-pressed={metricType === 'rate'}
              className={metricType === 'rate' ? 'active' : ''}
              onClick={() => setMetricType('rate')}
            >
              Tasa por 100 mil hab.
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              id="btn-limpiar-filtros"
              onClick={onClear}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 1rem', fontSize: '0.875rem', fontWeight: 600,
                borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)',
                cursor: 'pointer', transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                background: 'white', color: 'var(--text-secondary, #64748b)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'var(--text-secondary, #64748b)'; e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'; }}
            >
              Limpiar filtros
            </button>

            <button
              type="button"
              id="btn-aplicar-filtros"
              onClick={onApply}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 1.1rem', fontSize: '0.875rem', fontWeight: 600,
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
                background: pendingCount > 0 ? 'var(--color-accent, #2563eb)' : 'var(--bg-main, #f1f5f9)',
                color: pendingCount > 0 ? '#fff' : 'var(--text-secondary, #64748b)',
                boxShadow: pendingCount > 0 ? '0 4px 12px rgba(69,89,147,0.30)' : 'none'
              }}
              onMouseEnter={e => { if (pendingCount > 0) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              Aplicar filtros
              {pendingCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.3)', fontSize: '0.75rem',
                  fontWeight: 700, lineHeight: 1
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Meses: tira con arrastre (sin selección = año completo) */}
      <MonthStrip
        meses={selectedFilters.meses || []}
        mesesAplicados={appliedFilters.meses || []}
        onChange={(meses) => setSelectedFilters(prev => ({ ...prev, meses }))}
        mesFinalAplica={dataset === appliedFilters.dataset && String(selectedFilters.anio) === String(appliedFilters.anio)}
      />

      </div>

      {isCustomModalOpen && (
        <AltoImpactoModal
          onClose={() => setIsCustomModalOpen(false)}
          onConfirm={(token) => {
            if (onAddCustomCapsule) onAddCustomCapsule(token);
            setIsCustomModalOpen(false);
          }}
          customCapsules={customCapsules}
          scope={selectedFilters}
          activeTokens={Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : []}
        />
      )}
    </div>
  );
};

export default Filters;

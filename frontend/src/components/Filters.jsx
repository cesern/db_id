import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

const MONTHS = [
  { id: 1, label: 'Ene', name: 'Enero' }, { id: 2, label: 'Feb', name: 'Febrero' }, { id: 3, label: 'Mar', name: 'Marzo' },
  { id: 4, label: 'Abr', name: 'Abril' }, { id: 5, label: 'May', name: 'Mayo' }, { id: 6, label: 'Jun', name: 'Junio' },
  { id: 7, label: 'Jul', name: 'Julio' }, { id: 8, label: 'Ago', name: 'Agosto' }, { id: 9, label: 'Sep', name: 'Septiembre' },
  { id: 10, label: 'Oct', name: 'Octubre' }, { id: 11, label: 'Nov', name: 'Noviembre' }, { id: 12, label: 'Dic', name: 'Diciembre' }
];

const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
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
      <label className="label-sm">{label}</label>
      <div
        className="input-select"
        style={{ cursor: 'pointer', userSelect: 'none', minHeight: '38px', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        onClick={() => setIsOpen(!isOpen)}
        title={displayText}
      >
        {displayText}
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          backgroundColor: 'white', border: '1px solid var(--border-color)',
          borderRadius: '6px', marginTop: '4px', zIndex: 100,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '350px'
        }}>
          {/* Sección Fija Superior */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)',
            borderTopLeftRadius: '6px', borderTopRightRadius: '6px',
            padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'
          }}>
            <input
              type="text"
              placeholder="Buscar opciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', padding: '0.4rem 0.5rem',
                border: '1px solid var(--border-color)', borderRadius: '4px',
                fontSize: '0.8rem', outline: 'none'
              }}
            />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); handleMasterChange(); }}
              >
                <input
                  type="checkbox"
                  ref={masterCheckboxRef}
                  checked={isAllVisibleSelected}
                  onChange={() => {}}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Seleccionar todo</span>
              </div>
              
              <button
                onClick={handleLimpiar}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-accent)',
                  fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700, padding: 0
                }}
              >
                Limpiar
              </button>
            </div>
            
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {safeSelected.length} de {safeOptions.length} seleccionados
            </div>
          </div>
          
          {/* Contenedor Scrolleable de Opciones */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSel = safeSelected.includes(opt);
                return (
                  <div
                    key={opt}
                    title={opt}
                    style={{
                      padding: '0.55rem 0.75rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: '0.5rem',
                      background: isSel ? 'var(--bg-main)' : 'white',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                    onClick={(e) => { e.stopPropagation(); handleToggle(opt); }}
                  >
                    <input type="checkbox" checked={isSel} readOnly style={{ cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt}
                    </span>
                  </div>
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

  const arrayFields = ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'meses', 'sexo', 'rangoEdad'];
  for (const field of arrayFields) {
    const a = Array.isArray(selected[field]) ? selected[field] : [];
    const b = Array.isArray(applied[field]) ? applied[field] : [];
    if (a.length !== b.length || a.some(v => !b.includes(v))) count++;
  }
  return count;
}

// ── Filters Component ──────────────────────────────────────────────────────────
const Filters = ({ dataset, metricType, setMetricType, selectedFilters, setSelectedFilters, appliedFilters, onApply, onClear, onInitialLoadComplete }) => {
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

  // ── Efecto 1: Opciones base (año, entidad, bien jurídico) — solo al aplicar filtros
  useEffect(() => {
    const controller = new AbortController();

    const params = { dataset };
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

          // Solo inicializar el año si está en null (no sobreescribir 2026)
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

    const params = { dataset };
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
      padding: '1.25rem 1.5rem',
      backgroundColor: 'white',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', flexWrap: 'wrap' }}>
        
        {/* Contenedor principal de Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: '1 1 auto', minWidth: '0' }}>
          
          {/* Fila 1: Filtros Principales (Territoriales y Temporales) */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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

          {/* Fila 2: Filtros Categóricos y Dependientes */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
        </div>

        {/* Controles de Acción (Alineados a la derecha) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end', flexShrink: 0 }}>
          <div className="btn-toggle" style={{ display: 'flex' }}>
            <button
              className={metricType === 'absolute' ? 'active' : ''}
              onClick={() => setMetricType('absolute')}
            >
              Cifras absolutas
            </button>
            <button
              className={metricType === 'rate' ? 'active' : ''}
              onClick={() => setMetricType('rate')}
            >
              Tasa 100 mil habitantes
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
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
              ✕ Limpiar filtros
            </button>

            <button
              id="btn-aplicar-filtros"
              onClick={onApply}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 1.1rem', fontSize: '0.875rem', fontWeight: 600,
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
                background: pendingCount > 0 ? 'var(--color-accent, #2563eb)' : 'var(--bg-main, #f1f5f9)',
                color: pendingCount > 0 ? '#fff' : 'var(--text-secondary, #64748b)',
                boxShadow: pendingCount > 0 ? '0 4px 12px rgba(37,99,235,0.30)' : 'none'
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

      {/* Bottom Row: Month Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        {MONTHS.map((month) => {
          const isSelected = selectedFilters.meses && selectedFilters.meses.includes(month.name);
          return (
            <button
              key={month.name}
              className="btn"
              onClick={() => {
                setSelectedFilters(prev => {
                  const currentMeses = prev.meses || [];
                  const isAlreadySelected = currentMeses.includes(month.name);
                  const newMeses = isAlreadySelected
                    ? currentMeses.filter(m => m !== month.name)
                    : [...currentMeses, month.name];
                  return { ...prev, meses: newMeses };
                });
              }}
              style={{
                flex: 1,
                minWidth: '35px',
                padding: '0.4rem 0.1rem',
                fontSize: '0.75rem',
                background: isSelected ? 'var(--bg-main)' : 'white',
                borderColor: isSelected ? 'var(--color-accent)' : 'var(--border-color)',
                color: isSelected ? 'var(--color-accent)' : 'inherit',
                fontWeight: isSelected ? 700 : 500
              }}
            >
              {month.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Filters;

import React, { useState, useEffect, useMemo, useRef, useId } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Customized, usePlotArea, ReferenceLine } from 'recharts';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';
import { useFullscreenScale, scaleSize } from '../utils/fullscreenScale';
import { PREFERS_REDUCED_MOTION } from '../utils/motion';
import { useExitAnimation } from '../utils/useExitAnimation';
import { csvValueLabel } from '../utils/labels';
import { useDialogFocus } from '../utils/useDialogFocus';

// Ayuda "Cómo leer el ranking": diálogo con foco atrapado, Escape y foco de vuelta al botón
const RankingHelp = ({ onClose }) => {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  useDialogFocus(true, { containerRef: panelRef, initialFocusRef: closeRef, onEscape: onClose });
  const p = { fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 0.75rem' };
  return (
    <div
      className="modal-backdrop"
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8, 28, 58, 0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel"
        style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={titleId} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>Cómo leer el ranking</h2>
        <p style={p}>La línea muestra el lugar que ocupa la entidad entre las 32 en cada periodo. El <strong>1</strong> es la entidad con más delitos o víctimas (o mayor tasa); el <strong>32</strong>, la que tiene menos. Por eso la línea sube cuando la incidencia empeora frente al resto del país.</p>
        <p style={p}>Las dos líneas punteadas separan los tercios: lugares 1–10, 11–20 y 21–32.</p>
        <p style={p}><strong>Anual</strong> compara años completos; <strong>Acumulado</strong>, de enero al mes de corte de cada año; <strong>Mensual</strong>, mes por mes. Un año marcado como parcial (por ejemplo "Ene–Ago") aún no tiene todos sus meses publicados.</p>
        <p style={{ ...p, marginBottom: '1.25rem' }}>Los filtros de esta vista son independientes de los del tablero.</p>
        <button ref={closeRef} type="button" className="btn btn-primary" onClick={onClose} style={{ width: '100%', display: 'flex', justifyContent: 'center', fontWeight: 600 }}>Entendido</button>
      </div>
    </div>
  );
};

const MultiSelectDropdown = ({ label, options, selected, onChange, maxSelection }) => {
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
      if (maxSelection && nextSelected.length > maxSelection) {
        alert(`Puedes seleccionar un máximo de ${maxSelection} opciones.`);
        return;
      }
      onChange(nextSelected);
    }
  };

  const handleLimpiar = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleOptionChange = (opt) => {
    if (safeSelected.includes(opt)) {
      onChange(safeSelected.filter(item => item !== opt));
    } else {
      if (maxSelection && safeSelected.length >= maxSelection) {
        alert(`Puedes seleccionar un máximo de ${maxSelection} opciones.`);
        return;
      }
      onChange([...safeSelected, opt]);
    }
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
        style={{ cursor: 'pointer', userSelect: 'none', minHeight: 'var(--input-min-height, 30px)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
          boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
          maxHeight: '350px'
        }}>
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)',
            borderTopLeftRadius: '6px', borderTopRightRadius: '6px',
            padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'
          }}>
            <input
              type="text"
              placeholder="Buscar..."
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
                  onChange={() => { }}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Sel. todo</span>
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
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                No se encontraron
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

const CustomTooltip = ({ active, payload, label, metricType, selectedEntidad, dataset, fs = 1, partialYears = {} }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const top3 = data._top3 || [];

    const highlighted = [...payload].sort((a, b) => a.value - b.value);
    const toShow = highlighted.filter(p => p.name === selectedEntidad);

    const metricLabel = dataset === 'victimas' ? 'víctimas' : 'delitos';
    const formatVal = (val) => {
      if (val === null || val === undefined) return '';
      const numStr = Number(val).toLocaleString('es-MX');
      return metricType === 'rate' ? `${numStr} (tasa)` : `${numStr} ${metricLabel}`;
    };

    const parts = label.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const displayLabel = parts.length > 1 ? `${months[parseInt(parts[1]) - 1]} ${parts[0]}` : label;

    return (
      <div style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', minWidth: '220px' }}>
        <p style={{ fontWeight: '700', margin: '0 0 10px 0', fontSize: `${14 * fs}px`, color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', textTransform: 'capitalize' }}>
          {displayLabel}
          {/* Año aún incompleto en la fuente: "2026 (Ene–Ago, año parcial)" */}
          {partialYears[label] && (
            <span style={{ textTransform: 'none' }}> ({partialYears[label]}, año parcial)</span>
          )}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {toShow.length === 0 && (
            <span style={{ fontSize: `${13 * fs}px`, color: '#64748b' }}>Sin datos para {selectedEntidad}</span>
          )}
          {toShow.map((entry, index) => {
            const total = data[entry.name + '_total'];
            return (
              <div key={index}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: `${13 * fs}px` }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></span>
                  <span style={{ color: '#0f172a', fontWeight: '700' }}>
                    {entry.name}
                  </span>
                  <span style={{ fontWeight: '700', color: '#3b82f6', marginLeft: 'auto' }}>#{entry.value}</span>
                </div>
                <div style={{ fontSize: `${12 * fs}px`, color: '#64748b', marginLeft: '14px' }}>
                  Incidencia: <span style={{ fontWeight: '600' }}>{formatVal(total)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {top3.length > 0 && (
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
            <p style={{ fontSize: `${12 * fs}px`, fontWeight: '700', color: '#475569', margin: '0 0 6px 0', textTransform: 'uppercase' }}>Top 3 Nacional</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {top3.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${12 * fs}px` }}>
                  <span style={{ color: '#475569', display: 'flex', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                    <span style={{ fontWeight: '700' }}>#{t.rank}</span>
                    <span title={t.name.split(',')[0]}>{t.name.split(',')[0]}</span>
                  </span>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>{formatVal(t.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Sentido del eje Y (reversed: 1 arriba). Rótulos verticales discretos en el canal del eje.
// Recharts 3: el área de la gráfica se lee con usePlotArea (Customized ya no pasa offset).
const AxisDirection = ({ axisWidth, gutter, fontSize }) => {
  const area = usePlotArea();
  if (!area) return null;
  const x = area.x - axisWidth - gutter / 2;
  const common = { fontSize, fontWeight: 600, fill: 'var(--text-secondary)', letterSpacing: '0.06em', dominantBaseline: 'central' };
  // Si la gráfica es baja, las frases completas se enciman a la mitad del eje: se acortan
  const full = ['MÁS INCIDENCIA →', '← MENOS INCIDENCIA'];
  const textW = (t) => t.length * fontSize * 0.72; // mayúsculas + espaciado de letras
  const fits = textW(full[0]) + textW(full[1]) + 16 <= area.height;
  const [top, bottom] = fits ? full : ['MÁS →', '← MENOS'];
  return (
    <g aria-hidden="true">
      <text {...common} transform={`translate(${x},${area.y}) rotate(-90)`} textAnchor="end">{top}</text>
      <text {...common} transform={`translate(${x},${area.y + area.height}) rotate(-90)`} textAnchor="start">{bottom}</text>
    </g>
  );
};

// Lista desplegable de periodos adicionales en las tarjetas de posición.
// El control dice qué hará ("+N periodos más" / "Ocultar periodos") y la flecha gira;
// la lista aparece sin animar la altura (acción de uso frecuente).
const MorePeriods = ({ items, formatPeriodLabel, formatCardValue }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '6px',
          fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)'
        }}
      >
        {open ? 'Ocultar periodos' : `+${items.length} ${items.length === 1 ? 'periodo' : 'periodos'} más`}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={listId} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '0.3rem', maxHeight: '120px', overflowY: 'auto' }}>
          {items.map((item) => (
            <span key={item.period} className="tabular" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{formatPeriodLabel(item.period)}</strong>: {formatCardValue(item.total)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryRankings = ({ tempColor }) => {
  const [selectedEntidad, setSelectedEntidad] = useState('Sonora');
  const [dataset, setDataset] = useState('delitos');
  const [temporalidad, setTemporalidad] = useState('anual');
  const [mesAcumulado, setMesAcumulado] = useState('Agosto');
  const [metricType, setMetricType] = useState('absolute');
  const [isFading, setIsFading] = useState(false);
  const [rankingData, setRankingData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const headerRef = useRef(null);
  // Pantalla completa: aquí el overlay es la propia tarjeta, así que se cierra sin fundido (0ms):
  // un fundido dejaría ver la tarjeta vacía detrás. SidebarLeft sí se desvanece (pinta la vista normal debajo).
  const [fsOpen, setFsOpen] = useState(false);
  const { mounted: isFullScreen, closing: fsClosing } = useExitAnimation(fsOpen, 0);
  const fsTriggerRef = useRef(null); // botón que abre la vista: recibe el foco al cerrar

  // Factor de escala fullscreen (1 en vista normal)
  const fsScale = useFullscreenScale(isFullScreen);
  const F = (base) => scaleSize(base, fsScale);


  const [filters, setFilters] = useState({
    bienJuridico: [], tipoDelito: [], subtipoDelito: [], modalidad: [], sexo: [], rangoEdad: []
  });

  const [applied, setApplied] = useState({
    dataset: 'delitos', temporalidad: 'anual', metricType: 'absolute', mesAcumulado: 'Agosto',
    filters: { bienJuridico: [], tipoDelito: [], subtipoDelito: [], modalidad: [], sexo: [], rangoEdad: [] }
  });

  const [options, setOptions] = useState({
    entidades: ['Sonora'],
    bienesJuridicos: [], tiposDelito: [], subtiposDelito: [], modalidades: [], sexos: [], rangosEdad: []
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const params = { dataset: applied.dataset };
        if (applied.filters.bienJuridico.length > 0) params.bienJuridico = applied.filters.bienJuridico.join('|');
        if (applied.filters.tipoDelito.length > 0) params.tipoDelito = applied.filters.tipoDelito.join('|');
        if (applied.filters.subtipoDelito.length > 0) params.subtipoDelito = applied.filters.subtipoDelito.join('|');
        if (applied.filters.sexo.length > 0) params.sexo = applied.filters.sexo.join('|');
        if (applied.filters.rangoEdad.length > 0) params.rangoEdad = applied.filters.rangoEdad.join('|');

        const res = await axios.get(`${API_URL}/api/filtros`, { params });
        if (res.data) {
          setOptions({
            entidades: res.data.entidades || ['Sonora'],
            bienesJuridicos: res.data.bienesJuridicos || [],
            tiposDelito: res.data.tiposDelito || [],
            subtiposDelito: res.data.subtiposDelito || [],
            modalidades: res.data.modalidades || [],
            sexos: res.data.sexos || [],
            rangosEdad: res.data.rangosEdad || []
          });
        }
      } catch (err) {
        console.error("Error fetching options", err);
      }
    };
    fetchOptions();
  }, [applied]);

  useEffect(() => {
    const fetchRanking = async () => {
      setIsFading(true);
      try {
        const params = {
          dataset: applied.dataset,
          nivel: 'entidad',
          temporalidad: applied.temporalidad === 'acumulado' ? 'anual' : applied.temporalidad,
          metric_type: applied.metricType
        };
        if (applied.temporalidad === 'acumulado') {
          const mesesList = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const mIndex = mesesList.indexOf(applied.mesAcumulado);
          const selectedMonths = mesesList.slice(0, mIndex + 1).join(',');
          params.meses = selectedMonths;
        }
        if (applied.filters.bienJuridico.length > 0) params.bienJuridico = applied.filters.bienJuridico.join('|');
        if (applied.filters.tipoDelito.length > 0) params.tipoDelito = applied.filters.tipoDelito.join('|');
        if (applied.filters.subtipoDelito.length > 0) params.subtipoDelito = applied.filters.subtipoDelito.join('|');
        if (applied.filters.modalidad.length > 0) params.modalidad = applied.filters.modalidad.join('|');
        if (applied.filters.sexo.length > 0) params.sexo = applied.filters.sexo.join('|');
        if (applied.filters.rangoEdad.length > 0) params.rangoEdad = applied.filters.rangoEdad.join('|');

        const res = await axios.get(`${API_URL}/api/ranking_historico`, { params });
        setRankingData(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error fetching ranking", err);
      } finally {
        setTimeout(() => setIsFading(false), 300);
      }
    };
    fetchRanking();
  }, [applied]);

  // Último mes publicado por año del conjunto aplicado (mes_final sale del conjunto completo, sin filtros)
  const [mesFinalPorAnio, setMesFinalPorAnio] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${API_URL}/api/incidencia_por_anio`, { params: { dataset: applied.dataset }, signal: controller.signal })
      .then(res => {
        const map = {};
        (Array.isArray(res.data) ? res.data : []).forEach(d => {
          if (typeof d.mes_final === 'number') map[String(d.year)] = d.mes_final;
        });
        setMesFinalPorAnio(map);
      })
      .catch(err => { if (!axios.isCancel(err)) setMesFinalPorAnio({}); });
    return () => controller.abort();
  }, [applied.dataset]);

  // Años parciales en Anual (se piden los 12 meses) y Acumulado (se piden Ene–mes de corte):
  // { '2026': 'Ene–Ago' } si la fuente aún no publica todos los meses pedidos. Mensual no aplica.
  const partialYears = useMemo(() => {
    if (applied.temporalidad === 'mensual') return {};
    const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ultimoPedido = applied.temporalidad === 'acumulado' ? MESES_LARGOS.indexOf(applied.mesAcumulado) + 1 : 12;
    const out = {};
    Object.entries(mesFinalPorAnio).forEach(([year, mf]) => {
      if (mf >= 1 && mf < ultimoPedido) out[year] = mf === 1 ? 'Ene' : `Ene–${MESES_CORTOS[mf - 1]}`;
    });
    return out;
  }, [mesFinalPorAnio, applied.temporalidad, applied.mesAcumulado]);
  const hasPartialTick = Object.keys(partialYears).length > 0;

  const chartData = useMemo(() => {
    if (!rankingData.length) return [];

    // Agrupar por periodo
    const periods = [...new Set(rankingData.map(d => d.period))];
    return periods.map(p => {
      const obj = { period: p };
      const dataForPeriod = rankingData.filter(d => d.period === p);

      dataForPeriod.forEach(d => {
        obj[d.name] = d.rank;
        obj[d.name + '_total'] = d.total;
      });

      const top3 = dataForPeriod.filter(d => d.rank <= 3).sort((a, b) => a.rank - b.rank);
      obj._top3 = top3;

      return obj;
    });
  }, [rankingData]);

  const lineNames = useMemo(() => {
    return [...new Set(rankingData.map(d => d.name))].sort((a, b) => a.localeCompare(b));
  }, [rankingData]);

  const handleFilterChange = (name, val) => {
    setFilters(prev => ({ ...prev, [name]: val }));
  };

  // Cambios sin aplicar: el botón Aplicar solo se ve primario cuando hay algo pendiente (igual que en el tablero)
  const hasPending = JSON.stringify({ dataset, temporalidad, metricType, mesAcumulado, filters })
    !== JSON.stringify({ dataset: applied.dataset, temporalidad: applied.temporalidad, metricType: applied.metricType, mesAcumulado: applied.mesAcumulado, filters: applied.filters });

  const handleApply = () => {
    setApplied({
      dataset, temporalidad, metricType, mesAcumulado, filters: { ...filters }
    });
  };

  const handleClear = () => {
    const clearedFilters = { bienJuridico: [], tipoDelito: [], subtipoDelito: [], modalidad: [], sexo: [], rangoEdad: [] };
    setFilters(clearedFilters);
    setApplied({
      dataset, temporalidad, metricType, mesAcumulado, filters: clearedFilters
    });
  };

  const summaryEntidad = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const entidadPoints = chartData.filter(d => d[selectedEntidad] !== undefined && d[selectedEntidad] !== null);
    if (entidadPoints.length === 0) return null;

    const entidadRanks = entidadPoints.map(d => d[selectedEntidad]);
    const mejor = Math.max(...entidadRanks);
    const peor = Math.min(...entidadRanks);

    const mejorPoints = entidadPoints.filter(d => d[selectedEntidad] === mejor);
    const peorPoints = entidadPoints.filter(d => d[selectedEntidad] === peor);

    return {
      mejor,
      mejorItems: mejorPoints.map(p => ({ period: p.period, total: p[selectedEntidad + '_total'] })),
      peor,
      peorItems: peorPoints.map(p => ({ period: p.period, total: p[selectedEntidad + '_total'] }))
    };
  }, [chartData, selectedEntidad]);

  const formatPeriodLabel = (periodStr) => {
    if (!periodStr) return '';
    const meses = {
      '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic'
    };
    const str = String(periodStr);
    if (/^\d{4}-\d{2}$/.test(str)) {
      const [year, month] = str.split('-');
      return `${meses[month] || month} ${year}`;
    }
    return str;
  };

  const metricLabel = applied.dataset === 'victimas' ? 'víctimas' : 'delitos';

  const formatCardValue = (val) => {
    if (val === null || val === undefined) return '';
    if (applied.metricType === 'rate') {
      const num = Number(val);
      const formatted = num % 1 === 0 ? num.toLocaleString('es-MX') : num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${formatted} (tasa)`;
    } else {
      return `${Math.round(val).toLocaleString('es-MX')} ${metricLabel}`;
    }
  };

  // Tarjeta de posición (menor/mayor incidencia): la posición en navy, sin verde/rojo que juzgue;
  // el periodo más reciente a la vista y el resto desplegable.
  const renderPositionCard = (label, rank, items) => {
    const sorted = [...items].sort((x, y) => String(y.period).localeCompare(String(x.period)));
    const [latest, ...rest] = sorted;
    return (
      <div style={{ flex: 1, backgroundColor: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '150px', gap: '0.15rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>{label}</span>
        <span className="tabular" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>#{rank}</span>
        {latest && (
          <span className="tabular" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{formatPeriodLabel(latest.period)}</strong>: {formatCardValue(latest.total)}
          </span>
        )}
        {rest.length > 0 && <MorePeriods items={rest} formatPeriodLabel={formatPeriodLabel} formatCardValue={formatCardValue} />}
      </div>
    );
  };

  const dataForExport = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    return chartData.filter(d => d[selectedEntidad] !== undefined).map(d => ({
      Periodo: d.period,
      Entidad: selectedEntidad,
      Ranking: d[selectedEntidad],
      Total: d[selectedEntidad + '_total']
    }));
  }, [chartData, selectedEntidad]);

  const handleDownloadCSV = () => {
    const csvValLabel = csvValueLabel('Incidencia', metricType);
    const headers = ["Periodo", "Entidad", "Ranking", csvValLabel];
    downloadCSV(`evolucion_ranking_${selectedEntidad.toLowerCase()}.csv`, dataForExport, headers, { ...applied, metricType });
  };

  const handleCopyTable = () => {
    const csvValLabel = csvValueLabel('Incidencia', metricType);
    const headers = ["Periodo", "Entidad", "Ranking", csvValLabel];
    copyTableToClipboard(dataForExport, headers);
  };

  const primaryColor = 'var(--color-accent)';

  // Badge conectado al último punto: ●── SONORA #21. Recharts dibuja el label al terminar
  // el trazo, así que el badge aparece después (fundido de 150ms en .rank-badge).
  const BADGE_FS = F(12);
  const BADGE_H = BADGE_FS + 10;
  const DOT_R = 4;
  const CONNECTOR = 12;
  const badgeWidth = (text) => Math.ceil(String(text).length * BADGE_FS * 0.68) + 16;
  // Margen derecho según el nombre más largo posible de la entidad (con "#32")
  const rightMargin = Math.max(90, DOT_R + CONNECTOR + badgeWidth(`${selectedEntidad.toUpperCase()} #32`) + 12);

  const renderCustomLabel = (props) => {
    const { x, y, value, index } = props;
    if (index !== chartData.length - 1 || value === undefined || value === null) return null;
    const text = `${selectedEntidad.toUpperCase()} #${value}`;
    const w = badgeWidth(text);
    const bx = x + DOT_R + CONNECTOR;
    return (
      <g className="rank-badge" aria-label={`${selectedEntidad}, posición ${value} en el último periodo`}>
        <line x1={x} y1={y} x2={bx} y2={y} stroke={primaryColor} strokeWidth={1.5} />
        <circle cx={x} cy={y} r={DOT_R} fill={primaryColor} stroke="#ffffff" strokeWidth={1.5} />
        <rect x={bx} y={y - BADGE_H / 2} width={w} height={BADGE_H} rx={4} fill={primaryColor} />
        <text x={bx + w / 2} y={y} fill="#ffffff" fontSize={BADGE_FS} fontWeight={600} letterSpacing="0.04em" textAnchor="middle" dominantBaseline="central" className="tabular">
          {text}
        </text>
      </g>
    );
  };

  // Sentido del eje Y (reversed: 1 arriba): rótulos verticales discretos en el canal del eje
  const AXIS_W = 30;
  const AXIS_GUTTER = F(16);

  return (
    <div
      ref={headerRef}
      className={isFullScreen ? `fullscreen-immersive-overlay${fsClosing ? ' is-closing' : ''}` : "card"}
      style={isFullScreen ? {} : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
    >
      {isFullScreen ? (
        <FullScreenHeader
          title={`Evolución del ranking nacional — ${selectedEntidad}`}
          selectedFilters={{
            entidad: selectedEntidad,
            dataset: applied.dataset,
            temporalidad: applied.temporalidad,
            mesAcumulado: applied.mesAcumulado,
            filters: applied.filters
          }}
          metricType={metricType}
          onClose={() => setFsOpen(false)}
          returnFocusRef={fsTriggerRef}
          extraActions={
            <ExportMenu
              imageFilename="evolucion_ranking"
              onDownloadCSV={handleDownloadCSV}
              onCopyTable={handleCopyTable}
              isTable={true}
            />
          }
        />
      ) : (
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'white' }}>
          <h2 style={{ fontSize: 'clamp(1.05rem, 2.5vw, 1.25rem)', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem 0.5rem', flexWrap: 'wrap' }}>
              <span>Evolución del ranking nacional de</span>{' '}
              <select
                value={selectedEntidad}
                onChange={e => setSelectedEntidad(e.target.value)}
                className="inline-title-select"
              >
                {(options.entidades || []).map(ent => (
                  <option key={ent} value={ent} style={{ fontSize: '0.875rem', fontWeight: 'normal', color: 'var(--text-primary)', background: 'white' }}>
                    {ent}
                  </option>
                ))}
              </select>
              <button type="button" className="icon-btn" onClick={() => setIsModalOpen(true)} title="Cómo leer el ranking" aria-label="Cómo leer el ranking">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="btn-toggle" style={{ display: 'flex' }}>
                <button
                  className={metricType === 'absolute' ? 'active' : ''}
                  onClick={() => {
                    setMetricType('absolute');
                    setApplied(prev => ({ ...prev, metricType: 'absolute' }));
                  }}
                >
                  Cifras absolutas
                </button>
                <button
                  className={metricType === 'rate' ? 'active' : ''}
                  onClick={() => {
                    setMetricType('rate');
                    setApplied(prev => ({ ...prev, metricType: 'rate' }));
                  }}
                >
                  Tasa por 100 mil hab.
                </button>
              </div>
            </div>
          </h2>

        {/* Filters and Selectors Container */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px', marginTop: '1rem' }}>
          <div style={{ flex: '1 1 min(100%, 180px)' }}>
            <label className="label-sm">Conjunto de datos</label>
            <select className="input-select" value={dataset} onChange={e => setDataset(e.target.value)}>
              <option value="delitos">Delitos</option>
              <option value="victimas">Víctimas</option>
            </select>
          </div>
          <div style={{ flex: '1 1 min(100%, 180px)' }}>
            <label className="label-sm">Periodo</label>
            <select className="input-select" value={temporalidad} onChange={e => setTemporalidad(e.target.value)}>
              <option value="anual">Anual</option>
              <option value="mensual">Mensual</option>
              <option value="acumulado">Acumulado</option>
            </select>
          </div>
          {temporalidad === 'acumulado' && (
            <div style={{ flex: '1 1 min(100%, 180px)' }}>
              <label className="label-sm">Mes de corte</label>
              <select className="input-select" value={mesAcumulado} onChange={e => setMesAcumulado(e.target.value)}>
                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map(mes => (
                  <option key={mes} value={mes}>Enero - {mes}</option>
                ))}
              </select>
            </div>
          )}
          <MultiSelectDropdown label="Bien jurídico afectado" options={options.bienesJuridicos} selected={filters.bienJuridico} onChange={v => handleFilterChange('bienJuridico', v)} />
          <MultiSelectDropdown label="Tipo de delito" options={options.tiposDelito} selected={filters.tipoDelito} onChange={v => handleFilterChange('tipoDelito', v)} />
          <MultiSelectDropdown label="Subtipo de delito" options={options.subtiposDelito} selected={filters.subtipoDelito} onChange={v => handleFilterChange('subtipoDelito', v)} />
          <MultiSelectDropdown label="Modalidad" options={options.modalidades} selected={filters.modalidad} onChange={v => handleFilterChange('modalidad', v)} />

          {(dataset === 'victimas' || dataset === 'victimas_mun') && (
            <>
              <MultiSelectDropdown label="Sexo" options={options.sexos} selected={filters.sexo} onChange={v => handleFilterChange('sexo', v)} />
              <MultiSelectDropdown label="Rango de edad" options={options.rangosEdad} selected={filters.rangoEdad} onChange={v => handleFilterChange('rangoEdad', v)} />
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', marginBottom: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem 1rem', flex: '1 1 300px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {summaryEntidad && (
              <>
                {renderPositionCard('Mejor posición', summaryEntidad.mejor, summaryEntidad.mejorItems)}
                {renderPositionCard('Peor posición', summaryEntidad.peor, summaryEntidad.peorItems)}
              </>
            )}
            {summaryEntidad && (
              <p style={{ flexBasis: '100%', margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Escala 1–32: 1 = entidad con {applied.metricType === 'rate' ? 'mayor tasa' : 'más ' + (applied.dataset === 'delitos' ? 'delitos' : 'víctimas')} en el periodo.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn" onClick={handleClear} style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0.45rem 1rem', height: 'fit-content', color: 'var(--text-secondary)' }}>
              Limpiar filtros
            </button>
            <button
              type="button"
              className={hasPending ? 'btn btn-primary' : 'btn'}
              onClick={handleApply}
              aria-disabled={!hasPending}
              style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0.45rem 1.1rem', height: 'fit-content', ...(hasPending ? {} : { background: 'var(--bg-main)', color: 'var(--text-secondary)' }) }}
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>
    )}

      {/* Altura mínima fuera de pantalla completa: en móvil la tarjeta no tiene altura fija
          y con flex:1 + minHeight:0 la gráfica colapsaba a 0 px */}
      <div className={isFullScreen ? undefined : 'rankings-chart-area'} style={{ flex: 1, minHeight: 0, backgroundColor: '#ffffff', position: 'relative' }}>
        {!isFullScreen && (
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 110, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              imageFilename="evolucion_ranking"
              onDownloadCSV={handleDownloadCSV}
              onCopyTable={handleCopyTable}
              isTable={true}
            />
            <button
              type="button"
              className="card-icon-btn"
              title="Ver en pantalla completa"
              aria-label="Ver en pantalla completa"
              ref={fsTriggerRef}
              onClick={() => setFsOpen(true)}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        )}
        <div style={{
          position: 'absolute',
          top: '1rem', left: '1rem', right: '1rem', bottom: '0.2rem',
          // Feedback de carga breve y sutil (no un efecto): atenuar rápido, volver rápido
          opacity: isFading ? 0.55 : 1,
          transition: 'opacity 150ms cubic-bezier(0.23, 1, 0.32, 1)'
        }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: rightMargin, left: AXIS_GUTTER, bottom: 0 }}>
                {/* Sin cuadrícula: solo las divisorias entre niveles (abajo) para no competir con ellas */}
                <XAxis
                  dataKey="period"
                  // Año parcial: segundo renglón "Ene–Ago" en acento (igual que en las barras por año)
                  tick={({ x, y, payload, index, tickFormatter }) => (
                    <g transform={`translate(${x},${y})`}>
                      <text dy={Math.round(F(12) * 0.71) + 10} textAnchor="middle" fill="#475569" fontSize={F(12)} fontWeight={600}>
                        {tickFormatter ? tickFormatter(payload.value, index) : payload.value}
                      </text>
                      {partialYears[payload.value] && (
                        <text dy={Math.round(F(12) * 0.71) + 10 + F(14)} textAnchor="middle" fill="var(--color-accent)" fontSize={F(12)} fontWeight={600}>
                          {partialYears[payload.value]}
                        </text>
                      )}
                    </g>
                  )}
                  height={hasPartialTick ? F(30) + F(14) : F(30)}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickFormatter={(value) => {
                    if (!value) return '';
                    const str = String(value);
                    if (/^\d{4}-\d{2}$/.test(str)) {
                      const [year, month] = str.split('-');
                      const meses = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' };
                      if (chartData.length <= 24) {
                        return `${meses[month] || month} ${year.slice(2)}`;
                      }
                      return month === '01' ? year : '';
                    }
                    return str;
                  }}
                />
                <YAxis
                  width={AXIS_W}
                  reversed={true}
                  domain={[1, 32]}
                  ticks={[1, 10, 20, 32]}
                  tick={{ fill: 'var(--text-secondary)', fontSize: F(12), fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  dx={-5}
                />
                <Tooltip isAnimationActive={false} content={<CustomTooltip metricType={applied.metricType} selectedEntidad={selectedEntidad} dataset={applied.dataset} fs={fsScale} partialYears={partialYears} />} wrapperStyle={{ zIndex: 1000 }} />

                {/* Fondo de un solo color. Divisorias entre los tres niveles (1–10, 11–20, 21–32)
                    en el corte real (10.5 y 20.5): visibles pero discretas. */}
                <ReferenceLine y={10.5} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6 4" strokeOpacity={0.85} />
                <ReferenceLine y={20.5} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6 4" strokeOpacity={0.85} />
                <Customized component={<AxisDirection axisWidth={AXIS_W} gutter={AXIS_GUTTER} fontSize={F(12)} />} />

                {/* Solo la entidad elegida: las 31 líneas de fondo formaban una trama de cruces
                    (en un ranking siempre ocupan todas las posiciones) y se retiraron. */}
                {/* Render active line always on top */}
                {lineNames.includes(selectedEntidad) && (
                  <Line
                    key={selectedEntidad}
                    type="monotone"
                    dataKey={selectedEntidad}
                    name={selectedEntidad}
                    stroke={primaryColor}
                    strokeWidth={isFullScreen ? 4.5 : 3}
                    strokeOpacity={1}
                    dot={false}
                    activeDot={{ r: 6, fill: primaryColor }}
                    // Trazo de izquierda a derecha: comunica la evolución en el tiempo.
                    // Se omite con "reducir movimiento"; el rótulo final aparece al terminar.
                    isAnimationActive={!PREFERS_REDUCED_MOTION}
                    animationBegin={0}
                    animationDuration={600}
                    animationEasing="ease-out"
                    style={{ zIndex: 10 }}
                    legendType="none"
                    label={renderCustomLabel}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              No hay datos disponibles para estos filtros.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && <RankingHelp onClose={() => setIsModalOpen(false)} />}
    </div>
  );
};

export default HistoryRankings;

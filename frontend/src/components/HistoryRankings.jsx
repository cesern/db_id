import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceArea } from 'recharts';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';

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

const CustomTooltip = ({ active, payload, label, metricType, selectedEntidad, dataset }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const top3 = data._top3 || [];

    const highlighted = [...payload].sort((a, b) => a.value - b.value);
    const toShow = highlighted.filter(p => p.name === selectedEntidad);

    const metricLabel = dataset === 'victimas' ? 'Víctimas' : 'Delitos';
    const formatVal = (val) => {
      if (val === null || val === undefined) return '';
      const numStr = Number(val).toLocaleString('en-US');
      return metricType === 'rate' ? `${numStr} (tasa)` : `${numStr} ${metricLabel}`;
    };

    const parts = label.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const displayLabel = parts.length > 1 ? `${months[parseInt(parts[1]) - 1]} ${parts[0]}` : label;

    return (
      <div style={{ background: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', minWidth: '220px' }}>
        <p style={{ fontWeight: '700', margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', textTransform: 'capitalize' }}>
          {displayLabel}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {toShow.length === 0 && (
            <span style={{ fontSize: '13px', color: '#64748b' }}>Sin datos para {selectedEntidad}</span>
          )}
          {toShow.map((entry, index) => {
            const total = data[entry.name + '_total'];
            return (
              <div key={index}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></span>
                  <span style={{ color: '#0f172a', fontWeight: '700' }}>
                    {entry.name}
                  </span>
                  <span style={{ fontWeight: '700', color: '#3b82f6', marginLeft: 'auto' }}>#{entry.value}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginLeft: '14px' }}>
                  Incidencia: <span style={{ fontWeight: '600' }}>{formatVal(total)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {top3.length > 0 && (
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#475569', margin: '0 0 6px 0', textTransform: 'uppercase' }}>Top 3 Nacional</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {top3.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
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

const HistoryRankings = ({ tempColor }) => {
  const [selectedEntidad, setSelectedEntidad] = useState('Sonora');
  const [dataset, setDataset] = useState('delitos');
  const [temporalidad, setTemporalidad] = useState('mensual');
  const [mesAcumulado, setMesAcumulado] = useState('Agosto');
  const [metricType, setMetricType] = useState('absolute');
  const [isFading, setIsFading] = useState(false);
  const [rankingData, setRankingData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const headerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    if (isFullScreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  const [filters, setFilters] = useState({
    bienJuridico: [], tipoDelito: [], subtipoDelito: [], modalidad: [], sexo: [], rangoEdad: []
  });

  const [applied, setApplied] = useState({
    dataset: 'delitos', temporalidad: 'mensual', metricType: 'absolute', mesAcumulado: 'Agosto',
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
        setRankingData(res.data || []);
      } catch (err) {
        console.error("Error fetching ranking", err);
      } finally {
        setTimeout(() => setIsFading(false), 300);
      }
    };
    fetchRanking();
  }, [applied]);

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

  const metricLabel = applied.dataset === 'victimas' ? 'Víctimas' : 'Delitos';

  const formatCardValue = (val) => {
    if (val === null || val === undefined) return '';
    if (applied.metricType === 'rate') {
      const num = Number(val);
      const formatted = num % 1 === 0 ? num.toLocaleString('en-US') : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${formatted} (tasa)`;
    } else {
      return `${Math.round(val).toLocaleString('en-US')} ${metricLabel}`;
    }
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
    const csvValLabel = metricType === 'rate' ? 'Incidencia (Tasa por 100k hab.)' : 'Incidencia';
    const headers = ["Periodo", "Entidad", "Ranking", csvValLabel];
    downloadCSV(`evolucion_ranking_${selectedEntidad.toLowerCase()}.csv`, dataForExport, headers, { ...applied, metricType });
  };

  const handleCopyTable = () => {
    const csvValLabel = metricType === 'rate' ? 'Incidencia (Tasa por 100k hab.)' : 'Incidencia';
    const headers = ["Periodo", "Entidad", "Ranking", csvValLabel];
    copyTableToClipboard(dataForExport, headers);
  };

  const primaryColor = 'var(--color-accent)';

  const renderCustomLabel = (props) => {
    const { x, y, value, index } = props;
    if (index === chartData.length - 1) {
      return (
        <text x={x + 10} y={y + 4} fill={primaryColor} fontSize={14} fontWeight={700} textAnchor="start">
          {selectedEntidad} #{value}
        </text>
      );
    }
    return null;
  };

  return (
    <div
      ref={headerRef}
      className={isFullScreen ? "fullscreen-immersive-overlay" : "card"}
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
          onClose={() => setIsFullScreen(false)}
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Evolución del ranking nacional de{' '}
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
              <button onClick={() => setIsModalOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }} title="Información">
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
                  Tasa 100 mil habitantes
                </button>
              </div>
            </div>
          </h2>

        {/* Filters and Selectors Container */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: '8px', marginTop: '1rem' }}>
          <div style={{ flex: '1 1 min(100%, 180px)' }}>
            <label className="label-sm">Dataset</label>
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
          <div style={{ display: 'flex', gap: '1rem', flex: '1 1 300px' }}>
            {summaryEntidad && (
              <>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mejor Posición</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>#{summaryEntidad.mejor}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', alignItems: 'center', marginTop: '0.4rem', maxHeight: '65px', overflowY: 'auto', paddingRight: '4px' }}>
                    {summaryEntidad.mejorItems.map((item, idx) => (
                      <span key={idx} style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center', display: 'block', width: '100%', lineHeight: '1.2' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatPeriodLabel(item.period)}</strong>: {formatCardValue(item.total)}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '150px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Peor Posición</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>#{summaryEntidad.peor}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', alignItems: 'center', marginTop: '0.4rem', maxHeight: '65px', overflowY: 'auto', paddingRight: '4px' }}>
                    {summaryEntidad.peorItems.map((item, idx) => (
                      <span key={idx} style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'center', display: 'block', width: '100%', lineHeight: '1.2' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{formatPeriodLabel(item.period)}</strong>: {formatCardValue(item.total)}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button className="btn" onClick={handleClear} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', height: 'fit-content' }}>
              ✕ Limpiar filtros
            </button>
            <button className="btn btn-primary" onClick={handleApply} style={{ fontSize: '0.85rem', padding: '0.5rem 1.5rem', height: 'fit-content' }}>
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>
    )}

      <div style={{ flex: 1, minHeight: 0, backgroundColor: '#fcfcfc', position: 'relative' }}>
        {!isFullScreen && (
          <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 110, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              imageFilename="evolucion_ranking"
              onDownloadCSV={handleDownloadCSV}
              onCopyTable={handleCopyTable}
              isTable={true}
            />
            <button
              onClick={() => setIsFullScreen(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                padding: '4px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              title="Pantalla completa"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        )}
        <div style={{
          position: 'absolute',
          top: '1rem', left: '1rem', right: '1rem', bottom: '0.2rem',
          opacity: isFading ? 0.3 : 1,
          transition: 'opacity 0.4s ease-in-out'
        }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 90, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="period"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
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
                  width={30}
                  reversed={true}
                  domain={[1, 32]}
                  ticks={[1, 10, 20, 30, 32]}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  dx={-5}
                />
                <Tooltip content={<CustomTooltip metricType={applied.metricType} selectedEntidad={selectedEntidad} dataset={applied.dataset} />} wrapperStyle={{ zIndex: 1000 }} />

                <ReferenceArea y1={1} y2={10} fill="#ef4444" fillOpacity={0.06} strokeOpacity={0} />
                <ReferenceArea y1={11} y2={20} fill="#f59e0b" fillOpacity={0.06} strokeOpacity={0} />
                <ReferenceArea y1={21} y2={32} fill="#10b981" fillOpacity={0.06} strokeOpacity={0} />

                {/* Render background/inactive lines */}
                {lineNames.filter(name => name !== selectedEntidad).map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke="#e2e8f0"
                    strokeWidth={isFullScreen ? 1.5 : 1}
                    strokeOpacity={0.8}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="none"
                    label={false}
                  />
                ))}

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
                    isAnimationActive={false}
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

      {/* Info Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Evolución del Ranking</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Visualización dinámica de la evolución del ranking por entidad, permitiendo comparar el comportamiento histórico de delitos y víctimas. Los elementos correspondientes a la entidad seleccionada se resaltan automáticamente para facilitar su seguimiento frente al contexto nacional.
            </p>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(false)} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryRankings;

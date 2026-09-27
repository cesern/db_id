import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import EmptyState from './EmptyState';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';
import { useFullscreenScale } from '../utils/fullscreenScale';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Fila resaltada: la entidad activa (vista entidades) o el municipio seleccionado
const isHighlightedRow = (m, isEntidades, activeEntityName, selectedMunicipio) => (
  isEntidades ? m.name === activeEntityName : (selectedMunicipio ? m.municipio === selectedMunicipio : false)
);

const SidebarLeft = ({ selectedFilters, metricType, onInitialLoad }) => {
  const [totalIncidencia, setTotalIncidencia] = useState(0);
  const [entidades, setEntidades] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [tableView, setTableView] = useState('entidades'); // 'entidades' | 'municipios'
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const initialLoadCalled = useRef(false);
  const tableCardRef = useRef(null);

  // Factor de escala fullscreen (1 en vista normal): solo afecta al overlay
  const fsScale = useFullscreenScale(isFullScreen);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    if (isFullScreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Auto-switch to municipios when a specific entity is selected
  useEffect(() => {
    if (selectedFilters?.entidad && selectedFilters.entidad !== 'All') {
      setTableView('municipios');
    }
  }, [selectedFilters?.entidad]);

  const dataset = selectedFilters?.dataset || 'delitos';
  const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';
  const isVictimasBase = isVictimas || isVictimasMun;
  const isAltoImpacto = dataset === 'alto_impacto';
  const wireDataset = isAltoImpacto ? 'delitos' : dataset;

  // Force table view to entidades when on victimas dataset
  useEffect(() => {
    if (isVictimas) {
      setTableView('entidades');
    }
  }, [dataset]);

  useEffect(() => {
    if (!selectedFilters || selectedFilters.anio === null) return;

    const controller = new AbortController();
    setLoading(true);

    const params = { dataset: wireDataset };
    params.anio = selectedFilters.anio;
    params.metric_type = metricType;
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      params.altoImpacto = ai.join('|');
    }
    if (selectedFilters.entidad !== 'All') params.entidad = selectedFilters.entidad;
    const bj = Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : [];
    const td = Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : [];
    const sd = Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : [];
    const mo = Array.isArray(selectedFilters.modalidad) ? selectedFilters.modalidad : [];
    const sx = Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : [];
    const re = Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : [];

    if (bj.length > 0) params.bienJuridico = bj.join('|');
    if (td.length > 0) params.tipoDelito = td.join('|');
    if (sd.length > 0) params.subtipoDelito = sd.join('|');
    if (mo.length > 0) params.modalidad = mo.join('|');
    if (sx.length > 0) params.sexo = sx.join('|');
    if (re.length > 0) params.rangoEdad = re.join('|');
    if (selectedFilters.meses && selectedFilters.meses.length > 0) params.meses = selectedFilters.meses.join(',');
    
    const totalParams = { ...params };
    if (!isVictimas && selectedFilters.municipio && selectedFilters.municipio !== 'All') {
      totalParams.municipio = selectedFilters.municipio;
    }

    const signal = controller.signal;

    const requests = [
      axios.get(`${API_URL}/api/total_incidencia`, { params: totalParams, signal }),
      axios.get(`${API_URL}/api/incidencia_por_entidad`, { params, signal }),
    ];

    if (!isVictimas) {
      requests.push(axios.get(`${API_URL}/api/incidencia_por_municipio`, { params, signal }));
    }

    Promise.all(requests)
      .then(([resTotal, resEntidades, resMunicipios]) => {
        setError(false);
        if (resTotal.data?.total_incidencia !== undefined) {
          setTotalIncidencia(resTotal.data.total_incidencia);
        }
        if (resEntidades.data) setEntidades(resEntidades.data);
        if (!isVictimas && resMunicipios?.data) {
          setMunicipios(resMunicipios.data);
        } else {
          setMunicipios([]);
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return; // petición cancelada, ignorar
        console.error('Error fetching sidebar data', err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
        if (onInitialLoad && !initialLoadCalled.current) {
          initialLoadCalled.current = true;
          onInitialLoad();
        }
      });

    return () => controller.abort();
  }, [selectedFilters, metricType, retryKey]);

  const formatNumber = (num) => {
    if (num === 'N/D' || num === undefined || num === null) return 'N/D';
    const val = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(val)) return 'N/D';
    if (metricType === 'rate') {
      return val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('es-MX');
  };

  // Determinar la entidad activa a mostrar en el KPI card
  const activeEntityName = (!selectedFilters?.entidad || selectedFilters.entidad === 'All')
    ? 'Sonora'
    : selectedFilters.entidad;

  const activeEntityData = entidades.find(e => e.name === activeEntityName);
  const activeEntityRank = activeEntityData ? activeEntityData.id : null;
  const totalEntidades = entidades.length;
  const rankCriterion = metricType === 'rate' ? 'mayor tasa' : (isVictimasBase ? 'más víctimas' : 'mayor incidencia');

  // Periodo explícito del KPI: meses seleccionados (o todos) + año
  const periodLabel = (() => {
    const anio = selectedFilters?.anio ?? '';
    const sel = Array.isArray(selectedFilters?.meses) ? selectedFilters.meses : [];
    const idx = sel.map(m => MESES.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b);
    if (idx.length === 0 || idx.length === 12) return `Año ${anio}`;
    const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
    if (idx.length === 1) return `${MESES_CORTOS[idx[0]]} ${anio}`;
    if (contiguous) return `${MESES_CORTOS[idx[0]]}–${MESES_CORTOS[idx[idx.length - 1]]} ${anio}`;
    return `${idx.map(i => MESES_CORTOS[i]).join(', ')} ${anio}`;
  })();
  const totalIsND = totalIncidencia === 'N/D';
  const selectedMunicipio = (!isVictimas && selectedFilters?.municipio && selectedFilters.municipio !== 'All') ? selectedFilters.municipio : null;
  const activeIncidenceLabel = (selectedFilters?.municipio && selectedFilters.municipio !== 'All')
    ? selectedFilters.municipio
    : (isVictimasBase ? 'Víctimas' : 'Incidencia');

  const isEntidades = tableView === 'entidades' || isVictimas;
  const rows = isEntidades ? entidades : municipios;
  const colLabel = isEntidades ? 'Entidad' : 'Municipio';
  
  const maxVal = rows.reduce((mx, r) => (typeof r.value === 'number' && r.value > mx ? r.value : mx), 0);

  const baseValLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';
  const valLabel = metricType === 'rate' ? `${baseValLabel} (Tasa)` : baseValLabel;

  const getExportFilename = (ext) => {
    if (isVictimas) return `tabla_victimas_entidad.${ext}`;
    if (isVictimasMun) return `tabla_victimas_mun_${tableView}.${ext}`;
    if (isAltoImpacto) return `tabla_alto_impacto_${tableView}.${ext}`;
    return `tabla_delitos_${tableView}.${ext}`;
  };

  const handleDownloadCSV = () => {
    const csvValLabel = metricType === 'rate' ? `${baseValLabel} (Tasa por 100k hab.)` : baseValLabel;
    const headers = ["Rank", colLabel, csvValLabel];
    const dataForExport = rows.map(m => [m.id, m.name, m.value]);
    downloadCSV(getExportFilename('csv'), dataForExport, headers, { ...selectedFilters, metricType });
  };

  const handleCopy = () => {
    const csvValLabel = metricType === 'rate' ? `${baseValLabel} (Tasa por 100k hab.)` : baseValLabel;
    const headers = ["Rank", colLabel, csvValLabel];
    const dataForExport = rows.map(m => [m.id, m.name, m.value]);
    copyTableToClipboard(dataForExport, headers);
  };

  if (isFullScreen) {
    return (
      <div 
        ref={tableCardRef} 
        className="fullscreen-immersive-overlay"
      >
        <FullScreenHeader
          title={isVictimas ? "Víctimas por Entidad" : isAltoImpacto ? `Ranking de Alto Impacto por ${tableView === 'entidades' ? 'Entidad' : 'Municipio'}` : `Ranking de Incidencia por ${tableView === 'entidades' ? 'Entidad' : 'Municipio'}`}
          selectedFilters={selectedFilters}
          metricType={metricType}
          onClose={() => setIsFullScreen(false)}
          extraActions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {!isVictimas && (
                <div style={{
                  display: 'inline-flex',
                  background: 'var(--color-accent-light, #f0f4ff)',
                  borderRadius: '10px',
                  padding: '3px',
                  gap: '2px',
                  width: '200px',
                  boxSizing: 'border-box',
                }}>
                  {['entidades', 'municipios'].map((view) => {
                    const active = tableView === view;
                    const label = view === 'entidades' ? 'Entidades' : 'Municipios';
                    return (
                      <button
                        key={view}
                        onClick={() => setTableView(view)}
                        style={{
                          flex: 1,
                          padding: '0.4rem 0',
                          fontSize: '0.8rem',
                          fontWeight: active ? 700 : 500,
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'background 0.22s ease, color 0.22s ease',
                          background: active ? 'var(--color-accent, #2563eb)' : 'transparent',
                          color: active ? '#fff' : 'var(--text-secondary, #64748b)',
                          letterSpacing: '0.01em',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <ExportMenu
                elementRef={tableCardRef}
                imageFilename={getExportFilename('png')}
                onDownloadCSV={handleDownloadCSV}
                onCopyTable={handleCopy}
                isTable={true}
              />
            </div>
          }
        />

        {/* Centered Table wrapper for perfect layout */}
        <div style={{ 
          maxWidth: '800px', 
          width: '100%', 
          margin: '0 auto', 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative'
        }}>
          {loading && <LoadingSpinner size="md" />}
          
          {/* Table Header */}
            <div style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `${Math.round(40 * fsScale)}px 1fr ${Math.round(120 * fsScale)}px`, gap: '1rem', fontWeight: 700, color: 'var(--color-primary)', fontSize: `${0.95 * fsScale}rem` }}>
              <span>#</span>
              <span>{colLabel}</span>
              <span style={{ textAlign: 'right' }}>{valLabel}</span>
            </div>
          </div>

          {/* Table Rows */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0', position: 'relative', minHeight: '140px' }}>
            {error ? (
              <EmptyState variant="error" onRetry={() => setRetryKey(k => k + 1)} />
            ) : (rows.length === 0 && !loading) ? (
              <EmptyState />
            ) : rows.map((m) => {
              const hl = isHighlightedRow(m, isEntidades, activeEntityName, selectedMunicipio);
              const pct = maxVal > 0 && typeof m.value === 'number' ? Math.max(2, (m.value / maxVal) * 100) : 0;
              // En municipios la entidad ya está elegida: no repetir ", Sonora"
              const displayName = isEntidades ? m.name : (m.municipio || m.name);
              return (
                <div
                  key={`${tableView}-${m.name}-${m.id}`}
                  aria-current={hl ? 'true' : undefined}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `${Math.round(40 * fsScale)}px 1fr ${Math.round(120 * fsScale)}px`,
                    gap: '1rem',
                    alignItems: 'center',
                    padding: `${0.7 * fsScale}rem 1rem`,
                    fontSize: `${0.9 * fsScale}rem`,
                    backgroundColor: hl ? '#e3e8f3' : 'transparent',
                    color: hl ? 'var(--color-accent-dark)' : 'var(--color-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    fontWeight: hl ? 700 : 400,
                  }}
                >
                  <span className="tabular" style={{ color: hl ? 'var(--color-accent-dark)' : 'var(--text-secondary)', fontWeight: hl ? 700 : 500 }}>
                    {m.id}
                  </span>
                  <span title={m.name} style={{ fontWeight: hl ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  <span
                    className="tabular"
                    style={{
                      textAlign: 'right',
                      fontWeight: hl ? 700 : 600,
                      padding: '2px 4px',
                      borderRadius: '3px',
                      background: `linear-gradient(to left, rgba(69, 89, 147, ${hl ? 0.22 : 0.12}) ${pct}%, transparent ${pct}%)`
                    }}
                  >
                    {formatNumber(m.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* KPI Cards: total del periodo + lugar nacional de la entidad activa */}
      <div style={{ display: 'flex', gap: 'var(--grid-gap, 1rem)' }}>
        {/* El total lleva la cifra larga: tarjeta más ancha que la del lugar (siempre corta) */}
        <div className="card kpi-card" style={{ flex: 1.6, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', padding: '0.85rem 1rem', position: 'relative', minWidth: 0 }}>
          {loading && <LoadingSpinner size="sm" />}
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeIncidenceLabel}{metricType === 'rate' ? ' · tasa' : ''}
          </span>
          <span
            title={totalIsND ? 'Sin población CONAPO para calcular la tasa en este periodo' : undefined}
            className="tabular kpi-value"
            style={{ '--chars': String(error ? '—' : formatNumber(totalIncidencia)).length, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.1, letterSpacing: '-0.02em' }}
          >
            {error ? '—' : formatNumber(totalIncidencia)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {totalIsND && !error ? 'Sin población CONAPO para la tasa' : periodLabel}
          </span>
        </div>
        <div
          className="card"
          title={`Posición de ${activeEntityName} entre las ${totalEntidades || 32} entidades con los filtros aplicados (1 = ${rankCriterion})`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', padding: '0.85rem 1rem', position: 'relative', minWidth: 0 }}
        >
          {loading && <LoadingSpinner size="sm" />}
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeEntityName}
          </span>
          <span className="tabular" style={{ lineHeight: 1.1, display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span style={{ fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '-0.02em' }}>
              {error || activeEntityRank === null ? '—' : activeEntityRank}
            </span>
            {!error && activeEntityRank !== null && totalEntidades > 0 && (
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>de {totalEntidades}</span>
            )}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>lugar nacional</span>
        </div>
      </div>

      {/* Incidence Table with Toggle */}
      <div ref={tableCardRef} className="card sidebar-table-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {loading && <LoadingSpinner size="md" />}

        {/* Segmented Control and Export Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem 0.5rem', gap: '1rem' }}>
          {!isVictimas ? (
            <div style={{
              display: 'inline-flex',
              background: 'var(--color-accent-light, #f0f4ff)',
              borderRadius: '10px',
              padding: '3px',
              gap: '2px',
              flex: 1,
              boxSizing: 'border-box',
            }}>
              {['entidades', 'municipios'].map((view) => {
                const active = tableView === view;
                const label = view === 'entidades' ? 'Entidades' : 'Municipios';
                return (
                  <button
                    key={view}
                    onClick={() => setTableView(view)}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0',
                      fontSize: '0.8rem',
                      fontWeight: active ? 700 : 500,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease',
                      background: active
                        ? 'var(--color-accent, #2563eb)'
                        : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary, #64748b)',
                      boxShadow: active
                        ? '0 2px 8px rgba(37,99,235,0.18)'
                        : 'none',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-primary)' }}>
              Víctimas por Entidad
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              elementRef={tableCardRef}
              imageFilename={getExportFilename('png')}
              onDownloadCSV={handleDownloadCSV}
              onCopyTable={handleCopy}
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
              title="Ver en pantalla completa"
              aria-label="Ver en pantalla completa"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-main)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table Header */}
        <div style={{ padding: isVictimas ? '1rem 1rem 0.5rem' : '0 1rem 0.5rem', borderBottom: '2px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px', gap: '0.5rem', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.875rem' }}>
            <span>#</span>
            <span style={{ transition: 'opacity 0.2s' }}>{colLabel}</span>
            <span style={{ textAlign: 'right' }}>{valLabel}</span>
          </div>
        </div>

        {/* Table Rows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0', position: 'relative', minHeight: '140px' }}>
          {error ? (
            <EmptyState variant="error" onRetry={() => setRetryKey(k => k + 1)} />
          ) : (rows.length === 0 && !loading) ? (
            <EmptyState />
          ) : rows.map((m) => {
            const hl = isHighlightedRow(m, isEntidades, activeEntityName, selectedMunicipio);
            const pct = maxVal > 0 && typeof m.value === 'number' ? Math.max(2, (m.value / maxVal) * 100) : 0;
            // En municipios la entidad ya está elegida: no repetir ", Sonora"
            const displayName = isEntidades ? m.name : (m.municipio || m.name);
            return (
              <div
                key={`${tableView}-${m.name}-${m.id}`}
                aria-current={hl ? 'true' : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1fr 80px',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.45rem 1rem',
                  fontSize: '0.875rem',
                  backgroundColor: hl ? '#e3e8f3' : 'transparent',
                  color: hl ? 'var(--color-accent-dark)' : 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontWeight: hl ? 700 : 400,
                }}
              >
                <span className="tabular" style={{ color: hl ? 'var(--color-accent-dark)' : 'var(--text-secondary)', fontWeight: hl ? 700 : 500 }}>
                  {m.id}
                </span>
                <span title={m.name} style={{ fontWeight: hl ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
                <span
                  className="tabular"
                  style={{
                    textAlign: 'right',
                    fontWeight: hl ? 700 : 600,
                    padding: '2px 4px',
                    borderRadius: '3px',
                    background: `linear-gradient(to left, rgba(69, 89, 147, ${hl ? 0.22 : 0.12}) ${pct}%, transparent ${pct}%)`
                  }}
                >
                  {formatNumber(m.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default SidebarLeft;

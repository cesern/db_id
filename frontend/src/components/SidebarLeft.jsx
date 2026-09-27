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

// Resaltado de filas:
// - 'strong': la entidad activa (vista Entidades) o el municipio seleccionado.
// - 'soft': en vista Municipios a nivel Nacional, los municipios de Sonora (entidad activa por
//   defecto), sin negritas. Con una entidad elegida todas las filas son de ella: no se resaltan.
const rowHighlight = (m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada) => {
  if (isEntidades) return m.name === activeEntityName ? 'strong' : null;
  if (selectedMunicipio && m.municipio === selectedMunicipio) return 'strong';
  if (entidadFiltrada) return null;
  return m.entidad === activeEntityName ? 'soft' : null;
};

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

  // Lugar nacional del año anterior con los mismos filtros. Si el año actual es parcial
  // (sin meses elegidos), se compara contra los mismos meses del año anterior.
  const [prevRank, setPrevRank] = useState(null); // { anio, rank, periodo, value } | null
  const [showRankTip, setShowRankTip] = useState(false);
  // Último mes con datos del año seleccionado (con los filtros): para rotular el periodo real
  const [curMesFinal, setCurMesFinal] = useState(null);
  useEffect(() => {
    if (!selectedFilters || selectedFilters.anio == null) return undefined;
    const controller = new AbortController();
    const signal = controller.signal;
    const anio = Number(selectedFilters.anio);
    const base = { dataset: wireDataset, metric_type: metricType };
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      base.altoImpacto = ai.join('|');
    }
    for (const k of ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'sexo', 'rangoEdad']) {
      const v = Array.isArray(selectedFilters[k]) ? selectedFilters[k] : [];
      if (v.length > 0) base[k] = v.join('|');
    }
    const entityName = (!selectedFilters.entidad || selectedFilters.entidad === 'All') ? 'Sonora' : selectedFilters.entidad;
    (async () => {
      try {
        let meses = Array.isArray(selectedFilters.meses) ? selectedFilters.meses : [];
        const years = await axios.get(`${API_URL}/api/incidencia_por_anio`, { params: base, signal });
        const rows = Array.isArray(years.data) ? years.data : [];
        const cur = rows.find(d => Number(d.year) === anio);
        setCurMesFinal(cur && typeof cur.mes_final === 'number' ? cur.mes_final : null);
        if (!cur || !rows.some(d => Number(d.year) === anio - 1)) { setPrevRank(null); return; }
        if (meses.length === 0 && cur.mes_final && cur.mes_final < 12) meses = MESES.slice(0, cur.mes_final);
        const params = { ...base, anio: anio - 1 };
        if (meses.length > 0) params.meses = meses.join(',');
        const res = await axios.get(`${API_URL}/api/incidencia_por_entidad`, { params, signal });
        const row = (Array.isArray(res.data) ? res.data : []).find(e => e.name === entityName);
        const idx = meses.map(m => MESES.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b);
        const periodo = idx.length > 0 && idx.length < 12 ? `${MESES_CORTOS[idx[0]]}–${MESES_CORTOS[idx[idx.length - 1]]}` : null;
        setPrevRank(row ? { anio: anio - 1, rank: row.id, periodo, value: row.value } : null);
      } catch (err) {
        if (!axios.isCancel(err)) setPrevRank(null);
      }
    })();
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
    // Sin meses elegidos: si el año está incompleto se rotula el periodo real (Ene–Ago 2026)
    if (idx.length === 0 && curMesFinal && curMesFinal < 12) return `Ene–${MESES_CORTOS[curMesFinal - 1]} ${anio}`;
    if (idx.length === 0 || idx.length === 12) return `Año ${anio}`;
    const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
    if (idx.length === 1) return `${MESES_CORTOS[idx[0]]} ${anio}`;
    if (contiguous) return `${MESES_CORTOS[idx[0]]}–${MESES_CORTOS[idx[idx.length - 1]]} ${anio}`;
    return `${idx.map(i => MESES_CORTOS[i]).join(', ')} ${anio}`;
  })();
  const totalIsND = totalIncidencia === 'N/D';
  const entidadFiltrada = !!(selectedFilters?.entidad && selectedFilters.entidad !== 'All');
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
              const level = rowHighlight(m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada);
              const hl = level === 'strong';
              const pct = maxVal > 0 && typeof m.value === 'number' ? Math.max(2, (m.value / maxVal) * 100) : 0;
              // Con una entidad elegida no se repite ", Sonora"; en Nacional se muestra "Municipio, Entidad"
              const displayName = (isEntidades || !entidadFiltrada) ? m.name : (m.municipio || m.name);
              return (
                <div
                  key={`${tableView}-${m.name}-${m.id}`}
                  aria-current={hl ? 'true' : undefined}
                data-highlight={level || undefined}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `${Math.round(40 * fsScale)}px 1fr ${Math.round(120 * fsScale)}px`,
                    gap: '1rem',
                    alignItems: 'center',
                    padding: `${0.7 * fsScale}rem 1rem`,
                    fontSize: `${0.9 * fsScale}rem`,
                    backgroundColor: hl ? '#e3e8f3' : (level === 'soft' ? '#e9edf6' : 'transparent'),
                    color: level ? 'var(--color-accent-dark)' : 'var(--color-primary)',
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
        {/* La posición nacional va primero: "Sonora · 21 de 32" + indicador vs año anterior.
            ▲ rojo = subió (hacia el 1, más incidencia); ▼ verde = bajó; = gris = mismo lugar.
            El detalle vive en un tooltip (mouse y teclado), no en pantalla. */}
        <div
          className="card"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', padding: '0.85rem 1rem', position: 'relative', minWidth: 0 }}
        >
          {loading && <LoadingSpinner size="sm" />}
          {/* Fila superior: entidad a la izquierda, indicador de cambio a la derecha
              (así "21 de 32" conserva todo el ancho de la tarjeta angosta) */}
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', minWidth: 0 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeEntityName}
            </span>
              {!error && activeEntityRank !== null && prevRank && (() => {
                const diff = prevRank.rank - activeEntityRank; // > 0: subió hacia el 1
                const up = diff > 0, down = diff < 0;
                const cmpPrev = `${prevRank.periodo ? prevRank.periodo + ' ' : ''}${prevRank.anio}`;
                const cmpNow = `${prevRank.periodo ? prevRank.periodo + ' ' : ''}${selectedFilters?.anio}`;
                const unit = metricType === 'rate' ? 'por 100 mil hab.' : (isVictimasBase ? 'víctimas' : 'delitos');
                const headline = up ? `Subió ${diff} ${diff === 1 ? 'lugar' : 'lugares'}`
                  : down ? `Bajó ${-diff} ${diff === -1 ? 'lugar' : 'lugares'}` : 'Mismo lugar';
                const currentValue = activeEntityData ? activeEntityData.value : null;
                return (
                  <span
                    className="rank-change"
                    tabIndex={0}
                    role="img"
                    aria-label={`${headline}. ${cmpPrev}: lugar ${prevRank.rank}, ${formatNumber(prevRank.value)} ${unit}; ${cmpNow}: lugar ${activeEntityRank}, ${formatNumber(currentValue)} ${unit}`}
                    onMouseEnter={() => setShowRankTip(true)}
                    onMouseLeave={() => setShowRankTip(false)}
                    onFocus={() => setShowRankTip(true)}
                    onBlur={() => setShowRankTip(false)}
                    data-dir={up ? 'up' : down ? 'down' : 'same'}
                  >
                    <span aria-hidden="true">{up ? '▲' : down ? '▼' : '='}</span>
                    {showRankTip && (
                      <span className="rank-tip" role="tooltip">
                        <strong>{headline}</strong>
                        <span>{cmpPrev}: lugar {prevRank.rank} · {formatNumber(prevRank.value)} {unit}</span>
                        <span>{cmpNow}: lugar {activeEntityRank} · {formatNumber(currentValue)} {unit}</span>
                        <em>1 = entidad con {rankCriterion}</em>
                      </span>
                    )}
                  </span>
                );
              })()}
          </span>
          <span className="tabular" style={{ lineHeight: 1.1, display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            <span style={{ fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '-0.02em' }}>
              {error || activeEntityRank === null ? '—' : activeEntityRank}
            </span>
            {!error && activeEntityRank !== null && totalEntidades > 0 && (
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>de {totalEntidades}</span>
            )}
          </span>
        </div>
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
            const level = rowHighlight(m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada);
              const hl = level === 'strong';
            const pct = maxVal > 0 && typeof m.value === 'number' ? Math.max(2, (m.value / maxVal) * 100) : 0;
            // Con una entidad elegida no se repite ", Sonora"; en Nacional se muestra "Municipio, Entidad"
            const displayName = (isEntidades || !entidadFiltrada) ? m.name : (m.municipio || m.name);
            return (
              <div
                key={`${tableView}-${m.name}-${m.id}`}
                aria-current={hl ? 'true' : undefined}
                data-highlight={level || undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1fr 80px',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.45rem 1rem',
                  fontSize: '0.875rem',
                  backgroundColor: hl ? '#e3e8f3' : (level === 'soft' ? '#e9edf6' : 'transparent'),
                  color: level ? 'var(--color-accent-dark)' : 'var(--color-primary)',
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

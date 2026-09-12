import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Line } from 'recharts';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';

// Slider de rango con doble manija. Mientras se arrastra solo mueve el
// borrador (onDraft); la gráfica se actualiza al soltar (onCommit).
const RangeSlider = ({ count, start, end, names, pending, onDraft, onCommit }) => {
  const trackRef = useRef(null);
  const dragWhich = useRef(null);

  if (!count || count < 5) return null;

  const last = count - 1;
  const pct = (i) => (last <= 0 ? 0 : (i / last) * 100);

  const indexFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(last, Math.round(ratio * last)));
  };

  const handlePointerDown = (e) => {
    const thumb = e.target.closest('[data-thumb]');
    if (thumb) {
      dragWhich.current = thumb.dataset.thumb; // 'start' | 'end'
    } else {
      // Clic en la pista: mueve la manija más cercana y confirma al instante
      const idx = indexFromClientX(e.clientX);
      if (Math.abs(idx - start) <= Math.abs(idx - end)) {
        const s = Math.max(0, Math.min(idx, end));
        onDraft(s, end);
        onCommit(s, end);
        return;
      }
      const en = Math.max(start, Math.min(idx, last));
      onDraft(start, en);
      onCommit(start, en);
      return;
    }
    e.preventDefault();
    try { trackRef.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const handlePointerMove = (e) => {
    if (!dragWhich.current) return;
    const idx = indexFromClientX(e.clientX);
    if (dragWhich.current === 'start') {
      onDraft(Math.max(0, Math.min(idx, end)), end);
    } else {
      onDraft(start, Math.max(start, Math.min(idx, last)));
    }
  };

  const handlePointerUp = () => {
    if (!dragWhich.current) return;
    dragWhich.current = null;
    onCommit(start, end); // confirma al soltar
  };

  const handleKey = (which) => (e) => {
    let ns = start;
    let ne = end;
    if (e.key === 'ArrowLeft') {
      if (which === 'start') ns = Math.max(0, start - 1);
      else ne = Math.max(start, end - 1);
    } else if (e.key === 'ArrowRight') {
      if (which === 'start') ns = Math.min(end, start + 1);
      else ne = Math.min(last, end + 1);
    } else if (e.key === 'Home') {
      if (which === 'start') ns = 0;
      else ne = start;
    } else if (e.key === 'End') {
      if (which === 'start') ns = end;
      else ne = last;
    } else {
      return;
    }
    e.preventDefault();
    if (which === 'start') { onDraft(ns, end); onCommit(ns, end); }
    else { onDraft(start, ne); onCommit(start, ne); }
  };

  const thumbBase = {
    position: 'absolute',
    top: '50%',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#ffffff',
    border: '2px solid var(--color-accent)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    cursor: 'ew-resize',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
    padding: 0,
  };

  const thumbProps = (which, index) => ({
    'data-thumb': which,
    role: 'slider',
    tabIndex: 0,
    'aria-label': which === 'start' ? 'Inicio del periodo' : 'Fin del periodo',
    'aria-valuemin': 0,
    'aria-valuemax': last,
    'aria-valuenow': index,
    'aria-valuetext': names[index],
    onKeyDown: handleKey(which),
    style: { ...thumbBase, left: `${pct(index)}%` },
  });

  return (
    <div style={{ padding: '0.35rem 0.6rem 0.15rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{names[start]}</span>
        <span style={{ fontSize: '0.7rem', color: pending ? 'var(--color-accent)' : 'var(--text-secondary)', fontWeight: pending ? 700 : 400, whiteSpace: 'nowrap' }}>
          {`${end - start + 1} meses${pending ? ' · suelta para aplicar' : ''}`}
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{names[end]}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ position: 'relative', height: '22px', cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '6px', transform: 'translateY(-50%)', borderRadius: '999px', background: 'var(--border-color)' }} />
        <div style={{ position: 'absolute', top: '50%', height: '6px', transform: 'translateY(-50%)', borderRadius: '999px', background: 'var(--color-accent)', left: `${pct(start)}%`, width: `${Math.max(pct(end) - pct(start), 0)}%` }} />
        <div {...thumbProps('start', start)} />
        <div {...thumbProps('end', end)} />
      </div>
    </div>
  );
};

const ChartLineTrend = ({ selectedFilters, metricType, onInitialLoad }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [activeToggles, setActiveToggles] = useState({
    promedio: false,
    maximo: false,
    minimo: false,
    tendencia: false
  });

  // null | 3 | 6 | 12
  const [maWindow, setMAWindow] = useState(null);

  // Rango confirmado del histórico (lo que ve la gráfica). null = periodo completo.
  const [brushRange, setBrushRange] = useState(null);
  // Borrador del slider: se mueve al arrastrar, se confirma al soltar.
  const [draftRange, setDraftRange] = useState(null);

  // Al llegar datos nuevos (filtros/dataset), volver al periodo completo.
  useEffect(() => {
    if (data.length > 0) {
      const full = { startIndex: 0, endIndex: data.length - 1 };
      setBrushRange(full);
      setDraftRange(full);
    } else {
      setBrushRange(null);
      setDraftRange(null);
    }
  }, [data]);

  const initialLoadCalled = useRef(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    if (isFullScreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  useEffect(() => {
    if (!selectedFilters) return;

    const controller = new AbortController();
    setLoading(true);

    const dataset = selectedFilters.dataset || 'delitos';
    const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';

    const params = new URLSearchParams();
    params.append("dataset", dataset);
    params.append("metric_type", metricType);
    if (selectedFilters.entidad && selectedFilters.entidad !== "All") params.append("entidad", selectedFilters.entidad);
    if (!isVictimas && selectedFilters.municipio && selectedFilters.municipio !== "All") params.append("municipio", selectedFilters.municipio);
    const bj = Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : [];
    const td = Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : [];
    const sd = Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : [];
    const mo = Array.isArray(selectedFilters.modalidad) ? selectedFilters.modalidad : [];
    const sx = Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : [];
    const re = Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : [];

    if (bj.length > 0) params.append("bienJuridico", bj.join('|'));
    if (td.length > 0) params.append("tipoDelito", td.join('|'));
    if (sd.length > 0) params.append("subtipoDelito", sd.join('|'));
    if (mo.length > 0) params.append("modalidad", mo.join('|'));
    if (sx.length > 0) params.append("sexo", sx.join('|'));
    if (re.length > 0) params.append("rangoEdad", re.join('|'));

    axios.get(`${API_URL}/api/incidencia_por_mes_historico?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (res.data) setData(res.data);
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error fetching incidencia por mes histórico", err);
      })
      .finally(() => {
        setLoading(false);
        if (onInitialLoad && !initialLoadCalled.current) {
          initialLoadCalled.current = true;
          onInitialLoad();
        }
      });

    return () => controller.abort();
  }, [selectedFilters, metricType]);

  const dataset = selectedFilters?.dataset || 'delitos';
  const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';
  const isVictimasBase = isVictimas || isVictimasMun;

  const formatValue = (val) => {
    if (val === 'N/D' || val === undefined || val === null) return 'N/D';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return 'N/D';
    if (metricType === 'rate') {
      return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    }
    return new Intl.NumberFormat('es-MX').format(num);
  };

  // Índices confirmados clamped al tamaño actual de datos
  const brushStart = brushRange && data.length > 0
    ? Math.max(0, Math.min(brushRange.startIndex ?? 0, data.length - 1))
    : 0;
  const brushEnd = brushRange && data.length > 0
    ? Math.max(0, Math.min(brushRange.endIndex ?? data.length - 1, data.length - 1))
    : Math.max(0, data.length - 1);

  // Posición del borrador del slider (no toca la gráfica hasta confirmar)
  const draftStart = draftRange && data.length > 0
    ? Math.max(0, Math.min(draftRange.startIndex ?? 0, data.length - 1))
    : brushStart;
  const draftEnd = draftRange && data.length > 0
    ? Math.max(0, Math.min(draftRange.endIndex ?? data.length - 1, data.length - 1))
    : brushEnd;

  const isRangePending = draftRange && brushRange &&
    (draftRange.startIndex !== brushRange.startIndex || draftRange.endIndex !== brushRange.endIndex);

  const getExportData = () => {
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const actualValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const maLabel = maWindow === 12
      ? `Smoothing (MA12)`
      : maWindow
        ? `Prom. Móvil ${maWindow}M`
        : null;

    const headers = maLabel
      ? ["Año-Mes", actualValLabel, maLabel]
      : ["Año-Mes", actualValLabel];

    // Exporta solo el rango visible del slider
    const dataForExport = visibleChartData.map(d => {
      const row = [d.name, d.value];
      if (maLabel) row.push(d.maValue !== null && d.maValue !== undefined ? d.maValue : '');
      return row;
    });
    return { headers, dataForExport };
  };

  const getExportFilename = () => {
    const base = isVictimasBase ? "historico_victimas" : "historico_incidencia";
    if (!visibleChartData || visibleChartData.length === 0 || visibleChartData.length === data.length) {
      return `${base}.csv`;
    }
    const clean = (s) => String(s).replace(/\s+/g, '-');
    return `${base}_${clean(visibleChartData[0].name)}_a_${clean(visibleChartData[visibleChartData.length - 1].name)}.csv`;
  };

  const handleDownloadCSV = () => {
    const { headers, dataForExport } = getExportData();
    downloadCSV(
      getExportFilename(),
      dataForExport,
      headers,
      { ...selectedFilters, metricType }
    );
  };

  const handleCopyData = () => {
    const { headers, dataForExport } = getExportData();
    copyTableToClipboard(dataForExport, headers);
  };

  const chartTitle = isVictimasBase
    ? (metricType === 'rate' ? 'Histórico mensual de tasa de víctimas' : 'Histórico mensual de víctimas')
    : (metricType === 'rate' ? 'Histórico mensual de tasa de incidencia' : 'Histórico mensual de incidencia');

  const tooltipLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';

  // Compute statistics + MA over the slider-visible range.
  // chartData = serie completa enriquecida; visibleChartData = recorte
  // [brushStart, brushEnd] usado en gráfica, stats y export.
  const { chartData, visibleChartData, averageValue, maxItem, minItem, slope } = useMemo(() => {
    const endIdx = data.length > 0 ? Math.min(brushEnd, data.length - 1) : -1;
    const startIdx = data.length > 0 ? Math.min(brushStart, Math.max(endIdx, 0)) : 0;
    const visibleRaw = endIdx >= 0 ? data.slice(startIdx, endIdx + 1) : [];

    const numericVisible = visibleRaw
      .map(d => ({ ...d, numericVal: typeof d.value === 'number' ? d.value : parseFloat(d.value) }))
      .filter(d => !isNaN(d.numericVal));

    if (numericVisible.length === 0) {
      return { chartData: data, visibleChartData: visibleRaw, averageValue: 0, maxItem: null, minItem: null, slope: 0 };
    }

    // 1. Promedio del rango visible
    const totalSum = numericVisible.reduce((sum, d) => sum + d.numericVal, 0);
    const averageValue = totalSum / numericVisible.length;

    // 2. Máximo del rango visible
    let maxItem = numericVisible[0];
    for (let i = 1; i < numericVisible.length; i++) {
      if (numericVisible[i].numericVal > maxItem.numericVal) maxItem = numericVisible[i];
    }

    // 3. Mínimo del rango visible
    let minItem = numericVisible[0];
    for (let i = 1; i < numericVisible.length; i++) {
      if (numericVisible[i].numericVal < minItem.numericVal) minItem = numericVisible[i];
    }

    // 4. Regresión lineal del rango visible para Tendencia
    const n = numericVisible.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += numericVisible[i].numericVal;
      sumXY += i * numericVisible[i].numericVal;
      sumXX += i * i;
    }
    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // 5. Promedio Móvil calculado sobre el rango visible
    const computeMA = (windowSize) => {
      return numericVisible.map((d, i) => {
        if (i < windowSize - 1) return null;
        const slice = numericVisible.slice(i - windowSize + 1, i + 1);
        const avg = slice.reduce((s, x) => s + x.numericVal, 0) / windowSize;
        return { name: d.name, maValue: parseFloat(avg.toFixed(4)) };
      });
    };

    const maEntries = maWindow ? computeMA(maWindow) : null;
    const maMap = {};
    if (maEntries) {
      maEntries.forEach(entry => {
        if (entry) maMap[entry.name] = entry.maValue;
      });
    }
    const trendMap = {};
    numericVisible.forEach((d, i) => {
      trendMap[d.name] = parseFloat((slope * i + intercept).toFixed(4));
    });

    const enrich = (d) => {
      const result = { ...d };
      if (trendMap[d.name] !== undefined) {
        result.trendValue = trendMap[d.name];
      }
      if (maWindow) {
        result.maValue = maMap[d.name] !== undefined ? maMap[d.name] : null;
      }
      return result;
    };

    const chartData = data.map(enrich);
    const visibleChartData = visibleRaw.map(enrich);

    return { chartData, visibleChartData, averageValue, maxItem, minItem, slope };
  }, [data, maWindow, brushStart, brushEnd]);

  // Lo que realmente pinta la gráfica: el rango confirmado
  const displayData = visibleChartData && visibleChartData.length > 0 ? visibleChartData : chartData;

  const trendColor = slope >= 0 ? '#ef4444' : '#10b981';

  const handleToggle = (key) => {
    setActiveToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMAToggle = (win) => {
    setMAWindow(prev => prev === win ? null : win);
  };

  const toggleButtons = [
    { key: 'promedio', label: 'Promedio' },
    { key: 'maximo', label: 'Máximo' },
    { key: 'minimo', label: 'Mínimo' },
    { key: 'tendencia', label: 'Tendencia' }
  ];

  const maButtons = [
    { win: 3,  label: '3M' },
    { win: 6,  label: '6M' },
    { win: 12, label: 'Suavizado' }
  ];

  const [showMAInfo, setShowMAInfo] = useState(false);
  const infoRef = useRef(null);
  const [infoPos, setInfoPos] = useState({ top: 0, right: 0 });

  const btnStyle = (active) => ({
    padding: '0.25rem 0.55rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: active ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
    background: active ? 'var(--color-accent)' : '#ffffff',
    color: active ? '#ffffff' : 'var(--text-secondary)',
    boxShadow: active ? '0 1px 3px rgba(69,89,147,0.25)' : 'none',
  });

  // Cuando hay MA activo la serie original se atenúa
  const originalOpacity = maWindow ? 0.3 : 1;
  const originalFillOpacity = maWindow ? 0.08 : 1;

  const maLabel = maWindow === 12 ? 'Suavizado (MA 12M)' : maWindow ? `MA ${maWindow}M` : '';

  return (
    <div 
      ref={cardRef} 
      className={isFullScreen ? "fullscreen-immersive-overlay" : ""}
      style={isFullScreen ? {} : { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}
    >
      {isFullScreen ? (
        <FullScreenHeader
          title={chartTitle}
          selectedFilters={selectedFilters}
          metricType={metricType}
          onClose={() => setIsFullScreen(false)}
          extraActions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Toggles estadísticos */}
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {toggleButtons.map((btn) => (
                  <button
                    key={btn.key}
                    onClick={() => handleToggle(btn.key)}
                    style={btnStyle(activeToggles[btn.key])}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Separador visual */}
              <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

              {/* Botones de Promedio Móvil + Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', position: 'relative' }}>
                {maButtons.map(({ win, label }) => (
                  <button
                    key={win}
                    onClick={() => handleMAToggle(win)}
                    style={btnStyle(maWindow === win)}
                  >
                    {label}
                  </button>
                ))}

                {/* Botón de info */}
                <button
                  ref={infoRef}
                  onMouseEnter={() => {
                    if (infoRef.current) {
                      const rect = infoRef.current.getBoundingClientRect();
                      setInfoPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                    }
                    setShowMAInfo(true);
                  }}
                  onMouseLeave={() => setShowMAInfo(false)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    cursor: 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    lineHeight: 1,
                    marginLeft: '2px',
                  }}
                >
                  ?
                </button>

                {/* Popover de explicación */}
                {showMAInfo && (
                  <div style={{
                    position: 'fixed',
                    top: `${infoPos.top}px`,
                    right: `${infoPos.right}px`,
                    width: '280px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '0.85rem 1rem',
                    zIndex: 9999,
                    pointerEvents: 'none',
                  }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                      Promedio Móvil (PM)
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>3M — </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Promedio de los últimos 3 meses. Reduce el ruido mensual conservando el detalle de corto plazo.
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>6M — </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Promedio de los últimos 6 meses. Elimina la variación estacional semestral y muestra la tendencia media.
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>Suavizado — </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          Promedio anual de 12 meses. Elimina la estacionalidad y revela la tendencia estructural de largo plazo.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Separador visual */}
              <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

              <ExportMenu
                elementRef={cardRef}
                imageFilename={isVictimasBase ? "historico_victimas.png" : "historico_incidencia.png"}
                onDownloadCSV={handleDownloadCSV}
                onCopyTable={handleCopyData}
              />
            </div>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {/* Fila 1: Título y Acciones */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '0.2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0 }}>
              {chartTitle}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ExportMenu
                elementRef={cardRef}
                imageFilename={isVictimasBase ? "historico_victimas.png" : "historico_incidencia.png"}
                onDownloadCSV={handleDownloadCSV}
                onCopyTable={handleCopyData}
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
          </div>

          {/* Fila 2: Toggles de filtros/promedios */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Toggles estadísticos */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {toggleButtons.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => handleToggle(btn.key)}
                  style={btnStyle(activeToggles[btn.key])}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Separador visual */}
            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

            {/* Botones de Promedio Móvil + Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', position: 'relative' }}>
              {maButtons.map(({ win, label }) => (
                <button
                  key={win}
                  onClick={() => handleMAToggle(win)}
                  style={btnStyle(maWindow === win)}
                >
                  {label}
                </button>
              ))}

              {/* Botón de info */}
              <button
                ref={infoRef}
                onMouseEnter={() => {
                  if (infoRef.current) {
                    const rect = infoRef.current.getBoundingClientRect();
                    setInfoPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  }
                  setShowMAInfo(true);
                }}
                onMouseLeave={() => setShowMAInfo(false)}
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  cursor: 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  lineHeight: 1,
                  marginLeft: '2px',
                }}
              >
                ?
              </button>

              {/* Popover de explicación */}
              {showMAInfo && (
                <div style={{
                  position: 'fixed',
                  top: `${infoPos.top}px`,
                  right: `${infoPos.right}px`,
                  width: '280px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.85rem 1rem',
                  zIndex: 9999,
                  pointerEvents: 'none',
                }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.5rem' }}>
                    Promedio Móvil (PM)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>3M — </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Promedio de los últimos 3 meses. Reduce el ruido mensual conservando el detalle de corto plazo.
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>6M — </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Promedio de los últimos 6 meses. Elimina la variación estacional semestral y muestra la tendencia media.
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>Suavizado — </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Promedio anual de 12 meses. Elimina la estacionalidad y revela la tendencia estructural de largo plazo.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '120px' }}>
        {loading && <LoadingSpinner size="md" />}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayData}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              ticks={displayData.length <= 24 ? undefined : displayData
                .filter((d, i, arr) => i === arr.findIndex(x => x.year === d.year))
                .map(d => d.name)}
              tickFormatter={(name) => {
                if (displayData.length <= 24) return name.replace(' ', '-');
                const parts = name.split(' ');
                return parts[parts.length - 1];
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
              width={52}
              tickFormatter={(val) => {
                if (metricType === 'rate') return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
                if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
                return val;
              }}
            />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
              formatter={(value, name) => {
                if (name === 'value') return [formatValue(value), tooltipLabel];
                if (name === 'maValue') return [formatValue(value), maLabel];
                if (name === 'trendValue') return [formatValue(value), 'Tendencia'];
                return [formatValue(value), name];
              }}
            />

            {/* Serie original — se atenúa cuando el MA está activo */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-accent)"
              strokeWidth={maWindow ? 1.5 : 3}
              strokeOpacity={originalOpacity}
              fillOpacity={originalFillOpacity}
              fill="url(#colorValue)"
              activeDot={maWindow ? false : { r: 6, fill: 'var(--color-accent)', stroke: 'white', strokeWidth: 2 }}
            />

            {/* Línea de Promedio Móvil */}
            {maWindow && (
              <Line
                type="monotone"
                dataKey="maValue"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--color-accent)', stroke: 'white', strokeWidth: 2 }}
                connectNulls={false}
                name="maValue"
              />
            )}

            {/* Promedio global */}
            {activeToggles.promedio && averageValue > 0 && (
              <ReferenceLine
                y={averageValue}
                stroke="#64748b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `Promedio: ${formatValue(averageValue)}`,
                  position: 'top',
                  fill: 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 600
                }}
              />
            )}

            {/* Máximo */}
            {activeToggles.maximo && maxItem && (
              <>
                <ReferenceLine
                  y={maxItem.numericVal}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <ReferenceDot
                  x={maxItem.name}
                  y={maxItem.numericVal}
                  r={5}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={1.5}
                  label={{
                    value: `Máx: ${formatValue(maxItem.numericVal)} (${maxItem.name})`,
                    position: 'top',
                    fill: '#ef4444',
                    fontSize: 9,
                    fontWeight: 700
                  }}
                />
              </>
            )}

            {/* Mínimo */}
            {activeToggles.minimo && minItem && (
              <>
                <ReferenceLine
                  y={minItem.numericVal}
                  stroke="#22c55e"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <ReferenceDot
                  x={minItem.name}
                  y={minItem.numericVal}
                  r={5}
                  fill="#22c55e"
                  stroke="white"
                  strokeWidth={1.5}
                  label={{
                    value: `Mín: ${formatValue(minItem.numericVal)} (${minItem.name})`,
                    position: 'bottom',
                    fill: '#22c55e',
                    fontSize: 9,
                    fontWeight: 700
                  }}
                />
              </>
            )}

            {/* Tendencia lineal */}
            {activeToggles.tendencia && (
              <Line
                type="monotone"
                dataKey="trendValue"
                stroke={trendColor}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={false}
                name="trendValue"
              />
            )}

          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Slider de rango: actualiza la gráfica al soltar */}
      {data.length >= 5 && (
        <RangeSlider
          count={data.length}
          start={draftStart}
          end={draftEnd}
          names={data.map(d => d.name)}
          pending={isRangePending}
          onDraft={(s, e) => setDraftRange({ startIndex: s, endIndex: e })}
          onCommit={(s, e) => setBrushRange({ startIndex: s, endIndex: e })}
        />
      )}
    </div>
  );
};

export default ChartLineTrend;

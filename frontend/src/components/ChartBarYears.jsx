import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { chartTitle as buildTitle, monthsLabel } from '../utils/labels';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';
import DrillDownModal from './DrillDownModal';
import { useFullscreenScale, scaleSize } from '../utils/fullscreenScale';

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Selector de tamaño de letra (solo barras): compone con la escala fullscreen.
// Se persiste en localStorage para que sobreviva recargas.
const FONT_BOOST_KEY = 'barChartFontScale';
const FONT_OPTIONS = [
  { value: 0.85, label: 'Letra chica' },
  { value: 1, label: 'Letra normal' },
  { value: 1.3, label: 'Letra grande' }
];

const FontSizeSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const active = FONT_OPTIONS.find(o => o.value === value) || FONT_OPTIONS[1];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <button
        onClick={() => setIsOpen(v => !v)}
        title="Tamaño de letra de la gráfica"
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
        {active.label}
        <span style={{ fontSize: '0.6rem', color: 'var(--color-accent)' }}>▾</span>
      </button>
      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: '150px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '10px', boxShadow: 'var(--shadow-lg)', padding: '0.35rem', zIndex: 9999
          }}
        >
          {FONT_OPTIONS.map(o => {
            const selected = o.value === value;
            return (
              <button
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

const ChartBarYears = ({ selectedFilters, metricType, onInitialLoad }) => {
  const [data, setData] = useState([]);
  // true desde el inicio: antes de la primera respuesta no se muestra un "sin datos" falso
  const [loading, setLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [drillModal, setDrillModal] = useState(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const initialLoadCalled = useRef(false);
  const cardRef = useRef(null);
  const chartWrapRef = useRef(null);
  const [chartW, setChartW] = useState(0);

  // Ancho real del área de la gráfica: decide si las etiquetas completas caben o se escalonan
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setChartW(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullScreen]);

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
  const isVictimasBase = isVictimas || isVictimasMun;
  const isAltoImpacto = dataset === 'alto_impacto';

    const params = new URLSearchParams();
    params.append("dataset", isAltoImpacto ? "delitos" : dataset);
    params.append("metric_type", metricType);
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      params.append("altoImpacto", ai.join('|'));
    }
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
    if (selectedFilters.meses && selectedFilters.meses.length > 0) params.append("meses", selectedFilters.meses.join(','));

    const endpoint = isVictimasMun ? "api/incidencia_por_mes_historico" : "api/incidencia_por_anio";
    axios.get(`${API_URL}/${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        setError(false);
        if (res.data) {
          // Año parcial: su último mes con datos no alcanza el último mes del periodo pedido
          const selMeses = (selectedFilters.meses || []).map(m => MESES_LARGOS.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b);
          const mesInicio = selMeses.length ? selMeses[0] : 0;
          const mesFinEsperado = selMeses.length ? selMeses[selMeses.length - 1] + 1 : 12;
          const formatted = res.data.map(d => {
            const partial = !isVictimasMun && typeof d.mes_final === 'number' && d.mes_final < mesFinEsperado;
            return {
              ...d,
              label: isVictimasMun ? d.name : d.year,
              partial,
              periodo: partial ? `${MESES_CORTOS[mesInicio]}–${MESES_CORTOS[d.mes_final - 1]}` : null
            };
          });
          setData(formatted);
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return; // petición cancelada, ignorar
        console.error("Error fetching incidencia por anio", err);
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

  const dataset = selectedFilters?.dataset || 'delitos';
  const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';
  const isVictimasBase = isVictimas || isVictimasMun;
  const isAltoImpacto = dataset === 'alto_impacto';

  const formatValue = (val) => {
    if (val === 'N/D' || val === undefined || val === null) return 'N/D';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return 'N/D';
    if (metricType === 'rate') {
      return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    }
    return new Intl.NumberFormat('es-MX').format(num);
  };

  const getExportData = () => {
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const actualValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const headers = [isVictimasMun ? "Mes" : "Año", actualValLabel];
    const dataForExport = data.map(d => [d.label, d.value]);
    return { headers, dataForExport };
  };

  const handleDownloadCSV = () => {
    const { headers, dataForExport } = getExportData();
    downloadCSV(isVictimasMun ? "victimas_por_mes.csv" : (isVictimasBase ? "victimas_por_anio.csv" : (isAltoImpacto ? "alto_impacto_por_anio.csv" : "incidencia_por_anio.csv")), dataForExport, headers, { ...selectedFilters, metricType });
  };

  const handleCopyData = () => {
    const { headers, dataForExport } = getExportData();
    copyTableToClipboard(dataForExport, headers);
  };

  // Drill-down: clic en una barra anual o mensual → desglose por subtipo de delito
  const handleBarClick = async (barData) => {
    if (!barData) return;
    const rawYear = barData.year || (barData.label ? String(barData.label).slice(-4) : null);
    if (!rawYear) return;

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthName = isVictimasMun && barData.month ? monthNames[barData.month - 1] : null;
    const periodDisplay = isVictimasMun ? barData.label : rawYear;

    setDrillModal({ title: `Periodo ${periodDisplay}`, data: null, loading: true });
    try {
      const params = new URLSearchParams();
      params.append('categoria', 'subtipo_delito');
      params.append('dataset', isAltoImpacto ? 'delitos' : dataset);
      params.append('metric_type', metricType);
      params.append('anio', rawYear);
      if (isAltoImpacto) {
        const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
        params.append('altoImpacto', ai.join('|'));
      }

      if (monthName) {
        params.append('meses', monthName);
      } else if (selectedFilters.meses && selectedFilters.meses.length > 0) {
        params.append('meses', selectedFilters.meses.join(','));
      }

      if (selectedFilters.entidad && selectedFilters.entidad !== 'All') params.append('entidad', selectedFilters.entidad);
      if (!isVictimas && selectedFilters.municipio && selectedFilters.municipio !== 'All') params.append('municipio', selectedFilters.municipio);
      const bj = Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : [];
      const td = Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : [];
      const sd = Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : [];
      const mo = Array.isArray(selectedFilters.modalidad) ? selectedFilters.modalidad : [];
      const sx = Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : [];
      const re = Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : [];
      if (bj.length > 0) params.append('bienJuridico', bj.join('|'));
      if (td.length > 0) params.append('tipoDelito', td.join('|'));
      if (sd.length > 0) params.append('subtipoDelito', sd.join('|'));
      if (mo.length > 0) params.append('modalidad', mo.join('|'));
      if (sx.length > 0) params.append('sexo', sx.join('|'));
      if (re.length > 0) params.append('rangoEdad', re.join('|'));

      const res = await axios.get(`${API_URL}/api/incidencia_por_delito?${params.toString()}`);
      const rawData = res.data || [];
      const mappedData = rawData.map(d => ({
        name: d.name,
        value: typeof d.value === 'number' ? d.value : (parseFloat(d.value) || 0),
        rank: d.id,
      }));
      const dataLabel = isVictimasBase ? 'Víctimas' : 'Delitos';
      const locationLabel = selectedFilters.entidad && selectedFilters.entidad !== 'All'
        ? selectedFilters.entidad : 'Nacional';
      setDrillModal({
        title: `Subtipo de delito · ${periodDisplay}`,
        subtitle: `${dataLabel} · ${locationLabel}`,
        data: mappedData,
        loading: false,
        valueLabel: dataLabel,
        showRank: true,
        showPct: true,
      });
    } catch (err) {
      console.error('Error fetching bar drill-down', err);
      setDrillModal(prev => ({ ...prev, loading: false, data: [] }));
    }
  };

  const chartTitle = buildTitle(dataset, metricType, isVictimasMun ? 'por mes' : 'por año');

  const tooltipLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';

  // Factor de escala fullscreen (1 en vista normal): tipografías y márgenes crecen con la ventana
  const fsScale = useFullscreenScale(isFullScreen);
  const F = (base) => scaleSize(base, fsScale);

  // Multiplicador de letra elegido por el usuario (persiste en localStorage)
  const [fontBoost, setFontBoost] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(FONT_BOOST_KEY));
      return FONT_OPTIONS.some(o => o.value === v) ? v : 1;
    } catch {
      return 1;
    }
  });
  const handleFontBoost = (v) => {
    setFontBoost(v);
    try { localStorage.setItem(FONT_BOOST_KEY, String(v)); } catch { /* noop */ }
  };
  // El multiplicador de letra solo rige en fullscreen; la vista normal queda intacta
  const FF = (base) => (isFullScreen ? Math.max(1, Math.round(F(base) * fontBoost)) : F(base));

  // Etiquetas siempre con la cifra completa. Si la más larga no cabe en el espacio de un año
  // (barra + separación), se reparten en N renglones fijos sobre el área de barras
  // (etiqueta i en el renglón i % N), así no chocan aunque las barras vecinas sean más altas.
  const LABEL_FS = FF(13);
  const LABEL_STEP = LABEL_FS + 4;
  const MAX_LABEL_ROWS = 4;
  const n = data.length;
  const maxLabelW = data.reduce((mx, d) => Math.max(mx, String(formatValue(d.value)).length * LABEL_FS * 0.6), 0);
  const baseSide = FF(10);
  const slotFor = (side) => (n > 0 && chartW > 0 ? (chartW - side * 2) / n : Infinity);
  const fitsInline = maxLabelW <= slotFor(baseSide) - 4;
  // Margen lateral para que la primera y la última etiqueta no se corten. Se resuelve
  // analíticamente porque el espacio por año depende del propio margen:
  // side = (maxLabelW - slot)/2 + 4, con slot = (chartW - 2·side)/n.
  const chartSide = fitsInline || n < 2
    ? baseSide
    : Math.max(baseSide, Math.ceil((maxLabelW - chartW / n + 8) / (2 * (1 - 1 / n))));
  const slotW = slotFor(chartSide);
  const labelRows = fitsInline
    ? 1
    : Math.min(MAX_LABEL_ROWS, Math.max(2, Math.ceil((maxLabelW + 4) / slotW)));
  const staggerLabels = labelRows > 1;
  const chartTop = F(30) + (labelRows - 1) * LABEL_STEP;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FontSizeSelect value={fontBoost} onChange={handleFontBoost} />
              <ExportMenu
                elementRef={cardRef}
                imageFilename={isVictimasMun ? "victimas_por_mes.png" : (isVictimasBase ? "victimas_por_anio.png" : "incidencia_por_anio.png")}
                onDownloadCSV={handleDownloadCSV}
                onCopyTable={handleCopyData}
              />
            </div>
          }
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingRight: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0 }}>
              {chartTitle}
            </h2>
            {/* Con meses filtrados cada barra suma solo esos meses: se declara (el año parcial ya se marca en su barra) */}
            {!isVictimasMun && monthsLabel(selectedFilters?.meses) && (
              <div className="card-period">Solo {monthsLabel(selectedFilters.meses)} de cada año</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              elementRef={cardRef}
              imageFilename={isVictimasMun ? "victimas_por_mes.png" : (isVictimasBase ? "victimas_por_anio.png" : "incidencia_por_anio.png")}
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
      )}

      <div ref={chartWrapRef} style={{ flex: 1, position: 'relative', width: '100%', minHeight: '120px' }}>
        {loading && <LoadingSpinner size="md" />}
        {!loading && error && <EmptyState variant="error" onRetry={() => setRetryKey(k => k + 1)} />}
        {!loading && !error && data.length === 0 && <EmptyState />}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: chartTop, right: chartSide, left: chartSide, bottom: FF(6) }}
            barCategoryGap="6%"
          >
            <defs>
              <linearGradient id="colorBarYears" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis
              dataKey="label"
              tick={(props) => {
                const { x, y, payload, index } = props;
                const entry = data[index];
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text dy={FF(10)} textAnchor="middle" fontSize={FF(13)} fill="var(--text-secondary)">
                      {/* Si el año completo no cabe en su espacio, se abrevia ('15) para no encimar el eje */}
                      {/^[0-9]{4}$/.test(String(payload.value)) && slotW < 4 * FF(13) * 0.6 + 6
                        ? `’${String(payload.value).slice(2)}`
                        : payload.value}
                    </text>
                    {entry?.partial && (
                      <text dy={FF(24)} textAnchor="middle" fontSize={FF(11)} fontWeight="600" fill="var(--color-accent)">{entry.periodo}</text>
                    )}
                  </g>
                );
              }}
              height={data.some(d => d.partial) ? FF(40) : FF(26)}
              axisLine={false}
              tickLine={false}
              tickMargin={FF(6)}
              minTickGap={-200}
            />
            <YAxis hide={true} />
            <Tooltip
              cursor={{ fill: 'var(--bg-main)' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)', fontSize: FF(12) }}
              formatter={(value, _name, item) => [formatValue(value), item?.payload?.partial ? `${tooltipLabel} (${item.payload.periodo}, año parcial)` : tooltipLabel]}
            />
            <Bar dataKey="value" radius={[F(6), F(6), 0, 0]} fill="url(#colorBarYears)"
              onClick={handleBarClick}
              style={{ cursor: 'pointer' }}
            >
              <LabelList
                dataKey="value"
                position="top"
                content={(props) => {
                  const { x, y, width, value, index } = props;
                  const fs = LABEL_FS;
                  const text = formatValue(value);
                  const labelY = staggerLabels
                    ? chartTop - FF(8) - (index % labelRows) * LABEL_STEP
                    : y - FF(8);
                  return (
                    <text
                      x={x + width / 2}
                      y={labelY}
                      fill="var(--text-primary)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs}
                      fontWeight="700"
                    >
                      {text}
                    </text>
                  );
                }}
              />
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="url(#colorBarYears)"
                  fillOpacity={entry.partial ? 0.4 : 1}
                  stroke={entry.partial ? 'var(--color-accent)' : 'none'}
                  strokeDasharray={entry.partial ? '4 3' : undefined}
                  strokeWidth={entry.partial ? 1.5 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {drillModal && (
        <DrillDownModal
          title={drillModal.title}
          subtitle={drillModal.subtitle}
          data={drillModal.data}
          loading={drillModal.loading}
          onClose={() => setDrillModal(null)}
          valueLabel={drillModal.valueLabel || tooltipLabel}
          showRank={drillModal.showRank || false}
          showPct={drillModal.showPct || false}
        />
      )}
    </div>
  );
};

export default ChartBarYears;

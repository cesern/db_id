import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV } from '../utils/exportUtils';
import DrillDownModal from './DrillDownModal';

const ChartBarYears = ({ selectedFilters, metricType, onInitialLoad }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [drillModal, setDrillModal] = useState(null);

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
  const isVictimasBase = isVictimas || isVictimasMun;

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
    if (selectedFilters.meses && selectedFilters.meses.length > 0) params.append("meses", selectedFilters.meses.join(','));

    const endpoint = isVictimasMun ? "api/incidencia_por_mes_historico" : "api/incidencia_por_anio";
    axios.get(`${API_URL}/${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (res.data) {
          const formatted = res.data.map(d => ({
            ...d,
            label: isVictimasMun ? d.name : d.year
          }));
          setData(formatted);
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return; // petición cancelada, ignorar
        console.error("Error fetching incidencia por anio", err);
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

  const formatCompactValue = (val) => {
    if (val === 'N/D' || val === undefined || val === null) return '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '';
    if (metricType === 'rate') {
      return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(num);
    }
    return new Intl.NumberFormat('es-MX', { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 }).format(num);
  };

  const handleDownloadCSV = () => {
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const actualValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const headers = [isVictimasMun ? "Mes" : "Año", actualValLabel];
    const dataForExport = data.map(d => [d.label, d.value]);
    downloadCSV(isVictimasMun ? "victimas_por_mes.csv" : (isVictimasBase ? "victimas_por_anio.csv" : "incidencia_por_anio.csv"), dataForExport, headers, { ...selectedFilters, metricType });
  };

  // Drill-down: clic en una barra anual → desglose por subtipo de delito
  const handleBarClick = async (barData) => {
    if (isVictimasMun || !barData) return; // solo barras anuales
    const year = barData.year || String(barData.label);
    if (!year) return;
    setDrillModal({ title: `Año ${year}`, data: null, loading: true });
    try {
      const params = new URLSearchParams();
      params.append('categoria', 'subtipo_delito');
      params.append('dataset', dataset);
      params.append('metric_type', metricType);
      params.append('anio', year);
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
      if (selectedFilters.meses && selectedFilters.meses.length > 0) params.append('meses', selectedFilters.meses.join(','));
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
        title: `Subtipo de delito · ${year}`,
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

  const chartTitle = isVictimasMun 
    ? (metricType === 'rate' ? 'Tasa de víctimas por mes' : 'Víctimas por mes')
    : isVictimasBase 
      ? (metricType === 'rate' ? 'Tasa de víctimas por año' : 'Víctimas por año') 
      : (metricType === 'rate' ? 'Tasa de incidencia por año' : 'Incidencia por año');

  const tooltipLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';

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
            <ExportMenu
              elementRef={cardRef}
              imageFilename={isVictimasMun ? "victimas_por_mes.png" : (isVictimasBase ? "victimas_por_anio.png" : "incidencia_por_anio.png")}
              onDownloadCSV={handleDownloadCSV}
            />
          }
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingRight: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0 }}>
            {chartTitle}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              elementRef={cardRef}
              imageFilename={isVictimasMun ? "victimas_por_mes.png" : (isVictimasBase ? "victimas_por_anio.png" : "incidencia_por_anio.png")}
              onDownloadCSV={handleDownloadCSV}
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
      )}

      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '120px' }}>
        {loading && <LoadingSpinner size="md" />}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 30, right: 10, left: 0, bottom: 20 }}
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
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={-200}
            />
            <YAxis hide={true} />
            <Tooltip
              cursor={{ fill: 'var(--bg-main)' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
              formatter={(value) => [formatValue(value), tooltipLabel]}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#colorBarYears)"
              onClick={!isVictimasMun ? handleBarClick : undefined}
              style={{ cursor: !isVictimasMun ? 'pointer' : 'default' }}
            >
              <LabelList
                dataKey="value"
                position="top"
                content={(props) => {
                  const { x, y, width, value, index } = props;
                  // Si la barra es muy delgada, saltamos las etiquetas impares
                  if (width < 45 && index % 2 !== 0) return null;
                  return (
                    <text 
                      x={x + width / 2} 
                      y={y - 8} 
                      fill="var(--text-primary)" 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      fontSize="10" 
                      fontWeight="700"
                    >
                      {formatValue(value)}
                    </text>
                  );
                }}
              />
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="url(#colorBarYears)" />
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

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import ExportMenu from './ExportMenu';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';

const TableTopCrimes = ({ selectedFilters, metricType, onInitialLoad }) => {
  const [data, setData] = useState([]);
  const [category, setCategory] = useState('tipo_delito'); // 'bien_juridico' | 'tipo_delito' | 'subtipo_delito'
  const [loading, setLoading] = useState(false);

  const initialLoadCalled = useRef(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!selectedFilters) return;

    const controller = new AbortController();
    setLoading(true);

    const dataset = selectedFilters.dataset || 'delitos';
    const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';
  const isVictimasBase = isVictimas || isVictimasMun;

    const params = new URLSearchParams();
    params.append("categoria", category);
    params.append("dataset", dataset);
    params.append("metric_type", metricType);
    if (selectedFilters.anio) params.append("anio", selectedFilters.anio);
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

    axios.get(`${API_URL}/api/incidencia_por_delito?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (res.data) {
          setData(res.data);
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error fetching top crimes data", err);
      })
      .finally(() => {
        setLoading(false);
        if (onInitialLoad && !initialLoadCalled.current) {
          initialLoadCalled.current = true;
          onInitialLoad();
        }
      });

    return () => controller.abort();
  }, [selectedFilters, category, metricType]);

  const dataset = selectedFilters?.dataset || 'delitos';
  const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';
  const isVictimasBase = isVictimas || isVictimasMun;

  const categories = [
    { key: 'bien_juridico', label: 'Bien Jurídico' },
    { key: 'tipo_delito', label: 'Tipo' },
    { key: 'subtipo_delito', label: 'Subtipo' }
  ];

  const formatValue = (val) => {
    if (metricType === 'rate') {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('en-US');
  };

  const handleDownloadCSV = () => {
    const activeCategory = categories.find(c => c.key === category)?.label || "Categoría";
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const csvValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const headers = ["Rank", activeCategory, csvValLabel];
    const dataForExport = data.map(d => [d.id, d.name, d.value]);
    const filename = isVictimasBase ? `top_victimas_${category}.csv` : `top_delitos_${category}.csv`;
    downloadCSV(filename, dataForExport, headers, { ...selectedFilters, metricType });
  };

  const handleCopy = () => {
    const activeCategory = categories.find(c => c.key === category)?.label || "Categoría";
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const csvValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const headers = ["Rank", activeCategory, csvValLabel];
    const dataForExport = data.map(d => [d.id, d.name, d.value]);
    copyTableToClipboard(dataForExport, headers);
  };

  const cardTitle = isVictimasBase 
    ? (metricType === 'rate' ? 'Tasa de víctimas de mayor incidencia' : 'Víctimas de mayor incidencia') 
    : (metricType === 'rate' ? 'Tasa de delitos de mayor incidencia' : 'Delitos de mayor incidencia');

  const baseValLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';
  const valLabel = metricType === 'rate' ? `${baseValLabel} (Tasa)` : baseValLabel;

  return (
    <div ref={cardRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {loading && <LoadingSpinner size="md" />}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingRight: '0.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0 }}>
          {cardTitle}
        </h3>
        <ExportMenu
          elementRef={cardRef}
          imageFilename={isVictimasBase ? "victimas_mayor_incidencia.png" : "delitos_mayor_incidencia.png"}
          onDownloadCSV={handleDownloadCSV}
          onCopyTable={handleCopy}
          isTable={true}
        />
      </div>
      {/* Segmented Control */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--color-accent-light, #f0f4ff)',
          borderRadius: '10px',
          padding: '3px',
          gap: '2px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {categories.map((cat) => {
            const active = category === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                style={{
                  flex: 1,
                  padding: '0.4rem 0',
                  fontSize: '0.75rem',
                  fontWeight: active ? 700 : 500,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease',
                  background: active ? 'var(--color-accent, #2563eb)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary, #64748b)',
                  boxShadow: active ? '0 2px 8px rgba(37,99,235,0.18)' : 'none',
                  letterSpacing: '0.01em',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left', width: '30px' }}>#</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Nombre</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>{valLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((crime) => (
              <tr key={`${category}-${crime.name}-${crime.id}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {crime.id}
                </td>
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                  {crime.name}
                </td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {formatValue(crime.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {data.length === 0 && !loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '80px',
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
          }}>
            Sin datos disponibles
          </div>
        )}
      </div>
    </div>
  );
};

export default TableTopCrimes;

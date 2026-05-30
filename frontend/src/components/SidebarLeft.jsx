import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';

const SidebarLeft = ({ selectedFilters, metricType, onInitialLoad }) => {
  const [totalIncidencia, setTotalIncidencia] = useState(0);
  const [entidades, setEntidades] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [tableView, setTableView] = useState('entidades'); // 'entidades' | 'municipios'
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const initialLoadCalled = useRef(false);
  const tableCardRef = useRef(null);

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

    const params = { dataset };
    params.anio = selectedFilters.anio;
    params.metric_type = metricType;
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

  const formatNumber = (num) => {
    if (num === 'N/D' || num === undefined || num === null) return 'N/D';
    const val = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(val)) return 'N/D';
    if (metricType === 'rate') {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('en-US');
  };

  // Determinar la entidad activa a mostrar en el KPI card
  const activeEntityName = (!selectedFilters?.entidad || selectedFilters.entidad === 'All')
    ? 'Sonora'
    : selectedFilters.entidad;

  const activeEntityData = entidades.find(e => e.name === activeEntityName);
  const activeEntityRank = activeEntityData ? `#${activeEntityData.id}` : 'N/A';
  const activeIncidenceLabel = (selectedFilters?.municipio && selectedFilters.municipio !== 'All')
    ? selectedFilters.municipio
    : (isVictimasBase ? 'Víctimas' : 'Incidencia');

  const isEntidades = tableView === 'entidades' || isVictimas;
  const rows = isEntidades ? entidades : municipios;
  const colLabel = isEntidades ? 'Entidad' : 'Municipio';
  
  const baseValLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';
  const valLabel = metricType === 'rate' ? `${baseValLabel} (Tasa)` : baseValLabel;

  const getExportFilename = (ext) => {
    if (isVictimas) return `tabla_victimas_entidad.${ext}`;
    if (isVictimasMun) return `tabla_victimas_mun_${tableView}.${ext}`;
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
          title={isVictimas ? "Víctimas por Entidad" : `Ranking de Incidencia por ${tableView === 'entidades' ? 'Entidad' : 'Municipio'}`}
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
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px', gap: '1rem', fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.95rem' }}>
              <span>#</span>
              <span>{colLabel}</span>
              <span style={{ textAlign: 'right' }}>{valLabel}</span>
            </div>
          </div>

          {/* Table Rows */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
            {rows.map((m, i) => {
              const isSonora = isEntidades
                ? m.name === 'Sonora'
                : m.entidad === 'Sonora';

              return (
                <div
                  key={`${tableView}-${m.name}-${m.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 120px',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    backgroundColor: isSonora
                      ? 'var(--color-accent)'
                      : (i % 2 === 0 ? 'white' : 'var(--color-accent-light)'),
                    color: isSonora ? 'white' : 'var(--color-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    fontWeight: isSonora ? 'bold' : 'normal',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <span style={{ color: isSonora ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', fontWeight: isSonora ? 700 : 500 }}>
                    {m.id}
                  </span>
                  <span style={{ fontWeight: isSonora ? 700 : 500 }}>
                    {m.name}
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: isSonora ? 700 : 600 }}>
                    {formatNumber(m.value)}
                  </span>
                </div>
              );
            })}

            {rows.length === 0 && !loading && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '150px',
                color: 'var(--text-secondary)',
                fontSize: '0.95rem',
              }}>
                Sin datos disponibles
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative' }}>
          {loading && <LoadingSpinner size="sm" />}
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{activeIncidenceLabel}</span>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '0.25rem' }}>{formatNumber(totalIncidencia)}</span>
        </div>
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative' }}>
          {loading && <LoadingSpinner size="sm" />}
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{activeEntityName}</span>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)', marginTop: '0.25rem' }}>{activeEntityRank}</span>
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

        {/* Table Header */}
        <div style={{ padding: isVictimas ? '1rem 1rem 0.5rem' : '0 1rem 0.5rem', borderBottom: '2px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px', gap: '0.5rem', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.875rem' }}>
            <span>#</span>
            <span style={{ transition: 'opacity 0.2s' }}>{colLabel}</span>
            <span style={{ textAlign: 'right' }}>{valLabel}</span>
          </div>
        </div>

        {/* Table Rows */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
          {rows.map((m, i) => {
            const isSonora = isEntidades
              ? m.name === 'Sonora'
              : m.entidad === 'Sonora';

            return (
              <div
                key={`${tableView}-${m.name}-${m.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1fr 80px',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  backgroundColor: isSonora
                    ? 'var(--color-accent)'
                    : (i % 2 === 0 ? 'white' : 'var(--color-accent-light)'),
                  color: isSonora ? 'white' : 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontWeight: isSonora ? 'bold' : 'normal',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span style={{ color: isSonora ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', fontWeight: isSonora ? 700 : 500 }}>
                  {m.id}
                </span>
                <span style={{ fontWeight: isSonora ? 700 : 500 }}>
                  {m.name}
                </span>
                <span style={{ textAlign: 'right', fontWeight: isSonora ? 700 : 600 }}>
                  {formatNumber(m.value)}
                </span>
              </div>
            );
          })}

          {rows.length === 0 && !loading && (
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
    </>
  );
};

export default SidebarLeft;

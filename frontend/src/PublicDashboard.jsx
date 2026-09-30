import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from './api';
import Header from './components/Header';
import Filters from './components/Filters';
import SidebarLeft from './components/SidebarLeft';
import ChartBarYears from './components/ChartBarYears';
import ChartLineTrend from './components/ChartLineTrend';
import MapMexico from './components/MapMexico';
import HistoryRankings from './components/HistoryRankings';
import { MesFinalContext } from './utils/mesFinalContext';

const DATASET_COLORS = {
  delitos: "#455993",
  victimas: "#ef4444",
  victimas_mun: "#7c3aed",
  alto_impacto: "#b91c1c"
};

// anio: null hasta conocer el año más reciente con datos (ver efecto de año inicial)
const INITIAL_FILTERS = {
  dataset: "delitos",
  anio: null,
  entidad: "Sonora",
  municipio: "All",
  bienJuridico: [],
  tipoDelito: [],
  subtipoDelito: [],
  modalidad: [],
  meses: [],
  sexo: [],
  rangoEdad: [],
  altoImpacto: []
};

// Cápsulas predeterminadas de la sección Delitos Alto Impacto (nombres = backend PRESET_ALTO_IMPACTO)
const ALTO_IMPACTO_DEFAULT = [
  "Homicidio doloso",
  "Feminicidio",
  "Secuestro",
  "Extorsión",
  "Robo de vehículo",
  "Robo con violencia",
  "Violación"
];

function PublicDashboard() {
  const [metricType, setMetricType] = useState('absolute');
  const [activeTab, setActiveTab] = useState('dashboard');
  // Panel de filtros abierto: la cuadrícula conserva el alto que tiene con el panel plegado y la página
  // se desplaza (en escritorio alto, las gráficas no se aplastan). Ver [data-filters-open] en index.css.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const appRef = useRef(null);
  const gridRef = useRef(null);
  // Último mes con datos del año aplicado. SidebarLeft lo reporta como { dataset, anio, mesFinal };
  // solo vale si coincide con lo aplicado (si no, undefined = desconocido, nunca "sin publicar")
  const [mesFinalInfo, setMesFinalInfo] = useState(null);

  // Estado de carga inicial y animación
  const [initialLoading, setInitialLoading] = useState(true);
  const [fadeLoading, setFadeLoading] = useState(false);

  // Rastrear qué componentes ya completaron su carga inicial
  const [componentsLoading, setComponentsLoading] = useState({
    filters: true,
    sidebar: true,
    barChart: true,
    lineChart: true,
    map: true
  });

  // selectedFilters: lo que el usuario ve/modifica en tiempo real en la barra de filtros
  const [selectedFilters, setSelectedFilters] = useState(INITIAL_FILTERS);

  // appliedFilters: los filtros que realmente usan los componentes de datos para sus peticiones.
  // Solo se actualiza cuando el usuario presiona "Aplicar Filtros".
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);

  // Cápsulas personalizadas (CUSTOM:...) creadas en alto_impacto; persisten al cambiar de dataset
  const [customCapsules, setCustomCapsules] = useState([]);

  // Año inicial = año más reciente disponible en delitos (fallback: año en curso)
  useEffect(() => {
    const controller = new AbortController();
    const setAnio = (anio) => {
      setSelectedFilters(prev => (prev.anio === null ? { ...prev, anio } : prev));
      setAppliedFilters(prev => (prev.anio === null ? { ...prev, anio } : prev));
    };
    axios.get(`${API_URL}/api/filtros`, { params: { dataset: 'delitos' }, signal: controller.signal })
      .then(res => {
        const anios = res.data?.anios || [];
        setAnio(anios.length > 0 ? Math.max(...anios) : new Date().getFullYear());
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error obteniendo año inicial", err);
        setAnio(new Date().getFullYear());
      });
    return () => controller.abort();
  }, []);

  // Mecanismo de seguridad: quitar pantalla de carga máximo en 10s pase lo que pase
  useEffect(() => {
    const timer = setTimeout(() => {
      handleInitialLoadComplete();
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleApply = () => {
    setAppliedFilters({ ...selectedFilters });
  };

  const handleClear = () => {
    const cleared = {
      dataset: selectedFilters.dataset,
      anio: selectedFilters.anio,
      entidad: 'Sonora',
      municipio: 'All',
      bienJuridico: [],
      tipoDelito: [],
      subtipoDelito: [],
      modalidad: [],
      meses: [],
      sexo: [],
      rangoEdad: [],
      altoImpacto: selectedFilters.dataset === 'alto_impacto'
        ? [...ALTO_IMPACTO_DEFAULT, ...customCapsules]
        : []
    };
    setSelectedFilters(cleared);
    setAppliedFilters(cleared);
  };

  const handleDatasetChange = (newDataset) => {
    setSelectedFilters(prev => {
      const next = {
        ...prev,
        dataset: newDataset,
        municipio: 'All',
        sexo: [],
        rangoEdad: [],
        bienJuridico: [],
        tipoDelito: [],
        subtipoDelito: [],
        modalidad: [],
        altoImpacto: newDataset === 'alto_impacto'
          ? [...ALTO_IMPACTO_DEFAULT, ...customCapsulesRef.current]
          : []
      };
      setAppliedFilters(next);
      return next;
    });
  };

  // Ref para usar customCapsules dentro del setState funcional de handleDatasetChange
  const customCapsulesRef = useRef(customCapsules);
  useEffect(() => { customCapsulesRef.current = customCapsules; }, [customCapsules]);

  // Alta de cápsula personalizada: activa de inmediato en selected y applied
  const handleAddCustomCapsule = (token) => {
    setCustomCapsules(prev => (prev.includes(token) ? prev : [...prev, token]));
    const add = (prev) => {
      const cur = Array.isArray(prev.altoImpacto) ? prev.altoImpacto : [];
      return cur.includes(token) ? prev : { ...prev, altoImpacto: [...cur, token] };
    };
    setSelectedFilters(add);
    setAppliedFilters(add);
  };

  // Baja de cápsula personalizada: se elimina de todo el estado de inmediato
  const handleRemoveCustomCapsule = (token) => {
    setCustomCapsules(prev => prev.filter(t => t !== token));
    const rm = (prev) => ({
      ...prev,
      altoImpacto: (Array.isArray(prev.altoImpacto) ? prev.altoImpacto : []).filter(t => t !== token)
    });
    setSelectedFilters(rm);
    setAppliedFilters(rm);
  };

  const handleInitialLoadComplete = () => {
    setFadeLoading(true);
    setTimeout(() => {
      setInitialLoading(false);
    }, 400); // Duración del fadeout
  };

  const handleComponentLoaded = (key) => {
    setComponentsLoading(prev => {
      const next = { ...prev, [key]: false };
      const allLoaded = Object.values(next).every(v => v === false);
      if (allLoaded) {
        handleInitialLoadComplete();
      }
      return next;
    });
  };

  // Alto ocupado arriba de la cuadrícula (encabezado + línea de filtros plegada), medido solo con el panel
  // plegado. Con el panel abierto la cuadrícula mide calc(100vh - --chrome-plegado): el mismo alto que plegado.
  const medirChrome = () => {
    const grid = gridRef.current;
    const app = appRef.current;
    if (!grid || !app) return;
    const chrome = grid.getBoundingClientRect().top - app.getBoundingClientRect().top;
    app.style.setProperty('--chrome-plegado', `${Math.round(chrome)}px`);
  };
  // Al abrir se mide una última vez con el panel aún plegado (por si la ventana cambió en este cuadro)
  const handleFiltersOpenChange = (open) => {
    if (open) medirChrome();
    setFiltersOpen(open);
  };
  useEffect(() => {
    if (filtersOpen || activeTab !== 'dashboard') return undefined;
    const medir = () => medirChrome();
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (ro && gridRef.current) ro.observe(gridRef.current);
    window.addEventListener('resize', medir);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [filtersOpen, activeTab, appliedFilters.anio]);

  const mesFinal = mesFinalInfo
    && mesFinalInfo.dataset === appliedFilters.dataset
    && String(mesFinalInfo.anio) === String(appliedFilters.anio)
    ? mesFinalInfo.mesFinal
    : undefined;

  return (
    <MesFinalContext.Provider value={mesFinal}>
    <div
      ref={appRef}
      className="app-container"
      data-filters-open={activeTab === 'dashboard' && filtersOpen ? 'true' : undefined}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      
      {/* Capa de cargando inicial (Loading overlay) */}
      {initialLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#081C3A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          opacity: fadeLoading ? 0 : 1,
          transition: 'opacity 0.4s ease-in-out',
          pointerEvents: fadeLoading ? 'none' : 'all',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', textAlign: 'center' }}>
            {/* Logo */}
            <img src="/logo.png" alt="Logo Institucional" style={{ height: '70px', objectFit: 'contain', marginBottom: '0.5rem' }} />
            
            {/* Spinner premium */}
            <div className="spinner-loading-screen" style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(200, 169, 107, 0.1)',
              borderTop: '4px solid #C8A96B',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#FFFFFF',
                fontFamily: '"Montserrat", "Inter", sans-serif',
                letterSpacing: '-0.02em',
                margin: 0
              }}>
                Incidencia Delictiva
              </h2>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.6)',
                fontWeight: 500,
                margin: 0
              }}>
                Cargando panel de análisis...
              </p>
            </div>
          </div>
          {/* El giro usa @keyframes spin de index.css */}
        </div>
      )}

      <Header 
        dataset={appliedFilters.dataset} 
        setDataset={handleDatasetChange} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === 'dashboard' ? (
        appliedFilters.anio === null ? null : (
        <>
          <Filters
            dataset={selectedFilters.dataset}
            metricType={metricType}
            setMetricType={setMetricType}
            selectedFilters={selectedFilters}
            setSelectedFilters={setSelectedFilters}
            appliedFilters={appliedFilters}
            onApply={handleApply}
            onClear={handleClear}
            onInitialLoadComplete={() => handleComponentLoaded('filters')}
            customCapsules={customCapsules}
            onAddCustomCapsule={handleAddCustomCapsule}
            onRemoveCustomCapsule={handleRemoveCustomCapsule}
            onOpenChange={handleFiltersOpenChange}
          />

          <main ref={gridRef} className="dashboard-grid">
            {/* Left Column */}
            <div className="dashboard-col">
              <SidebarLeft
                selectedFilters={appliedFilters}
                metricType={metricType}
                onInitialLoad={() => handleComponentLoaded('sidebar')}
                onMesFinal={setMesFinalInfo}
              />
            </div>

            {/* Center Column */}
            <div className="dashboard-col">
              <div className="card" style={{ flex: 1, minHeight: 'var(--chart-card-min-height, 300px)', display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)' }}>
                <ChartBarYears
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('barChart')}
                />
              </div>

              {/* flex en index.css (.trend-card): 1.25 en escritorio; en tablet/móvil crece con su contenido */}
              <div className="card trend-card" style={{ minHeight: 'var(--chart-trend-card-min-height, 250px)', display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)' }}>
                <ChartLineTrend
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('lineChart')}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="dashboard-col dashboard-col-map">
              <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)', height: '100%' }}>
                <MapMexico
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('map')}
                  mesFinal={mesFinal}
                />
              </div>
            </div>
          </main>
        </>
        )
      ) : (
        <HistoryRankings tempColor={DATASET_COLORS[appliedFilters.dataset] || "#455993"} />
      )}
    </div>
    </MesFinalContext.Provider>
  );
}

export default PublicDashboard;

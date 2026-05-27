import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Filters from './components/Filters';
import SidebarLeft from './components/SidebarLeft';
import ChartBarYears from './components/ChartBarYears';
import ChartLineTrend from './components/ChartLineTrend';
import MapMexico from './components/MapMexico';
import TableTopCrimes from './components/TableTopCrimes';
import HistoryRankings from './components/HistoryRankings';

const DATASET_COLORS = {
  delitos: "#455993",
  victimas: "#ef4444",
  victimas_mun: "#7c3aed"
};

const INITIAL_FILTERS = {
  dataset: "delitos",
  anio: 2026,
  entidad: "All",
  municipio: "All",
  bienJuridico: [],
  tipoDelito: [],
  subtipoDelito: [],
  modalidad: [],
  meses: [],
  sexo: [],
  rangoEdad: []
};

function PublicDashboard() {
  const [metricType, setMetricType] = useState('absolute');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Estado de carga inicial y animación
  const [initialLoading, setInitialLoading] = useState(true);
  const [fadeLoading, setFadeLoading] = useState(false);

  // Rastrear qué componentes ya completaron su carga inicial
  const [componentsLoading, setComponentsLoading] = useState({
    filters: true,
    sidebar: true,
    barChart: true,
    lineChart: true,
    map: true,
    topCrimes: false
  });

  // selectedFilters: lo que el usuario ve/modifica en tiempo real en la barra de filtros
  const [selectedFilters, setSelectedFilters] = useState(INITIAL_FILTERS);

  // appliedFilters: los filtros que realmente usan los componentes de datos para sus peticiones.
  // Solo se actualiza cuando el usuario presiona "Aplicar Filtros".
  const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);

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
      entidad: 'All',
      municipio: 'All',
      bienJuridico: [],
      tipoDelito: [],
      subtipoDelito: [],
      modalidad: [],
      meses: [],
      sexo: [],
      rangoEdad: []
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
        modalidad: []
      };
      setAppliedFilters(next);
      return next;
    });
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

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      
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
          
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <Header 
        dataset={appliedFilters.dataset} 
        setDataset={handleDatasetChange} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeTab === 'dashboard' ? (
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
          />

          <main className="dashboard-grid" style={{ flex: 1, minHeight: 0 }}>
            {/* Left Column */}
            <div className="dashboard-col">
              <SidebarLeft
                selectedFilters={appliedFilters}
                metricType={metricType}
                onInitialLoad={() => handleComponentLoaded('sidebar')}
              />
            </div>

            {/* Center Column */}
            <div className="dashboard-col">
              <div className="card" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                <ChartBarYears
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('barChart')}
                />
              </div>

              <div className="card" style={{ minHeight: '250px', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
                <ChartLineTrend
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('lineChart')}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="dashboard-col dashboard-col-map">
              <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', height: '100%' }}>
                <MapMexico
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('map')}
                />
              </div>
            </div>
          </main>
        </>
      ) : (
        <HistoryRankings tempColor={DATASET_COLORS[appliedFilters.dataset] || "#455993"} />
      )}
    </div>
  );
}

export default PublicDashboard;

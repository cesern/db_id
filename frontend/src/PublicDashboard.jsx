import React, { useState, useEffect, useRef } from 'react';
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
  victimas_mun: "#7c3aed",
  alto_impacto: "#b91c1c"
};

const INITIAL_FILTERS = {
  dataset: "delitos",
  anio: 2026,
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

  // Cápsulas personalizadas (CUSTOM:...) creadas en alto_impacto; persisten al cambiar de dataset
  const [customCapsules, setCustomCapsules] = useState([]);

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
            customCapsules={customCapsules}
            onAddCustomCapsule={handleAddCustomCapsule}
            onRemoveCustomCapsule={handleRemoveCustomCapsule}
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
              <div className="card" style={{ flex: 1, minHeight: 'var(--chart-card-min-height, 300px)', display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)' }}>
                <ChartBarYears
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={() => handleComponentLoaded('barChart')}
                />
              </div>

              <div className="card" style={{ flex: 1, minHeight: 'var(--chart-trend-card-min-height, 250px)', display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)' }}>
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

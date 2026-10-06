import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
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
  // se desplaza (en escritorio alto las gráficas no se aplastan). Ver [data-filters-open] en index.css.
  // Es un atributo puesto directo en el DOM (no estado): así abrir/plegar no vuelve a renderizar las
  // gráficas (Recharts re-anima barras y líneas en cada render y oculta sus etiquetas mientras tanto).
  const filtersOpenRef = useRef(false);
  const appRef = useRef(null);
  const gridRef = useRef(null);
  // Último mes con datos del año aplicado. SidebarLeft lo reporta como { dataset, anio, mesFinal };
  // solo vale si coincide con lo aplicado (si no, undefined = desconocido, nunca "sin publicar")
  const [mesFinalInfo, setMesFinalInfo] = useState(null);

  // Estado de carga inicial y animación
  const [initialLoading, setInitialLoading] = useState(true);
  const [fadeLoading, setFadeLoading] = useState(false);

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

  const handleInitialLoadComplete = useCallback(() => {
    setFadeLoading(true);
    setTimeout(() => {
      setInitialLoading(false);
    }, 400); // Duración del fadeout
  }, []);

  // El splash sale en cuanto el panel de filtros (y con él el año) está listo: cada tarjeta muestra su
  // propio velo de carga, así que no hace falta esperar a las cinco (antes bloqueaba 5–6 s en cada carga)
  const handleComponentLoaded = useCallback((key) => {
    if (key === 'filters') handleInitialLoadComplete();
  }, [handleInitialLoadComplete]);

  // Callbacks estables por componente: con props estables, React.memo evita que las gráficas se
  // vuelvan a renderizar (y Recharts re-anime y oculte sus etiquetas) al editar filtros sin aplicar.
  const onFiltersLoaded = useCallback(() => handleComponentLoaded('filters'), [handleComponentLoaded]);
  const onSidebarLoaded = useCallback(() => handleComponentLoaded('sidebar'), [handleComponentLoaded]);
  const onBarLoaded = useCallback(() => handleComponentLoaded('barChart'), [handleComponentLoaded]);
  const onLineLoaded = useCallback(() => handleComponentLoaded('lineChart'), [handleComponentLoaded]);
  const onMapLoaded = useCallback(() => handleComponentLoaded('map'), [handleComponentLoaded]);

  // Mecanismo de seguridad: quitar pantalla de carga máximo en 10s pase lo que pase
  useEffect(() => {
    const timer = setTimeout(() => {
      handleInitialLoadComplete();
    }, 10000);
    return () => clearTimeout(timer);
  }, [handleInitialLoadComplete]);

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
    // Limpiar aplica al instante: si de verdad quitó algo, se ofrece deshacerlo
    const prevSelected = selectedFilters;
    const prevApplied = appliedFilters;
    const cambio = JSON.stringify(cleared) !== JSON.stringify(prevApplied) || JSON.stringify(cleared) !== JSON.stringify(prevSelected);
    setSelectedFilters(cleared);
    setAppliedFilters(cleared);
    if (cambio) {
      toast('Filtros restablecidos', {
        duration: 10000,
        action: {
          label: 'Deshacer',
          onClick: () => { setSelectedFilters(prevSelected); setAppliedFilters(prevApplied); }
        }
      });
    }
  };

  const handleDatasetChange = (newDataset) => {
    // Cada conjunto empieza limpio (decisión del usuario): se dice qué se quitó para que no pase inadvertido
    if (appliedFilters.dataset !== newDataset) {
      const nDelito = ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'sexo', 'rangoEdad']
        .filter(k => Array.isArray(appliedFilters[k]) && appliedFilters[k].length > 0).length;
      const partes = [];
      if (appliedFilters.municipio && appliedFilters.municipio !== 'All') partes.push(`municipio ${appliedFilters.municipio}`);
      if (nDelito > 0) partes.push(`${nDelito} ${nDelito === 1 ? 'filtro' : 'filtros'} de delito`);
      if (partes.length > 0) toast(`Al cambiar de conjunto se quitó: ${partes.join(' y ')}`, { id: 'cambio-conjunto' });
    }
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

  // El conjunto elegido no tiene el año aplicado: se pasa a su año más reciente y se avisa
  const handleYearUnavailable = useCallback((anio, anios) => {
    setSelectedFilters(prev => ({ ...prev, anio }));
    setAppliedFilters(prev => {
      if (prev.anio === anio) return prev;
      const nombre = { delitos: 'Delitos', alto_impacto: 'Delitos Alto Impacto', victimas: 'Víctimas', victimas_mun: 'Víctimas Municipios' }[prev.dataset] || 'Este conjunto';
      const motivo = anios.length === 1 ? `solo tiene datos de ${anio}` : `no tiene datos de ${prev.anio}`;
      toast(`${nombre} ${motivo}. Se cambió el año (antes ${prev.anio}).`, { id: 'anio-no-disponible', duration: 8000 });
      return { ...prev, anio };
    });
  }, []);

  // Alto que ocupa arriba de la cuadrícula el encabezado + la línea de filtros PLEGADA. Se calcula en
  // cualquier estado restando el alto actual del contenido plegable (0 plegado; el que tenga abierto o a
  // media transición), así que también es válido con el panel abierto o si la ventana cambia de tamaño.
  // Con el panel abierto la cuadrícula mide calc(100vh - --chrome-plegado): el mismo alto que plegado.
  const medirChrome = () => {
    const grid = gridRef.current;
    const app = appRef.current;
    if (!grid || !app) return;
    const plegable = app.querySelector('.filters-collapse');
    const altoPlegable = plegable ? plegable.getBoundingClientRect().height : 0;
    const chrome = grid.getBoundingClientRect().top - app.getBoundingClientRect().top - altoPlegable;
    app.style.setProperty('--chrome-plegado', `${Math.round(chrome)}px`);
  };
  // Al abrir desde plegado se mide una última vez (por si la ventana cambió en este cuadro). Si se reabre
  // antes de que termine el plegado (<340ms) no se mide: Filters ya canceló el aviso pendiente de
  // plegado (limpieza de su efecto) y el atributo nunca se quitó.
  const handleFiltersOpenChange = (open) => {
    if (open && !filtersOpenRef.current) medirChrome();
    filtersOpenRef.current = open;
    const app = appRef.current;
    if (!app) return;
    if (open) app.dataset.filtersOpen = 'true';
    else delete app.dataset.filtersOpen;
  };
  useEffect(() => {
    if (activeTab !== 'dashboard') return undefined;
    // La medición descuenta el contenido plegable: vale plegado y abierto (p. ej. al cambiar la ventana)
    const medir = () => medirChrome();
    medir();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    if (ro && gridRef.current) ro.observe(gridRef.current);
    window.addEventListener('resize', medir);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [activeTab, appliedFilters.anio]);

  const mesFinal = mesFinalInfo
    && mesFinalInfo.dataset === appliedFilters.dataset
    && String(mesFinalInfo.anio) === String(appliedFilters.anio)
    ? mesFinalInfo.mesFinal
    : undefined;

  return (
    <MesFinalContext.Provider value={mesFinal}>
    <div ref={appRef} className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      
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
            {/* El logotipo es oscuro: va sobre una placa clara para leerse en el fondo navy */}
            <img src="/logo.png" alt="Fiscalía General de Justicia del Estado de Sonora" style={{ height: '70px', objectFit: 'contain', marginBottom: '0.5rem', background: '#ffffff', padding: '10px 18px', borderRadius: '12px', boxSizing: 'content-box' }} />
            
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

      <a href="#contenido" className="skip-link">Saltar al contenido</a>
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
            onInitialLoadComplete={onFiltersLoaded}
            customCapsules={customCapsules}
            onAddCustomCapsule={handleAddCustomCapsule}
            onRemoveCustomCapsule={handleRemoveCustomCapsule}
            onOpenChange={handleFiltersOpenChange}
            onYearUnavailable={handleYearUnavailable}
          />

          {/* flex/min-height en index.css (.dashboard-grid): con el panel abierto se fija su alto */}
          <main id="contenido" tabIndex={-1} ref={gridRef} className="dashboard-grid">
            {/* Left Column */}
            <div className="dashboard-col">
              <SidebarLeft
                selectedFilters={appliedFilters}
                metricType={metricType}
                onInitialLoad={onSidebarLoaded}
                onMesFinal={setMesFinalInfo}
              />
            </div>

            {/* Center Column */}
            <div className="dashboard-col">
              <div className="card" style={{ flex: 1, minHeight: 'var(--chart-card-min-height, 300px)', display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)' }}>
                <ChartBarYears
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={onBarLoaded}
                />
              </div>

              {/* flex en index.css (.trend-card): 1.25 en escritorio; en tablet/móvil crece con su contenido */}
              <div className="card trend-card" style={{ minHeight: 'var(--chart-trend-card-min-height, 250px)', display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)' }}>
                <ChartLineTrend
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={onLineLoaded}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="dashboard-col dashboard-col-map">
              <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 'var(--card-padding, 1rem)', height: '100%' }}>
                <MapMexico
                  selectedFilters={appliedFilters}
                  metricType={metricType}
                  onInitialLoad={onMapLoaded}
                  mesFinal={mesFinal}
                />
              </div>
            </div>
          </main>
        </>
        )
      ) : (
        <main id="contenido" tabIndex={-1} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <HistoryRankings tempColor={DATASET_COLORS[appliedFilters.dataset] || "#455993"} />
        </main>
      )}
    </div>
    </MesFinalContext.Provider>
  );
}

export default PublicDashboard;

import React, { useState, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleLinear } from 'd3-scale';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV } from '../utils/exportUtils';

// NOTA: El mapa solo soporta dos vistas:
//   1. Vista Nacional (entidad = "All")  → muestra todas las entidades usando /mexico_geo.json
//   2. Vista Sonora   (entidad = "Sonora") → muestra municipios de Sonora usando /sonora_geo.json
// Para cualquier otra entidad seleccionada, el mapa nacional se mantiene visible
// con el filtro activo (los datos se filtran) pero sin cambio de zoom ni de región.

const MapMexico = ({ selectedFilters, metricType, onInitialLoad }) => {
  const dataset = selectedFilters?.dataset || 'delitos';
  const isVictimas = dataset === 'victimas';
  const isVictimasMun = dataset === 'victimas_mun';
  const isVictimasBase = isVictimas || isVictimasMun;
  const isSonora = !isVictimas && selectedFilters?.entidad === "Sonora";
  const geoUrl = isSonora ? "/sonora_geo.json" : "/mexico_geo.json";
  
  const [tooltipData, setTooltipData] = useState(null);
  const [stateData, setStateData] = useState([]);
  const [maxVal, setMaxVal] = useState(100);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

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

    const params = new URLSearchParams();
    params.append("dataset", dataset);
    params.append("metric_type", metricType);
    if (selectedFilters.anio) params.append("anio", selectedFilters.anio);

    // Para el mapa de Sonora pasamos la entidad para obtener sus municipios.
    // Para el mapa nacional NO pasamos entidad (mostramos todas).
    if (isSonora) {
      params.append("entidad", "Sonora");
    }

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

    const endpoint = isSonora ? "api/incidencia_por_municipio" : "api/incidencia_por_entidad";

    axios.get(`${API_URL}/${endpoint}?${params.toString()}`, { signal: controller.signal })
      .then(res => {
        if (res.data) {
          setStateData(res.data);
          const numericValues = res.data
            .map(d => typeof d.value === 'number' ? d.value : parseFloat(d.value))
            .filter(v => !isNaN(v));
          const m = numericValues.length > 0 ? Math.max(...numericValues, 1) : 1;
          setMaxVal(m);
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return; // petición cancelada, ignorar
        console.error("Error fetching map data", err);
      })
      .finally(() => {
        setLoading(false);
        if (onInitialLoad && !initialLoadCalled.current) {
          initialLoadCalled.current = true;
          onInitialLoad();
        }
      });

    return () => controller.abort();
  }, [selectedFilters, isSonora, dataset, metricType]);

  const colorScale = scaleLinear()
    .domain([0, maxVal])
    .range(["#eceef5", "#455993"]);

  const getFillColor = (val) => {
    if (val === "N/D" || val === undefined || val === null) {
      return "#e2e8f0"; // Gris claro para datos no disponibles
    }
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) {
      return "#e2e8f0";
    }
    return colorScale(num);
  };

  // Helper para normalizar nombres entre TopoJSON y la base de datos
  const normalize = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  const formatValue = (val) => {
    if (val === 'N/D' || val === undefined || val === null) return 'N/D';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return 'N/D';
    if (metricType === 'rate') {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('en-US');
  };

  const handleDownloadCSV = () => {
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const csvValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const headers = [isSonora ? "Municipio" : "Entidad", csvValLabel];
    const dataForExport = stateData.map(d => [d.name, d.value]);
    const filename = isSonora 
      ? "datos_municipios_sonora.csv" 
      : (isVictimasBase ? "datos_entidades_victimas.csv" : "datos_entidades_incidencia.csv");
    downloadCSV(filename, dataForExport, headers, { ...selectedFilters, metricType });
  };

  const mapTitle = isSonora 
    ? (metricType === 'rate' ? 'Tasa de Incidencia por Municipio (Sonora)' : 'Incidencia por Municipio (Sonora)') 
    : (isVictimas 
        ? (metricType === 'rate' ? 'Tasa de Víctimas por Entidad (México)' : 'Víctimas por Entidad (México)') 
        : (metricType === 'rate' ? 'Tasa de Incidencia por Entidad (México)' : 'Incidencia por Entidad (México)')
      );

  const tooltipLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';

  return (
    <div 
      ref={cardRef} 
      className={isFullScreen ? "fullscreen-immersive-overlay" : ""}
      style={isFullScreen ? {} : { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}
    >
      {isFullScreen ? (
        <FullScreenHeader
          title={mapTitle}
          selectedFilters={selectedFilters}
          metricType={metricType}
          onClose={() => setIsFullScreen(false)}
          extraActions={
            <ExportMenu
              elementRef={cardRef}
              imageFilename={isSonora ? "mapa_sonora.png" : (isVictimasBase ? "mapa_victimas_mexico.png" : "mapa_delitos_mexico.png")}
              onDownloadCSV={handleDownloadCSV}
            />
          }
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingRight: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0 }}>
            {mapTitle}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              elementRef={cardRef}
              imageFilename={isSonora ? "mapa_sonora.png" : (isVictimasBase ? "mapa_victimas_mexico.png" : "mapa_delitos_mexico.png")}
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

      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0 }}>
        {loading && <LoadingSpinner size="md" />}

        {/* Custom Tooltip Overlay */}
        {tooltipData && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'white',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-color)',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              {tooltipData.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {tooltipLabel}: <strong style={{ color: 'var(--text-primary)' }}>{formatValue(tooltipData.value)}</strong>
            </div>
          </div>
        )}

        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: isFullScreen ? (isSonora ? 8000 : 2500) : (isSonora ? 4000 : 1200),
            center: isSonora ? [-111.5, 29.5] : [-102, 24]
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = isSonora ? (geo.properties.MUN || "Desconocido") : (geo.properties.nom_ent || "Desconocido");

                const mapName = normalize(stateName);
                const foundData =
                  stateData.find(d => normalize(d.name) === mapName) ||
                  stateData.find(d => {
                    const dbName = normalize(d.name);
                    return mapName.includes(dbName) || dbName.includes(mapName);
                  });

                const realValue = foundData ? foundData.value : 0;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => {
                      setTooltipData({ name: stateName, value: realValue });
                    }}
                    onMouseLeave={() => {
                      setTooltipData(null);
                    }}
                    style={{
                      default: {
                        fill: getFillColor(realValue),
                        stroke: "#ffffff",
                        strokeWidth: 0.5,
                        outline: "none",
                        transition: "all 250ms"
                      },
                      hover: {
                        fill: "#f59e0b",
                        stroke: "#b45309",
                        strokeWidth: 1.5,
                        outline: "none",
                        cursor: "pointer",
                        transition: "all 250ms"
                      },
                      pressed: {
                        fill: "#d97706",
                        outline: "none"
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  );
};

export default MapMexico;

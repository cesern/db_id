import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { scaleSqrt } from 'd3-scale';

// Extremos del degradado del azul institucional
const MAP_LOW = '#e6e9f2';
const MAP_HIGH = '#455993';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { chartTitle } from '../utils/labels';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';
import DrillDownModal from './DrillDownModal';
import { useFullscreenScale } from '../utils/fullscreenScale';

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
  const isAltoImpacto = dataset === 'alto_impacto';
  const wireDataset = isAltoImpacto ? 'delitos' : dataset;
  const isSonora = !isVictimas && selectedFilters?.entidad === "Sonora";
  const geoUrl = isSonora ? "/sonora_geo.json" : "/mexico_geo.json";
  
  const [tooltipData, setTooltipData] = useState(null);
  const [stateData, setStateData] = useState([]);
  const [maxVal, setMaxVal] = useState(100);
  const [loading, setLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [drillModal, setDrillModal] = useState(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const initialLoadCalled = useRef(false);
  const cardRef = useRef(null);
  const mapWrapRef = useRef(null);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });

  // Medir el contenedor del mapa para auto-ajustar en fullscreen
  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setMapSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // En fullscreen la escala se calcula del tamaño medido para que el geo
  // se vea completo y centrado; en vista normal se conservan las constantes.
  const fitScale = useMemo(() => {
    const { w, h } = mapSize;
    if (!isFullScreen || w < 10 || h < 10) return null;
    const s = isSonora ? Math.min(8.9 * w, 8.7 * h) : Math.min(1.9 * w, 2.5 * h);
    return Math.round(s * 0.96);
  }, [mapSize, isFullScreen, isSonora]);
  // Vista normal: el lienzo toma la proporción real de la tarjeta (columna angosta y alta)
  // y la escala se ajusta para que el geo la llene, en vez de quedar con franjas vacías.
  // Escritorio (>=1024px): la columna del mapa tiene altura fija y se puede medir.
  // En tablet/móvil la altura depende del propio mapa: medirla crea un ciclo
  // (Safari lo estira sin fin), así que ahí se usa una proporción fija por forma.
  const [isDesktopLayout, setIsDesktopLayout] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsDesktopLayout(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const normalCanvas = useMemo(() => {
    const { w, h } = mapSize;
    if (isFullScreen) return null;
    const W = 800;
    let H;
    if (!isDesktopLayout) {
      H = isSonora ? 860 : 540; // Sonora es vertical; México, horizontal
    } else {
      if (w < 10 || h < 10) return null;
      H = Math.round(W * h / w);
    }
    // Extensión en radianes Mercator: Sonora ≈ 0.117 × 0.124; México ≈ 0.53 × 0.34
    const s = isSonora ? Math.min(0.9 * W / 0.117, 0.9 * H / 0.124) : Math.min(0.92 * W / 0.53, 0.92 * H / 0.34);
    return { W, H, scale: Math.round(s) };
  }, [mapSize, isFullScreen, isSonora, isDesktopLayout]);
  const mapScale = fitScale || normalCanvas?.scale || (isSonora ? 4000 : 1200);

  // Factor de escala fullscreen (1 en vista normal) para el tooltip
  const fsScale = useFullscreenScale(isFullScreen);

  // Builds shared filter query params from selectedFilters
  const buildFilterParams = (params) => {
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
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      params.append('altoImpacto', ai.join('|'));
    }
  };

  // Clic en entidad (mapa nacional) → desglose de municipios (o subtipos en Víctimas)
  const handleEntityClick = async (entidadName) => {
    if (!entidadName || entidadName === 'Desconocido') return;
    setDrillModal({ title: entidadName, data: null, loading: true });
    try {
      const params = new URLSearchParams();
      params.append('dataset', wireDataset);
      params.append('metric_type', metricType);
      params.append('entidad', entidadName);
      if (selectedFilters.anio) params.append('anio', selectedFilters.anio);
      buildFilterParams(params);

      const endpoint = isVictimas ? 'api/incidencia_por_delito' : 'api/incidencia_por_municipio';
      if (isVictimas) {
        params.append('categoria', 'subtipo_delito');
      }

      const res = await axios.get(`${API_URL}/${endpoint}?${params.toString()}`);
      const rawData = res.data || [];
      const mappedData = rawData.map(d => ({
        name: isVictimas ? d.name : (d.municipio || d.name),
        value: typeof d.value === 'number' ? d.value : (parseFloat(d.value) || 0),
        rank: d.id,
      }));
      const anioLabel = selectedFilters.anio ? ` · ${selectedFilters.anio}` : ' · Todos los años';
      const dataLabel = isVictimasBase ? 'Víctimas' : 'Delitos';
      const modalTitle = isVictimas ? `${entidadName}` : `Municipios — ${entidadName}`;
      const modalSubtitle = isVictimas ? `Subtipo de delito${anioLabel}` : `Desglose por municipio${anioLabel} · ${dataLabel}`;

      setDrillModal({
        title: modalTitle,
        subtitle: modalSubtitle,
        data: mappedData,
        loading: false,
        valueLabel: dataLabel,
        showRank: true,
        showPct: true,
      });
    } catch (err) {
      console.error('Error fetching entity drill-down', err);
      setDrillModal(prev => ({ ...prev, loading: false, data: [] }));
    }
  };

  // Clic en municipio (mapa Sonora) → desglose por subtipo de delito
  const handleMunicipioClick = async (municipioName) => {
    if (!municipioName || municipioName === 'Desconocido') return;
    setDrillModal({ title: municipioName, data: null, loading: true });
    try {
      const params = new URLSearchParams();
      params.append('categoria', 'subtipo_delito');
      params.append('dataset', wireDataset);
      params.append('metric_type', metricType);
      params.append('entidad', 'Sonora');
      params.append('municipio', municipioName);
      if (selectedFilters.anio) params.append('anio', selectedFilters.anio);
      buildFilterParams(params);
      const res = await axios.get(`${API_URL}/api/incidencia_por_delito?${params.toString()}`);
      const rawData = res.data || [];
      const mappedData = rawData.map(d => ({
        name: d.name,
        value: typeof d.value === 'number' ? d.value : (parseFloat(d.value) || 0),
        rank: d.id,
      }));
      const anioLabel = selectedFilters.anio ? ` · ${selectedFilters.anio}` : ' · Todos los años';
      const dataLabel = isVictimasBase ? 'Víctimas' : 'Delitos';
      setDrillModal({
        title: `${municipioName}, Sonora`,
        subtitle: `Subtipo de delito${anioLabel}`,
        data: mappedData,
        loading: false,
        valueLabel: dataLabel,
        showRank: true,
        showPct: true,
      });
    } catch (err) {
      console.error('Error fetching subtipo drill-down', err);
      setDrillModal(prev => ({ ...prev, loading: false, data: [] }));
    }
  };

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
    params.append("dataset", wireDataset);
    params.append("metric_type", metricType);
    if (selectedFilters.anio) params.append("anio", selectedFilters.anio);
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      params.append("altoImpacto", ai.join('|'));
    }

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
        setError(false);
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
  }, [selectedFilters, isSonora, dataset, metricType, retryKey]);

  // Escala de raíz cuadrada: el color refleja la magnitud (Hermosillo 7,157 intenso,
  // San Luis Río Colorado 1,296 en tono medio) sin que el valor máximo deje al resto en blanco.
  const colorScale = scaleSqrt().domain([0, maxVal]).range([MAP_LOW, MAP_HIGH]).clamp(true);

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
      return num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('es-MX');
  };

  const getExportData = () => {
    const valLabel = isVictimasBase ? "Víctimas" : "Incidencia";
    const csvValLabel = metricType === 'rate' ? `${valLabel} (Tasa por 100k hab.)` : valLabel;
    const headers = [isSonora ? "Municipio" : "Entidad", csvValLabel];
    const dataForExport = stateData.map(d => [d.name, d.value]);
    return { headers, dataForExport };
  };

  const handleDownloadCSV = () => {
    const { headers, dataForExport } = getExportData();
    const filename = isSonora
      ? (isAltoImpacto ? "datos_municipios_sonora_alto_impacto.csv" : "datos_municipios_sonora.csv")
      : (isVictimasBase ? "datos_entidades_victimas.csv" : (isAltoImpacto ? "datos_entidades_alto_impacto.csv" : "datos_entidades_incidencia.csv"));
    downloadCSV(filename, dataForExport, headers, { ...selectedFilters, metricType });
  };

  const handleCopyData = () => {
    const { headers, dataForExport } = getExportData();
    copyTableToClipboard(dataForExport, headers);
  };

  // Título compartido (utils/labels): sigue al dataset, incluida Víctimas Municipios
  const mapTitle = chartTitle(dataset, metricType, isSonora ? 'por municipio (Sonora)' : 'por entidad (México)');

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
              onCopyTable={handleCopyData}
            />
          }
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', paddingRight: '0.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', margin: 0, minWidth: 0 }}>
            {mapTitle}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ExportMenu
              elementRef={cardRef}
              imageFilename={isSonora ? "mapa_sonora.png" : (isVictimasBase ? "mapa_victimas_mexico.png" : "mapa_delitos_mexico.png")}
              onDownloadCSV={handleDownloadCSV}
              onCopyTable={handleCopyData}
            />
            {/* Mapa de referencia: el análisis detallado se hace ampliado */}
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsFullScreen(true)}
              title="Ampliar mapa en pantalla completa"
              aria-label="Ampliar mapa en pantalla completa"
              style={{ gap: '0.3rem', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600 }}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              Ampliar
            </button>
          </div>
        </div>
      )}

      <div ref={mapWrapRef} style={{ flex: isDesktopLayout || isFullScreen ? 1 : 'none', position: 'relative', width: '100%', minHeight: 0 }}>
        {loading && <LoadingSpinner size="md" />}
        {!loading && error && <EmptyState variant="error" onRetry={() => setRetryKey(k => k + 1)} />}
        {!loading && !error && stateData.length === 0 && <EmptyState />}

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
            <div style={{ fontWeight: 600, fontSize: `${0.875 * fsScale}rem`, marginBottom: '0.25rem' }}>
              {tooltipData.name}
            </div>
            <div style={{ fontSize: `${0.75 * fsScale}rem`, color: 'var(--text-secondary)' }}>
              {tooltipLabel}: <strong style={{ color: 'var(--text-primary)' }}>{formatValue(tooltipData.value)}</strong>
            </div>
          </div>
        )}

        <ComposableMap
          {...(normalCanvas ? { width: normalCanvas.W, height: normalCanvas.H } : {})}
          projection="geoMercator"
          projectionConfig={{
            scale: mapScale,
            center: isSonora ? [-111.5, 29.5] : [-102, 24]
          }}
          style={{ width: "100%", height: isDesktopLayout || isFullScreen ? "100%" : "auto", display: "block" }}
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
                    onMouseEnter={() => setTooltipData({ name: stateName, value: realValue })}
                    onMouseLeave={() => setTooltipData(null)}
                    onClick={() => isSonora ? handleMunicipioClick(stateName) : handleEntityClick(stateName)}
                    style={{
                      default: {
                        fill: getFillColor(realValue),
                        stroke: "#ffffff",
                        strokeWidth: 0.5,
                        outline: "none",
                        transition: "fill 160ms ease, stroke 160ms ease"
                      },
                      hover: {
                        fill: "#f59e0b",
                        stroke: "#b45309",
                        strokeWidth: 1.5,
                        outline: "none",
                        cursor: "pointer",
                        transition: "fill 160ms ease, stroke 160ms ease"
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

        {/* Leyenda de la escala de color (se exporta junto con el mapa).
            Vista normal: una sola fila compacta; pantalla completa: bloque con título. */}
        {!error && stateData.length > 0 && maxVal > 0 && (
          <div
            role="img"
            aria-label={`Escala de color (raíz cuadrada): de 0 a ${formatValue(maxVal)} ${metricType === 'rate' ? 'por 100 mil habitantes' : tooltipLabel.toLowerCase()}`}
            style={{
              position: 'absolute', left: '0.5rem', bottom: '0.5rem', zIndex: 3,
              background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              ...(isFullScreen
                ? { borderRadius: '8px', padding: '0.4rem 0.6rem', minWidth: '150px', fontSize: `${0.72 * Math.max(1, fsScale || 1)}rem` }
                : { borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' })
            }}
          >
            {isFullScreen ? (
              <>
                <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.25rem' }}>
                  {metricType === 'rate' ? `${tooltipLabel} · tasa por 100 mil hab.` : tooltipLabel}
                </div>
                <div style={{ height: '8px', borderRadius: '4px', background: `linear-gradient(to right, ${MAP_LOW}, ${MAP_HIGH})`, border: '1px solid rgba(69,89,147,0.2)' }} />
                <div className="tabular" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', gap: '0.75rem' }}>
                  <span>0</span>
                  <span>{formatValue(maxVal)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <span aria-hidden="true" style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#e2e8f0', border: '1px solid #cbd5e1' }} />
                  Sin dato
                </div>
              </>
            ) : (
              <>
                <span className="tabular">0</span>
                <span aria-hidden="true" style={{ width: '64px', height: '6px', borderRadius: '3px', background: `linear-gradient(to right, ${MAP_LOW}, ${MAP_HIGH})`, border: '1px solid rgba(69,89,147,0.2)' }} />
                <span className="tabular">{formatValue(maxVal)}</span>
                <span aria-hidden="true" style={{ width: '8px', height: '8px', marginLeft: '0.3rem', borderRadius: '2px', background: '#e2e8f0', border: '1px solid #cbd5e1' }} />
                <span>Sin dato</span>
              </>
            )}
          </div>
        )}
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

export default MapMexico;

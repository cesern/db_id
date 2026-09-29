import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import LoadingSpinner from './LoadingSpinner';
import ExportMenu from './ExportMenu';
import FullScreenHeader from './FullScreenHeader';
import EmptyState from './EmptyState';
import MenuSelect from './MenuSelect';
import { metricPhrase, periodLabel as formatPeriod, todoEnCero, sinDatosCopy, periodoSinPublicar } from '../utils/labels';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';
import { useExitAnimation } from '../utils/useExitAnimation';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Resaltado de filas:
// - 'strong': la entidad activa (vista Entidades) o el municipio seleccionado.
// - 'soft': en vista Municipios a nivel Nacional, los municipios de Sonora (entidad activa por
//   defecto), sin negritas. Con una entidad elegida todas las filas son de ella: no se resaltan.
const rowHighlight = (m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada) => {
  if (isEntidades) return m.name === activeEntityName ? 'strong' : null;
  if (selectedMunicipio && m.municipio === selectedMunicipio) return 'strong';
  if (entidadFiltrada) return null;
  return m.entidad === activeEntityName ? 'soft' : null;
};

// Filas que no son un municipio real ("No especificado", "Otros Municipios"): se muestran con su
// cifra para que cuadren los totales, pero sin lugar (#) y al final; el resto se re-clasifica
// (rank 'min': empates comparten lugar).
// Pantalla completa del ranking: vista tabla/barras y medidas de la tabla en columnas (coinciden con index.css)
const FS_VIEW_KEY = 'rankingFullscreenView';
const FS_VIEW_OPTIONS = [{ value: 'tabla', label: 'Tabla' }, { value: 'barras', label: 'Barras' }];
const FS_COL_MIN = 320; // ancho mínimo por columna
const FS_ROW_H = 33;    // alto de fila (.fs-col-row)
const FS_HEAD_H = 40;   // encabezado de columna (.fs-col-head)

const NO_MUNICIPIO = /^(no especificado|otros municipios)$/i;
const rankMunicipios = (list) => {
  const isReal = (m) => !NO_MUNICIPIO.test(String(m.municipio || m.name.split(',')[0]).trim());
  const real = list.filter(isReal);
  const rest = list.filter(m => !isReal(m)).map(m => ({ ...m, id: '—' }));
  // Conserva el orden del backend; empate numérico con la fila anterior = mismo lugar
  const ranked = real.map((m, i) => ({ ...m, id: i + 1 }));
  for (let i = 1; i < ranked.length; i++) {
    if (typeof ranked[i].value === 'number' && ranked[i].value === ranked[i - 1].value) ranked[i].id = ranked[i - 1].id;
  }
  return [...ranked, ...rest];
};

const SidebarLeft = ({ selectedFilters, metricType, onInitialLoad, onMesFinal }) => {
  const [totalIncidencia, setTotalIncidencia] = useState(null); // null = aún sin respuesta → "—"
  const [entidades, setEntidades] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [tableView, setTableView] = useState('entidades'); // 'entidades' | 'municipios'
  // <1024px: la tabla crece con la página (sin scroll propio) y muestra top 10 + "Ver todos"
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  const [showAllRows, setShowAllRows] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (e) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // true desde el inicio: antes de la primera respuesta no se muestra un "sin datos" falso
  const [loading, setLoading] = useState(true);
  // Pantalla completa: fsOpen es la intención; isFullScreen sigue montado ~140ms al cerrar (fundido de salida)
  const [fsOpen, setFsOpen] = useState(false);
  const { mounted: isFullScreen, closing: fsClosing } = useExitAnimation(fsOpen, 140);
  const fsTriggerRef = useRef(null); // botón que abre la vista: recibe el foco al cerrar
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const initialLoadCalled = useRef(false);
  const tableCardRef = useRef(null);

  // Pantalla completa: vista "tabla" (en columnas) o "barras"; se recuerda en el navegador
  const [fsView, setFsView] = useState(() => {
    try { return localStorage.getItem(FS_VIEW_KEY) === 'barras' ? 'barras' : 'tabla'; } catch { return 'tabla'; }
  });
  const setFsViewPersist = (v) => {
    setFsView(v);
    try { localStorage.setItem(FS_VIEW_KEY, v); } catch { /* sin almacenamiento: solo en memoria */ }
  };
  // Tamaño del cuerpo para repartir la tabla en columnas
  const fsBodyRef = useRef(null);
  const [fsBox, setFsBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!isFullScreen) return undefined;
    const el = fsBodyRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFsBox(prev => (Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullScreen, fsView, tableView]);


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
  const isAltoImpacto = dataset === 'alto_impacto';
  const wireDataset = isAltoImpacto ? 'delitos' : dataset;

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

    const params = { dataset: wireDataset };
    params.anio = selectedFilters.anio;
    params.metric_type = metricType;
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      params.altoImpacto = ai.join('|');
    }
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
        setError(false);
        if (resTotal.data?.total_incidencia !== undefined) {
          setTotalIncidencia(resTotal.data.total_incidencia);
        }
        if (resEntidades.data) setEntidades(resEntidades.data);
        if (!isVictimas && resMunicipios?.data) {
          setMunicipios(rankMunicipios(resMunicipios.data));
        } else {
          setMunicipios([]);
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return; // petición cancelada, ignorar
        console.error('Error fetching sidebar data', err);
        setError(true);
      })
      .finally(() => {
        // Cancelada: la petición nueva sigue en curso; no apagar la carga (evita un 'Sin datos' falso)
        if (controller.signal.aborted) return;
        setLoading(false);
        if (onInitialLoad && !initialLoadCalled.current) {
          initialLoadCalled.current = true;
          onInitialLoad();
        }
      });

    return () => controller.abort();
  }, [selectedFilters, metricType, retryKey]);

  // Lugar nacional del año anterior con los mismos filtros. Si el año actual es parcial
  // (sin meses elegidos), se compara contra los mismos meses del año anterior.
  const [prevRank, setPrevRank] = useState(null); // { anio, rank, periodo, value } | null
  const [showRankTip, setShowRankTip] = useState(false);
  // Último mes con datos del año seleccionado (con los filtros): para rotular el periodo real
  const [curMesFinal, setCurMesFinal] = useState(null);
  useEffect(() => {
    if (!selectedFilters || selectedFilters.anio == null) return undefined;
    const controller = new AbortController();
    const signal = controller.signal;
    const anio = Number(selectedFilters.anio);
    const base = { dataset: wireDataset, metric_type: metricType };
    if (isAltoImpacto) {
      const ai = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
      base.altoImpacto = ai.join('|');
    }
    for (const k of ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'sexo', 'rangoEdad']) {
      const v = Array.isArray(selectedFilters[k]) ? selectedFilters[k] : [];
      if (v.length > 0) base[k] = v.join('|');
    }
    const entityName = (!selectedFilters.entidad || selectedFilters.entidad === 'All') ? 'Sonora' : selectedFilters.entidad;
    (async () => {
      try {
        let meses = Array.isArray(selectedFilters.meses) ? selectedFilters.meses : [];
        const years = await axios.get(`${API_URL}/api/incidencia_por_anio`, { params: base, signal });
        const rows = Array.isArray(years.data) ? years.data : [];
        const cur = rows.find(d => Number(d.year) === anio);
        const mf = cur && typeof cur.mes_final === 'number' ? cur.mes_final : null;
        setCurMesFinal(mf);
        if (onMesFinal) onMesFinal(mf);
        if (!cur || !rows.some(d => Number(d.year) === anio - 1)) { setPrevRank(null); return; }
        if (meses.length === 0 && cur.mes_final && cur.mes_final < 12) meses = MESES.slice(0, cur.mes_final);
        const params = { ...base, anio: anio - 1 };
        if (meses.length > 0) params.meses = meses.join(',');
        const res = await axios.get(`${API_URL}/api/incidencia_por_entidad`, { params, signal });
        const row = (Array.isArray(res.data) ? res.data : []).find(e => e.name === entityName);
        const idx = meses.map(m => MESES.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b);
        const periodo = idx.length > 0 && idx.length < 12 ? `${MESES_CORTOS[idx[0]]}–${MESES_CORTOS[idx[idx.length - 1]]}` : null;
        setPrevRank(row ? { anio: anio - 1, rank: row.id, periodo, value: row.value } : null);
      } catch (err) {
        if (!axios.isCancel(err)) setPrevRank(null);
      }
    })();
    return () => controller.abort();
  }, [selectedFilters, metricType, retryKey]);

  const formatNumber = (num) => {
    if (num === 'N/D' || num === undefined || num === null) return 'N/D';
    const val = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(val)) return 'N/D';
    if (metricType === 'rate') {
      return val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('es-MX');
  };

  // Determinar la entidad activa a mostrar en el KPI card
  const activeEntityName = (!selectedFilters?.entidad || selectedFilters.entidad === 'All')
    ? 'Sonora'
    : selectedFilters.entidad;

  const activeEntityData = entidades.find(e => e.name === activeEntityName);
  const activeEntityRank = activeEntityData ? activeEntityData.id : null;
  const totalEntidades = entidades.length;
  // Periodo sin datos (p. ej. solo Dic en un año publicado hasta Ago): con todo en 0 las 32 entidades
  // empatarían en el lugar 1. Se muestra "—" y un estado vacío en lugar de lugares falsos.
  const entidadesEnCero = !error && todoEnCero(entidades);
  const sinDatos = sinDatosCopy(selectedFilters?.anio ?? '', selectedFilters?.meses, curMesFinal);
  const sinPublicar = entidadesEnCero && periodoSinPublicar(selectedFilters?.meses, curMesFinal);
  const rankShown = entidadesEnCero ? null : activeEntityRank;
  const rankCriterion = metricType === 'rate' ? 'mayor tasa' : (isVictimasBase ? 'más víctimas' : 'mayor incidencia');

  // Periodo explícito del KPI: meses seleccionados (o todos) + año
  const periodLabel = formatPeriod(selectedFilters?.anio ?? '', selectedFilters?.meses, curMesFinal);
  const totalIsND = totalIncidencia === 'N/D';
  const entidadFiltrada = !!(selectedFilters?.entidad && selectedFilters.entidad !== 'All');
  const selectedMunicipio = (!isVictimas && selectedFilters?.municipio && selectedFilters.municipio !== 'All') ? selectedFilters.municipio : null;
  const activeIncidenceLabel = (selectedFilters?.municipio && selectedFilters.municipio !== 'All')
    ? selectedFilters.municipio
    : (isVictimasBase ? 'Víctimas' : isAltoImpacto ? 'Alto impacto' : 'Incidencia');

  const isEntidades = tableView === 'entidades' || isVictimas;
  const rows = isEntidades ? entidades : municipios;
  const colLabel = isEntidades ? 'Entidad' : 'Municipio';
  
  // Móvil: top 10 (más la fila resaltada si queda fuera) hasta pulsar "Ver todos"
  const MOBILE_ROWS = 10;
  const visibleRows = (isNarrow && !showAllRows)
    ? rows.filter((m, i) => i < MOBILE_ROWS || rowHighlight(m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada) === 'strong')
    : rows;
  const hiddenCount = rows.length - visibleRows.length;

  // Tabla en columnas (pantalla completa): tantas columnas como quepan (≥ FS_COL_MIN px cada una)
  // hasta que todas las filas entren sin desplazamiento; si ni así caben, se desplaza en vertical.
  const fsColumns = (() => {
    if (!isFullScreen || fsView !== 'tabla' || rows.length === 0) return [rows];
    const maxCols = Math.max(1, Math.floor((fsBox.w || 0) / FS_COL_MIN));
    const fitRows = Math.max(1, Math.floor(((fsBox.h || 0) - FS_HEAD_H) / FS_ROW_H));
    const cols = Math.min(maxCols, Math.max(1, Math.ceil(rows.length / fitRows)));
    const per = Math.ceil(rows.length / cols);
    return Array.from({ length: cols }, (_, i) => rows.slice(i * per, (i + 1) * per)).filter(c => c.length > 0);
  })();

  // Tabla con todas las filas en 0: estado vacío en vez de un empate en 1
  const tablaEnCero = !error && !loading && todoEnCero(rows);

  const maxVal = rows.reduce((mx, r) => (typeof r.value === 'number' && r.value > mx ? r.value : mx), 0);

  const baseValLabel = isVictimasBase ? 'Víctimas' : 'Incidencia';
  const valLabel = metricType === 'rate' ? `${baseValLabel} (Tasa)` : baseValLabel;

  const getExportFilename = (ext) => {
    if (isVictimas) return `tabla_victimas_entidad.${ext}`;
    if (isVictimasMun) return `tabla_victimas_mun_${tableView}.${ext}`;
    if (isAltoImpacto) return `tabla_alto_impacto_${tableView}.${ext}`;
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

  // Pantalla completa. Al cerrar, el overlay se queda ~140ms encima de la vista normal (ya montada)
  // mientras se desvanece; en ese lapso no toma tableCardRef, que vuelve a la tarjeta normal.
  const overlay = isFullScreen ? (
      <div 
        ref={fsClosing ? undefined : tableCardRef} 
        className={`fullscreen-immersive-overlay${fsClosing ? ' is-closing' : ''}`}
      >
        <FullScreenHeader
          title={`Ranking de ${metricPhrase(dataset, metricType).toLowerCase()} por ${isEntidades ? 'entidad' : 'municipio'}`}
          selectedFilters={selectedFilters}
          metricType={metricType}
          onClose={() => setFsOpen(false)}
          returnFocusRef={fsTriggerRef}
          extraActions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <MenuSelect
                value={fsView}
                onChange={setFsViewPersist}
                options={FS_VIEW_OPTIONS}
                prefix="Vista: "
                title="Cambiar entre tabla y barras"
              />
              {!isVictimas && (
                <div style={{
                  display: 'inline-flex',
                  background: 'var(--color-accent-light, #f0f4ff)',
                  borderRadius: '10px',
                  padding: '3px',
                  gap: '2px',
                  flexShrink: 0,
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
                          padding: '0.4rem 0.9rem', /* ancho por contenido: sin width fijo el texto ya no se encima */
                          whiteSpace: 'nowrap',
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

        {/* Cuerpo: Tabla en columnas (todo a la vista) o Barras horizontales; se cambia con "Vista ▾" */}
        <div
          ref={fsBodyRef}
          key={`${fsView}-${tableView}`}
          className="fs-rank-body"
          style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto' }}
        >
          {loading && <LoadingSpinner size="md" />}
          {error ? (
            <EmptyState variant="error" onRetry={() => setRetryKey(k => k + 1)} />
          ) : (rows.length === 0 && !loading) ? (
            <EmptyState />
          ) : tablaEnCero ? (
            <EmptyState title={sinDatos.title} detail={sinDatos.detail} />
          ) : fsView === 'barras' ? (
            <div className="fs-bars">
              {rows.map((m) => {
                const level = rowHighlight(m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada);
                const isNum = typeof m.value === 'number';
                const pct = maxVal > 0 && isNum ? Math.max(0.5, (m.value / maxVal) * 100) : 0;
                const displayName = (isEntidades || !entidadFiltrada) ? m.name : (m.municipio || m.name);
                return (
                  <div key={`${tableView}-${m.name}-${m.id}`} className="fs-bar-row" data-highlight={level || undefined} data-unranked={m.id === '—' || undefined}>
                    <span className="fs-bar-rank tabular">{m.id}</span>
                    <span className="fs-bar-name" title={m.name}>{displayName}</span>
                    <span className="fs-bar-track">
                      {isNum && <span className="fs-bar" style={{ width: `calc((100% - 5.5rem) * ${pct / 100})` }} />}
                      <span className="fs-bar-value tabular">{formatNumber(m.value)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="fs-cols">
              {fsColumns.map((col, ci) => (
                <div key={ci} className="fs-col">
                  <div className="fs-col-head">
                    <span>#</span>
                    <span>{colLabel}</span>
                    <span style={{ textAlign: 'right' }}>{valLabel}</span>
                  </div>
                  {col.map((m) => {
                    const level = rowHighlight(m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada);
                    const displayName = (isEntidades || !entidadFiltrada) ? m.name : (m.municipio || m.name);
                    return (
                      <div
                        key={`${tableView}-${m.name}-${m.id}`}
                        className="fs-col-row"
                        aria-current={level === 'strong' ? 'true' : undefined}
                        data-highlight={level || undefined}
                      >
                        <span className="tabular fs-col-rank">{m.id}</span>
                        <span className="fs-col-name" title={m.name}>{displayName}</span>
                        <span className="tabular fs-col-value">{formatNumber(m.value)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  ) : null;

  // La vista normal se oculta mientras la pantalla completa está abierta; el overlay ocupa siempre
  // la misma posición en el árbol (no se vuelve a montar al empezar el fundido de salida)
  const showNormal = !isFullScreen || fsClosing;

  return (
    <>
      {showNormal && (<>
      {/* KPI Cards: total del periodo + lugar nacional de la entidad activa */}
      <div style={{ display: 'flex', gap: 'var(--grid-gap, 1rem)' }}>
        {/* La posición nacional va primero: "Sonora · 21 de 32" + indicador vs año anterior.
            ▲ rojo = subió (hacia el 1, más incidencia); ▼ verde = bajó; = gris = mismo lugar.
            El detalle vive en un tooltip (mouse y teclado), no en pantalla. */}
        <div
          className="card"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', padding: '0.85rem 1rem', position: 'relative', minWidth: 0 }}
        >
          {loading && <LoadingSpinner size="sm" />}
          {/* Fila superior: entidad a la izquierda, indicador de cambio a la derecha
              (así "21 de 32" conserva todo el ancho de la tarjeta angosta) */}
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', minWidth: 0 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeEntityName}
            </span>
              {!error && rankShown !== null && prevRank && (() => {
                const diff = prevRank.rank - activeEntityRank; // > 0: subió hacia el 1
                const up = diff > 0, down = diff < 0;
                const cmpPrev = `${prevRank.periodo ? prevRank.periodo + ' ' : ''}${prevRank.anio}`;
                const cmpNow = `${prevRank.periodo ? prevRank.periodo + ' ' : ''}${selectedFilters?.anio}`;
                const unit = metricType === 'rate' ? 'por 100 mil hab.' : (isVictimasBase ? 'víctimas' : 'delitos');
                const headline = up ? `Subió ${diff} ${diff === 1 ? 'lugar' : 'lugares'}`
                  : down ? `Bajó ${-diff} ${diff === -1 ? 'lugar' : 'lugares'}` : 'Mismo lugar';
                const currentValue = activeEntityData ? activeEntityData.value : null;
                return (
                  <span
                    className="rank-change"
                    tabIndex={0}
                    role="img"
                    aria-label={`${headline}. ${cmpPrev}: lugar ${prevRank.rank}, ${formatNumber(prevRank.value)} ${unit}; ${cmpNow}: lugar ${activeEntityRank}, ${formatNumber(currentValue)} ${unit}`}
                    onMouseEnter={() => setShowRankTip(true)}
                    onMouseLeave={() => setShowRankTip(false)}
                    onFocus={() => setShowRankTip(true)}
                    onBlur={() => setShowRankTip(false)}
                    data-dir={up ? 'up' : down ? 'down' : 'same'}
                  >
                    <span aria-hidden="true">{up ? '▲' : down ? '▼' : '='}</span>
                    {showRankTip && (
                      <span className="rank-tip" role="tooltip">
                        <strong>{headline}</strong>
                        <span>{cmpPrev}: lugar {prevRank.rank} · {formatNumber(prevRank.value)} {unit}</span>
                        <span>{cmpNow}: lugar {activeEntityRank} · {formatNumber(currentValue)} {unit}</span>
                        <em>1 = entidad con {rankCriterion}</em>
                      </span>
                    )}
                  </span>
                );
              })()}
          </span>
          <span className="tabular" style={{ lineHeight: 1.1, display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
            {/* Cifra principal: mismo color oscuro que el total (el azul se reserva a lo interactivo) */}
            <span style={{ fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
              {error || rankShown === null ? '—' : rankShown}
            </span>
            {!error && rankShown !== null && totalEntidades > 0 && (
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>de {totalEntidades}</span>
            )}
          </span>
          {!error && rankShown !== null && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{periodLabel}</span>
          )}
          {entidadesEnCero && !loading && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{sinDatos.short}</span>
          )}
        </div>
        {/* El total lleva la cifra larga: tarjeta más ancha que la del lugar (siempre corta) */}
        <div className="card kpi-card" style={{ flex: 1.6, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', padding: '0.85rem 1rem', position: 'relative', minWidth: 0 }}>
          {loading && <LoadingSpinner size="sm" />}
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeIncidenceLabel}{metricType === 'rate' ? ' · tasa' : ''}
          </span>
          <span
            title={totalIsND ? 'Sin población CONAPO para calcular la tasa en este periodo' : undefined}
            className="tabular kpi-value"
            style={{ '--chars': String(error || totalIncidencia === null || sinPublicar ? '—' : formatNumber(totalIncidencia)).length, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1.1, letterSpacing: '-0.02em' }}
          >
            {error || totalIncidencia === null || sinPublicar ? '—' : formatNumber(totalIncidencia)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {totalIsND && !error ? 'Sin población CONAPO para la tasa' : sinPublicar ? 'Sin datos publicados' : periodLabel}
          </span>
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
              type="button"
              className="card-icon-btn"
              title="Ver en pantalla completa"
              aria-label="Ver en pantalla completa"
              ref={fsTriggerRef}
              onClick={() => setFsOpen(true)}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="card-period" style={{ padding: '0 1rem 0.35rem' }}>{periodLabel}</div>
        {/* Table Header */}
        <div style={{ padding: isVictimas ? '1rem 1rem 0.5rem' : '0 1rem 0.5rem', borderBottom: '2px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 80px', gap: '0.5rem', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.875rem' }}>
            <span>#</span>
            <span style={{ transition: 'opacity 0.2s' }}>{colLabel}</span>
            <span style={{ textAlign: 'right' }}>{valLabel}</span>
          </div>
        </div>

        {/* Table Rows */}
        <div className="sidebar-table-rows" style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0', position: 'relative', minHeight: '140px' }}>
          {error ? (
            <EmptyState variant="error" onRetry={() => setRetryKey(k => k + 1)} />
          ) : (rows.length === 0 && !loading) ? (
            <EmptyState />
          ) : tablaEnCero ? (
            <EmptyState title={sinDatos.title} detail={sinDatos.detail} />
          ) : visibleRows.map((m) => {
            const level = rowHighlight(m, isEntidades, activeEntityName, selectedMunicipio, entidadFiltrada);
              const hl = level === 'strong';
            // Con una entidad elegida no se repite ", Sonora"; en Nacional se muestra "Municipio, Entidad"
            const displayName = (isEntidades || !entidadFiltrada) ? m.name : (m.municipio || m.name);
            return (
              <div
                key={`${tableView}-${m.name}-${m.id}`}
                aria-current={hl ? 'true' : undefined}
                data-highlight={level || undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '30px 1fr 80px',
                  gap: '0.5rem',
                  alignItems: 'center',
                  padding: '0.45rem 1rem',
                  fontSize: '0.875rem',
                  backgroundColor: hl ? '#e3e8f3' : (level === 'soft' ? '#e9edf6' : 'transparent'),
                  color: level ? 'var(--color-accent-dark)' : 'var(--color-primary)',
                  borderBottom: '1px solid var(--border-color)',
                  fontWeight: hl ? 700 : 400,
                }}
              >
                <span className="tabular" style={{ color: hl ? 'var(--color-accent-dark)' : 'var(--text-secondary)', fontWeight: hl ? 700 : 500 }}>
                  {m.id}
                </span>
                <span title={m.name} style={{ fontWeight: hl ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
                <span
                  className="tabular"
                  style={{
                    textAlign: 'right',
                    fontWeight: hl ? 700 : 600,
                    padding: '2px 4px',
                  }}
                >
                  {formatNumber(m.value)}
                </span>
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 && !error && !tablaEnCero && (
          <button type="button" className="table-more-btn" onClick={() => setShowAllRows(true)}>
            Ver todos ({rows.length})
          </button>
        )}
        {isNarrow && showAllRows && rows.length > MOBILE_ROWS && !error && !tablaEnCero && (
          <button type="button" className="table-more-btn" onClick={() => setShowAllRows(false)}>
            Ver solo los primeros {MOBILE_ROWS}
          </button>
        )}
      </div>
      </>)}
      {overlay}
    </>
  );
};

export default SidebarLeft;

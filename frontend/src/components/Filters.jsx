import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useId, useContext } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { ALTO_IMPACTO_PRESETS, parseCapsule } from '../utils/altoImpacto';
import AltoImpactoModal from './AltoImpactoModal';
import { mesesResumen, RATE_LABEL } from '../utils/labels';
import { MesFinalContext } from '../utils/mesFinalContext';
import { PREFERS_REDUCED_MOTION } from '../utils/motion';
import { useExitAnimation } from '../utils/useExitAnimation';
import MonthStrip from './MonthStrip';


const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const uid = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const masterCheckboxRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const safeSelected = Array.isArray(selected) ? selected : [];
  const safeOptions = Array.isArray(options) ? options : [];
  
  const filteredOptions = safeOptions.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const visibleSelectedCount = filteredOptions.filter(opt => safeSelected.includes(opt)).length;
  const isAllVisibleSelected = filteredOptions.length > 0 && visibleSelectedCount === filteredOptions.length;
  const isIndeterminate = visibleSelectedCount > 0 && visibleSelectedCount < filteredOptions.length;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleToggle = (opt) => {
    if (safeSelected.includes(opt)) {
      onChange(safeSelected.filter(item => item !== opt));
    } else {
      onChange([...safeSelected, opt]);
    }
  };

  const handleMasterChange = () => {
    if (isAllVisibleSelected) {
      onChange(safeSelected.filter(opt => !filteredOptions.includes(opt)));
    } else {
      const nextSelected = [...new Set([...safeSelected, ...filteredOptions])];
      onChange(nextSelected);
    }
  };

  const handleLimpiar = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  let displayText = "Todos";
  if (safeSelected.length > 0 && safeSelected.length < safeOptions.length) {
    if (safeSelected.length <= 3) {
      displayText = safeSelected.join(', ');
    } else {
      displayText = `${safeSelected.slice(0, 3).join(', ')} ... +${safeSelected.length - 3}`;
    }
  }

  return (
    <div style={{ position: 'relative', flex: '1 1 min(100%, 180px)' }} ref={containerRef}>
      <label className="label-sm" id={`${uid}-label`} htmlFor={`${uid}-trigger`}>{label}</label>
      <button
        type="button"
        id={`${uid}-trigger`}
        className="input-select"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${uid}-label ${uid}-trigger`}
        style={{ cursor: 'pointer', userSelect: 'none', minHeight: 'var(--input-min-height, 30px)', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}
        onClick={() => setIsOpen(!isOpen)}
        title={displayText}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayText}</span>
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label={`Opciones de ${label}`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              document.getElementById(`${uid}-trigger`)?.focus();
            }
          }}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            minWidth: '220px',
            backgroundColor: 'white', border: '1px solid var(--border-color)',
            borderRadius: '8px', marginTop: '4px', zIndex: 100,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '350px'
          }}
        >
          {/* Sección Fija Superior */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 10,
            backgroundColor: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)',
            borderTopLeftRadius: '8px', borderTopRightRadius: '8px',
            padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'
          }}>
            <input
              type="search"
              autoFocus
              aria-label={`Buscar en ${label}`}
              placeholder="Buscar opciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '0.45rem 0.55rem',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                fontSize: '0.8125rem'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  ref={masterCheckboxRef}
                  checked={isAllVisibleSelected}
                  onChange={handleMasterChange}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>Seleccionar todo</span>
              </label>

              <button
                type="button"
                onClick={handleLimpiar}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-accent)',
                  fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 700, padding: '2px 4px'
                }}
              >
                Limpiar
              </button>
            </div>

            <div className="tabular" aria-live="polite" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {safeSelected.length} de {safeOptions.length} seleccionados
            </div>
          </div>

          {/* Contenedor Scrolleable de Opciones */}
          <div role="group" aria-label={label} style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                Ninguna opción coincide con “{searchTerm}”
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSel = safeSelected.includes(opt);
                return (
                  <label
                    key={opt}
                    title={opt}
                    style={{
                      padding: '0.55rem 0.75rem', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: '0.5rem',
                      background: isSel ? 'var(--color-accent-light)' : 'white',
                      borderBottom: '1px solid var(--border-color)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => handleToggle(opt)}
                      style={{ cursor: 'pointer', accentColor: 'var(--color-accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Utilidad: contar diferencias entre selectedFilters y appliedFilters ─────────
function countPendingChanges(selected, applied) {
  if (!applied) return 0;
  let count = 0;
  if (selected.anio !== applied.anio) count++;
  if (selected.entidad !== applied.entidad) count++;
  if (selected.municipio !== applied.municipio) count++;

  const arrayFields = ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'meses', 'sexo', 'rangoEdad', 'altoImpacto'];
  for (const field of arrayFields) {
    const a = Array.isArray(selected[field]) ? selected[field] : [];
    const b = Array.isArray(applied[field]) ? applied[field] : [];
    if (a.length !== b.length || a.some(v => !b.includes(v))) count++;
  }
  return count;
}

const isVictimasDataset = (d) => d === 'victimas' || d === 'victimas_mun';

// Tiempos del plegado (en sync con .filters-collapse de index.css): al plegar primero se desvanece el
// contenido (120ms) y luego se cierra la fila (200ms); al abrir, la fila crece y el contenido aparece
const FILAS_MS = 200;
const FUNDIDO_MS = 120;
const PLEGADO_TOTAL_MS = FILAS_MS + FUNDIDO_MS;

// Categorías del detalle de filtros aplicados (orden del popover: de lo general a lo específico)
const GRUPOS_DELITO = [
  ['bienJuridico', 'Bien jurídico'],
  ['tipoDelito', 'Tipo'],
  ['subtipoDelito', 'Subtipo'],
  ['modalidad', 'Modalidad'],
  ['sexo', 'Sexo'],
  ['rangoEdad', 'Rango de edad'],
];
// Orden de los nombres en la línea plegada: primero lo más específico
const ORDEN_NOMBRES = ['subtipoDelito', 'tipoDelito', 'modalidad', 'bienJuridico', 'sexo', 'rangoEdad'];
// Dos nombres en la línea solo si juntos no pasan de este largo; si no, uno + "+N"
const MAX_DOS_NOMBRES = 34;
// Retraso del hover (solo ratón) antes de abrir el detalle, y gracia al salir
const HOVER_ABRIR_MS = 300;
const HOVER_CERRAR_MS = 150;
const puedeHover = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; }
};

// ── Detalle de filtros aplicados: botón con los nombres + popover agrupado por categoría ─────────
// Abre con clic/toque/Enter; con ratón también por hover tras 300ms. Cierra con Escape, clic fuera o
// al salir el foco. Posición fija (no lo recorta la elipsis del resumen) y acotada a la ventana.
const DetalleFiltros = ({ nombres, extra, grupos, onEditar }) => {
  const [abierto, setAbierto] = useState(false);
  const { mounted, closing } = useExitAnimation(abierto, 100);
  const modoRef = useRef('click'); // 'hover' (abierto por hover, cierra al salir) | 'click' (fijo)
  const trigRef = useRef(null);
  const popRef = useRef(null);
  const tHoverRef = useRef(null);
  const tCerrarRef = useRef(null);
  const popId = useId();

  const limpiarTimers = () => {
    clearTimeout(tHoverRef.current);
    clearTimeout(tCerrarRef.current);
  };
  const abrir = (modo) => {
    limpiarTimers();
    modoRef.current = modo;
    setAbierto(true);
  };
  const cerrar = (devolverFoco = false) => {
    limpiarTimers();
    setAbierto(false);
    if (devolverFoco) trigRef.current?.focus({ preventScroll: true });
  };
  useEffect(() => () => limpiarTimers(), []);

  // Posición: debajo del botón (arriba si no cabe), recortada a la ventana con 8px de margen.
  // El origen de la escala apunta al botón (entra "desde" él).
  useLayoutEffect(() => {
    if (!mounted) return undefined;
    const colocar = () => {
      const t = trigRef.current;
      const p = popRef.current;
      if (!t || !p) return;
      const r = t.getBoundingClientRect();
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      const M = 8;
      let top = r.bottom + 6;
      let arriba = false;
      if (top + h > window.innerHeight - M && r.top - 6 - h >= M) {
        top = r.top - 6 - h;
        arriba = true;
      }
      const left = Math.min(Math.max(M, r.left), Math.max(M, window.innerWidth - w - M));
      const origenX = Math.min(Math.max(0, r.left + r.width / 2 - left), w);
      p.style.top = `${Math.round(top)}px`;
      p.style.left = `${Math.round(left)}px`;
      p.style.transformOrigin = `${Math.round(origenX)}px ${arriba ? '100%' : '0'}`;
    };
    colocar();
    window.addEventListener('resize', colocar);
    window.addEventListener('scroll', colocar, true);
    return () => {
      window.removeEventListener('resize', colocar);
      window.removeEventListener('scroll', colocar, true);
    };
  }, [mounted, grupos]);

  // Abierto: clic/toque fuera o Escape lo cierran. Escape con preventDefault (fase de captura en window)
  // para que los diálogos y la pantalla completa lo ignoren
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarAqui = () => {
      clearTimeout(tHoverRef.current);
      clearTimeout(tCerrarRef.current);
      setAbierto(false);
    };
    const fuera = (e) => {
      if (trigRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      cerrarAqui();
    };
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      const act = document.activeElement;
      const devolver = act === trigRef.current || !!popRef.current?.contains(act);
      cerrarAqui();
      if (devolver) trigRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', fuera, true);
    window.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', fuera, true);
      window.removeEventListener('keydown', esc, true);
    };
  }, [abierto]);

  // El foco salió del botón y del popover: se cierra (salvo si lo abrió el hover, que cierra al salir)
  const alPerderFoco = (e) => {
    const sig = e.relatedTarget;
    if (sig && (trigRef.current?.contains(sig) || popRef.current?.contains(sig))) return;
    if (modoRef.current === 'hover') return;
    cerrar();
  };
  // Hover con ratón: abre tras 300ms; al salir del botón y del popover cierra con una breve gracia
  const entrarHover = (e) => {
    if (e.pointerType !== 'mouse' || !puedeHover()) return;
    clearTimeout(tCerrarRef.current);
    if (!abierto) tHoverRef.current = setTimeout(() => abrir('hover'), HOVER_ABRIR_MS);
  };
  const salirHover = (e) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(tHoverRef.current);
    if (abierto && modoRef.current === 'hover') {
      tCerrarRef.current = setTimeout(() => setAbierto(false), HOVER_CERRAR_MS);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={trigRef}
        className="filters-detail-btn"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={mounted ? popId : undefined}
        onClick={(e) => {
          // No abre ni pliega el panel. Si lo abrió el hover, el clic lo fija
          e.stopPropagation();
          if (abierto && modoRef.current === 'click') cerrar();
          else abrir('click');
        }}
        onPointerEnter={entrarHover}
        onPointerLeave={salirHover}
        onBlur={alPerderFoco}
      >
        <span className="filters-detail-names">{nombres}</span>
        {extra > 0 && <span className="filters-detail-more tabular">+{extra}</span>}
        <span className="sr-only">, ver filtros aplicados</span>
      </button>
      {mounted && (
        <div
          ref={popRef}
          id={popId}
          role="dialog"
          aria-label="Filtros aplicados"
          tabIndex={-1}
          className={`filters-pop${closing ? ' is-closing' : ''}`}
          onClick={(e) => e.stopPropagation()}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') clearTimeout(tCerrarRef.current); }}
          onPointerLeave={salirHover}
          onBlur={alPerderFoco}
        >
          {grupos.map(g => (
            <div key={g.label} className="filters-pop-group">
              <div className="filters-pop-label">{g.label}</div>
              <ul className="filters-pop-list">
                {g.values.map(v => <li key={v}>{v}</li>)}
              </ul>
            </div>
          ))}
          <button
            type="button"
            className="filters-pop-edit"
            onClick={() => { cerrar(); onEditar(); }}
          >
            Editar filtros
          </button>
        </div>
      )}
    </>
  );
};

// ── Filters Component ──────────────────────────────────────────────────────────
const Filters = ({ dataset, metricType, setMetricType, selectedFilters, setSelectedFilters, appliedFilters, onApply, onClear, onInitialLoadComplete, customCapsules, onAddCustomCapsule, onRemoveCustomCapsule, onOpenChange }) => {
  const isAltoImpacto = dataset === 'alto_impacto';
  const wireDataset = isAltoImpacto ? 'delitos' : dataset;
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  // Panel de filtros plegable: inicia plegado (escritorio y celular) mostrando la línea de resumen;
  // "Aplicar filtros" lo vuelve a plegar. Cambiar de dataset o "Limpiar filtros" no lo pliegan.
  const [isOpen, setIsOpen] = useState(false);
  // Recorte del contenido: activo plegado y durante la apertura; al terminar se quita para que los
  // menús desplegables (posición absoluta) no queden cortados
  const [recortar, setRecortar] = useState(true);
  const toggleRef = useRef(null);
  const enfocarToggleRef = useRef(false);
  const mesFinalCtx = useContext(MesFinalContext);
  // onOpenChange puede cambiar de identidad en cada render del padre
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => { onOpenChangeRef.current = onOpenChange; }, [onOpenChange]);

  const plegar = (enfocar = false) => {
    setIsOpen(false);
    setRecortar(true);
    enfocarToggleRef.current = enfocar;
  };
  const abrir = () => {
    // Avisa al tablero antes de que el panel crezca: la cuadrícula conserva su alto y la página se desplaza
    onOpenChangeRef.current?.(true);
    setIsOpen(true);
    setRecortar(!PREFERS_REDUCED_MOTION);
  };

  // Fin de la apertura: se quita el recorte al terminar de crecer la fila (transitionend); el temporizador
  // es solo respaldo por si el evento no llega
  useEffect(() => {
    if (!isOpen || !recortar) return undefined;
    const t = setTimeout(() => setRecortar(false), FILAS_MS + 400);
    return () => clearTimeout(t);
  }, [isOpen, recortar]);
  const alTerminarTransicion = (e) => {
    if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows' && isOpen) setRecortar(false);
  };

  // Al plegar, el tablero recupera su alto fijo solo al terminar la animación (la cuadrícula no cambia
  // de alto a media transición y las gráficas no se redimensionan)
  useEffect(() => {
    if (isOpen) return undefined;
    const t = setTimeout(() => onOpenChangeRef.current?.(false), PREFERS_REDUCED_MOTION ? 0 : PLEGADO_TOTAL_MS + 20);
    return () => clearTimeout(t);
  }, [isOpen]);
  useEffect(() => () => onOpenChangeRef.current?.(false), []);

  // Tras aplicar, el botón queda dentro del contenido inerte: el foco pasa a la línea de resumen
  useEffect(() => {
    if (!isOpen && enfocarToggleRef.current) {
      enfocarToggleRef.current = false;
      toggleRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  // Aplicar pliega el panel; cambiar de dataset o "Limpiar filtros" no lo pliegan
  const handleApplyClick = () => {
    onApply();
    plegar(true);
  };
  // Grupo secundario "Delito": plegable, abierto por defecto; recuerda la preferencia
  const [isDelitoOpen, setIsDelitoOpen] = useState(() => {
    try { return localStorage.getItem('filters.delitoOpen') !== '0'; } catch { return true; }
  });
  const toggleDelito = () => setIsDelitoOpen(v => {
    try { localStorage.setItem('filters.delitoOpen', v ? '0' : '1'); } catch { /* noop */ }
    return !v;
  });
  const activeDelitoCount = ['bienJuridico', 'tipoDelito', 'subtipoDelito', 'modalidad', 'sexo', 'rangoEdad']
    .reduce((n, k) => n + (Array.isArray(selectedFilters[k]) && selectedFilters[k].length > 0 ? 1 : 0), 0);
  const [filtrosOpciones, setFiltrosOpciones] = useState({
    anios: [],
    entidades: [],
    bienesJuridicos: [],
    tiposDelito: [],
    subtiposDelito: [],
    modalidades: [],
    municipios: [],
    sexos: [],
    rangosEdad: []
  });

  // Cantidad de filtros pendientes de aplicar
  const pendingCount = countPendingChanges(selectedFilters, appliedFilters);

  // Resumen de los filtros APLICADOS en la línea plegada:
  // "Filtros · 2026 · Sonora · Todos los municipios · Ene–Ago" + detalle de delito ("Robo a casa
  // habitación +4") con popover. La métrica no va en el texto: la línea trae su conmutador compacto.
  // Memoizado: `grupos` conserva su identidad entre renders y el popover no se recoloca en cada uno.
  const appliedSummary = useMemo(() => {
    const a = appliedFilters || {};
    const ds = a.dataset || dataset;
    const nacional = !a.entidad || a.entidad === 'All';
    const ent = nacional ? 'Nacional' : a.entidad;
    let mun = null;
    if (ds !== 'victimas' && !nacional) {
      mun = a.municipio && a.municipio !== 'All'
        ? String(a.municipio).replace(`, ${a.entidad}`, '') : 'Todos los municipios';
    }
    // El último mes publicado (contexto) corresponde siempre a lo aplicado
    const meses = mesesResumen(a.meses, mesFinalCtx);
    const lista = (k) => (Array.isArray(a[k]) ? a[k] : []);
    let nombres = [];
    let grupos = [];
    let sinDelitos = null; // texto sin detalle (alto impacto sin delitos elegidos)
    if (ds === 'alto_impacto') {
      nombres = lista('altoImpacto').map(t => parseCapsule(t).name);
      if (nombres.length > 0) grupos = [{ label: 'Delitos de alto impacto', values: nombres }];
      else sinDelitos = 'Ningún delito de alto impacto';
    } else {
      // Sexo y Rango de edad solo existen en víctimas (en delitos siempre van vacíos)
      nombres = ORDEN_NOMBRES.flatMap(lista);
      grupos = GRUPOS_DELITO
        .filter(([k]) => lista(k).length > 0)
        .map(([k, label]) => ({ label, values: lista(k) }));
    }
    // En la línea: uno o dos nombres (si caben) y "+N" con el resto
    const dos = nombres.length >= 2 && nombres[0].length + nombres[1].length <= MAX_DOS_NOMBRES;
    const visibles = nombres.slice(0, dos ? 2 : 1);
    return {
      texto: ['Filtros', a.anio, ent, mun, meses].filter(Boolean).join(' · '),
      detalle: nombres.length > 0 ? { nombres: visibles.join(', '), extra: nombres.length - visibles.length, grupos } : null,
      sinDelitos,
    };
  }, [appliedFilters, dataset, mesFinalCtx]);

  // ── Efecto 1: Opciones base (año, entidad, bien jurídico) — solo al aplicar filtros
  useEffect(() => {
    const controller = new AbortController();

    const params = { dataset: wireDataset };
    if (appliedFilters.anio !== null) params.anio = appliedFilters.anio;
    if (appliedFilters.entidad !== "All") params.entidad = appliedFilters.entidad;
    if (appliedFilters.sexo && appliedFilters.sexo.length > 0) params.sexo = appliedFilters.sexo.join('|');
    if (appliedFilters.rangoEdad && appliedFilters.rangoEdad.length > 0) params.rangoEdad = appliedFilters.rangoEdad.join('|');

    axios.get(`${API_URL}/api/filtros`, { params, signal: controller.signal })
      .then(res => {
        if (res.data) {
          setFiltrosOpciones(prev => ({
            ...prev,
            anios: res.data.anios || [],
            entidades: res.data.entidades || [],
            bienesJuridicos: res.data.bienesJuridicos || [],
            sexos: res.data.sexos || [],
            rangosEdad: res.data.rangosEdad || []
          }));

          // Solo inicializar el año si está en null (PublicDashboard ya lo fija al año más reciente)
          setSelectedFilters(prev => {
            if (prev.anio === null && res.data.anios && res.data.anios.length > 0) {
              return { ...prev, anio: Math.max(...res.data.anios) };
            }
            return prev;
          });

          if (onInitialLoadComplete) {
            onInitialLoadComplete();
          }
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error fetching filtros base", err);
        if (onInitialLoadComplete) {
          onInitialLoadComplete();
        }
      });

    return () => controller.abort();
  }, [appliedFilters, dataset]);

  // ── Efecto 2: Cascada en tiempo real para tipo/subtipo/modalidad/sexo/rango
  // Se dispara al cambiar bien jurídico, tipo o subtipo en selectedFilters.
  // NO afecta los datos del dashboard (esos solo reaccionan a appliedFilters).
  useEffect(() => {
    const controller = new AbortController();

    const params = { dataset: wireDataset };
    if (selectedFilters.anio !== null) params.anio = selectedFilters.anio;
    if (selectedFilters.entidad !== "All") params.entidad = selectedFilters.entidad;

    const bj = Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : [];
    const td = Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : [];
    const sd = Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : [];
    const sx = Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : [];
    const re = Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : [];

    if (bj.length > 0) params.bienJuridico = bj.join('|');
    if (td.length > 0) params.tipoDelito = td.join('|');
    if (sd.length > 0) params.subtipoDelito = sd.join('|');
    if (sx.length > 0) params.sexo = sx.join('|');
    if (re.length > 0) params.rangoEdad = re.join('|');

    axios.get(`${API_URL}/api/filtros`, { params, signal: controller.signal })
      .then(res => {
        if (res.data) {
          setFiltrosOpciones(prev => ({
            ...prev,
            tiposDelito: res.data.tiposDelito || [],
            subtiposDelito: res.data.subtiposDelito || [],
            modalidades: res.data.modalidades || [],
            municipios: res.data.municipios || [],
            sexos: res.data.sexos || [],
            rangosEdad: res.data.rangosEdad || []
          }));

          // Limpiar selecciones que ya no son válidas con el nuevo contexto
          setSelectedFilters(prev => {
            const curTd = Array.isArray(prev.tipoDelito) ? prev.tipoDelito : [];
            const curSd = Array.isArray(prev.subtipoDelito) ? prev.subtipoDelito : [];
            const curMo = Array.isArray(prev.modalidad) ? prev.modalidad : [];
            const curSx = Array.isArray(prev.sexo) ? prev.sexo : [];
            const curRe = Array.isArray(prev.rangoEdad) ? prev.rangoEdad : [];

            const availTd = res.data.tiposDelito || [];
            const availSd = res.data.subtiposDelito || [];
            const availMo = res.data.modalidades || [];
            const availSx = res.data.sexos || [];
            const availRe = res.data.rangosEdad || [];

            const filteredTd = curTd.filter(v => availTd.includes(v));
            const filteredSd = curSd.filter(v => availSd.includes(v));
            const filteredMo = curMo.filter(v => availMo.includes(v));
            const filteredSx = curSx.filter(v => availSx.includes(v));
            const filteredRe = curRe.filter(v => availRe.includes(v));

            if (
              filteredTd.length !== curTd.length ||
              filteredSd.length !== curSd.length ||
              filteredMo.length !== curMo.length ||
              filteredSx.length !== curSx.length ||
              filteredRe.length !== curRe.length
            ) {
              return { 
                ...prev, 
                tipoDelito: filteredTd, 
                subtipoDelito: filteredSd, 
                modalidad: filteredMo,
                sexo: filteredSx,
                rangoEdad: filteredRe
              };
            }
            return prev;
          });
        }
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Error fetching filtros en cascada", err);
      });

    return () => controller.abort();
  }, [
    selectedFilters.bienJuridico,
    selectedFilters.tipoDelito,
    selectedFilters.subtipoDelito,
    selectedFilters.sexo,
    selectedFilters.rangoEdad,
    selectedFilters.anio,
    selectedFilters.entidad,
    dataset
  ]);

  const handleChange = (filterName, value) => {
    setSelectedFilters(prev => {
      const nextFilters = {
        ...prev,
        [filterName]: filterName === 'anio' ? parseInt(value) : value
      };
      if (filterName === 'entidad') {
        nextFilters.municipio = 'All';
      }
      return nextFilters;
    });
  };

  return (
    <div className="filters-panel" data-open={isOpen}>
      {/* Línea de resumen. Con ratón, un clic en cualquier parte libre abre/pliega el panel; el control
          accesible es el botón "Editar filtros". El detalle de delitos y la métrica compacta son
          controles aparte (no anidados en un botón) y detienen la propagación del clic. */}
      <div className="filters-toggle" onClick={() => (isOpen ? plegar() : abrir())}>
        <div className="filters-toggle-summary">
          <span className="filters-toggle-text">{appliedSummary.texto}</span>
          {appliedSummary.detalle && (
            <>
              <span className="filters-toggle-sep" aria-hidden="true">·</span>
              <DetalleFiltros
                nombres={appliedSummary.detalle.nombres}
                extra={appliedSummary.detalle.extra}
                grupos={appliedSummary.detalle.grupos}
                onEditar={() => {
                  if (!isOpen) abrir();
                  toggleRef.current?.focus({ preventScroll: true });
                }}
              />
            </>
          )}
          {appliedSummary.sinDelitos && (
            <span className="filters-toggle-tail"> · {appliedSummary.sinDelitos}</span>
          )}
          {pendingCount > 0 && <span className="filters-toggle-pending filters-toggle-tail"> · {pendingCount} sin aplicar</span>}
        </div>
        <div className="filters-toggle-controls">
          {/* Métrica compacta (solo plegado): mismo estado que el conmutador del panel; se aplica al instante */}
          {!isOpen && (
            <div
              className="btn-toggle filters-toggle-metric"
              role="group"
              aria-label="Métrica (se aplica al instante)"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-pressed={metricType === 'absolute'}
                aria-label="Cifras absolutas"
                title="Cifras absolutas · se aplica al instante"
                className={metricType === 'absolute' ? 'active' : ''}
                onClick={() => setMetricType('absolute')}
              >
                Cifras
              </button>
              <button
                type="button"
                aria-pressed={metricType === 'rate'}
                aria-label={RATE_LABEL}
                title={`${RATE_LABEL} · se aplica al instante`}
                className={metricType === 'rate' ? 'active' : ''}
                onClick={() => setMetricType('rate')}
              >
                Tasa
              </button>
            </div>
          )}
          <button
            type="button"
            ref={toggleRef}
            className="filters-toggle-action"
            aria-label={isOpen ? 'Ocultar filtros' : 'Editar filtros'}
            aria-expanded={isOpen}
            aria-controls="filters-body"
            onClick={(e) => { e.stopPropagation(); if (isOpen) plegar(); else abrir(); }}
          >
            {/* Palabras como elementos flex separados por gap (el espacio no se recorta) */}
            <span>{isOpen ? 'Ocultar' : 'Editar'}</span>
            <span className="filters-toggle-action-long">filtros</span>
            {/* Un solo chevrón: gira 180° con el panel abierto */}
            <svg className="filters-toggle-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Plegado con grid-template-rows 0fr ↔ 1fr; plegado = inerte (sin foco ni lector de pantalla) */}
      <div className="filters-collapse" data-open={isOpen} data-clip={recortar} onTransitionEnd={alTerminarTransicion}>
      <div className="filters-collapse-inner" inert={!isOpen}>
      <div id="filters-body" className="filters-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--filters-select-gap, 1.5rem)', flexWrap: 'wrap' }}>
        
        {/* Contenedor principal de Filtros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--filters-row-gap, 1.25rem)', flex: '1 1 auto', minWidth: '0' }}>
          
          {/* Fila 1: Filtros Principales (Territoriales y Temporales) */}
          <div style={{ display: 'flex', gap: 'var(--filters-select-gap, 1rem)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px', maxWidth: '200px' }}>
              <label className="label-sm">Año</label>
              <select className="input-select" value={selectedFilters.anio || ""} onChange={e => handleChange('anio', e.target.value)}>
                {filtrosOpciones.anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            
            <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
              <label className="label-sm">Entidad</label>
              <select className="input-select" value={selectedFilters.entidad} onChange={e => handleChange('entidad', e.target.value)}>
                <option value="All">Nacional</option>
                {filtrosOpciones.entidades.map(e_name => <option key={e_name} value={e_name}>{e_name}</option>)}
              </select>
            </div>
            
            {dataset !== 'victimas' && (
              <div style={{ flex: '1 1 200px', maxWidth: '300px' }}>
                <label className="label-sm">Municipio</label>
                <select 
                  className="input-select" 
                  value={selectedFilters.municipio || "All"} 
                  onChange={e => handleChange('municipio', e.target.value)}
                  disabled={selectedFilters.entidad === 'All'}
                >
                  {selectedFilters.entidad === 'All' ? (
                    <option value="All">Seleccione una entidad</option>
                  ) : (
                    <>
                      <option value="All">Todos los municipios</option>
                      {(filtrosOpciones.municipios || []).map(m_name => (
                        <option key={m_name} value={m_name}>{m_name}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Fila 2: Filtros Categóricos y Dependientes (o cápsulas en alto impacto) */}
          {isAltoImpacto ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="label-sm">Delitos de alto impacto</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(() => {
                  const active = Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : [];
                  const customs = Array.isArray(customCapsules) ? customCapsules : [];
                  const tokens = [...ALTO_IMPACTO_PRESETS, ...customs.filter(t => !ALTO_IMPACTO_PRESETS.includes(t))];
                  return tokens.map(token => {
                    const parsed = parseCapsule(token);
                    const isActive = active.includes(token);
                    return (
                      <button
                        key={token}
                        onClick={() => {
                          setSelectedFilters(prev => {
                            const cur = Array.isArray(prev.altoImpacto) ? prev.altoImpacto : [];
                            return {
                              ...prev,
                              altoImpacto: cur.includes(token) ? cur.filter(t => t !== token) : [...cur, token]
                            };
                          });
                        }}
                        type="button"
                        aria-pressed={isActive}
                        title={parsed.isCustom ? `Personalizado: ${token.slice(0, 120)}` : token}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: isActive ? 700 : 500,
                          borderRadius: '999px', cursor: 'pointer', transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 120ms cubic-bezier(0.23, 1, 0.32, 1)',
                          border: isActive ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                          background: isActive ? 'var(--color-accent)' : '#ffffff',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)'
                        }}
                      >
                        {parsed.name}
                        {parsed.isCustom && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRemoveCustomCapsule) onRemoveCustomCapsule(token);
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Eliminar ${parsed.name}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onRemoveCustomCapsule) onRemoveCustomCapsule(token);
                              }
                            }}
                            title="Eliminar cápsula"
                            style={{ fontWeight: 700, marginLeft: '0.15rem', lineHeight: 1 }}
                          >
                            ×
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
                <button
                  onClick={() => setIsCustomModalOpen(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
                    borderRadius: '999px', cursor: 'pointer',
                    border: '1px dashed var(--color-accent)', background: 'transparent',
                    color: 'var(--color-accent)'
                  }}
                >
                  + Agregar delito
                </button>
              </div>
            </div>
          ) : (
          <div className="filters-group" data-open={isDelitoOpen}>
            <button
              type="button"
              className="filters-group-toggle"
              aria-expanded={isDelitoOpen}
              aria-controls="filters-group-delito"
              onClick={toggleDelito}
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)', transform: isDelitoOpen ? 'none' : 'rotate(-90deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
              {isVictimasDataset(dataset) ? 'Delito y víctima' : 'Delito'}
              {activeDelitoCount > 0 && (
                <span className="filters-group-count tabular">{activeDelitoCount} {activeDelitoCount === 1 ? 'filtro activo' : 'filtros activos'}</span>
              )}
            </button>
          {isDelitoOpen && (
          <div id="filters-group-delito" style={{ display: 'flex', gap: 'var(--filters-select-gap, 1rem)', flexWrap: 'wrap' }}>
            <MultiSelectDropdown
              label="Bien jurídico afectado"
              options={filtrosOpciones.bienesJuridicos}
              selected={Array.isArray(selectedFilters.bienJuridico) ? selectedFilters.bienJuridico : []}
              onChange={(val) => handleChange('bienJuridico', val)}
            />
            <MultiSelectDropdown
              label="Tipo de delito"
              options={filtrosOpciones.tiposDelito}
              selected={Array.isArray(selectedFilters.tipoDelito) ? selectedFilters.tipoDelito : []}
              onChange={(val) => handleChange('tipoDelito', val)}
            />
            <MultiSelectDropdown
              label="Subtipo de delito"
              options={filtrosOpciones.subtiposDelito}
              selected={Array.isArray(selectedFilters.subtipoDelito) ? selectedFilters.subtipoDelito : []}
              onChange={(val) => handleChange('subtipoDelito', val)}
            />
            <MultiSelectDropdown
              label="Modalidad"
              options={filtrosOpciones.modalidades}
              selected={Array.isArray(selectedFilters.modalidad) ? selectedFilters.modalidad : []}
              onChange={(val) => handleChange('modalidad', val)}
            />
            {(dataset === 'victimas' || dataset === 'victimas_mun') && (
              <>
                <MultiSelectDropdown
                  label="Sexo"
                  options={filtrosOpciones.sexos}
                  selected={Array.isArray(selectedFilters.sexo) ? selectedFilters.sexo : []}
                  onChange={(val) => handleChange('sexo', val)}
                />
                <MultiSelectDropdown
                  label="Rango de edad"
                  options={filtrosOpciones.rangosEdad}
                  selected={Array.isArray(selectedFilters.rangoEdad) ? selectedFilters.rangoEdad : []}
                  onChange={(val) => handleChange('rangoEdad', val)}
                />
              </>
            )}
          </div>
          )}
          </div>
          )}
        </div>

        {/* Controles de Acción (Alineados a la derecha) */}
        <div className="filters-controls-right" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--filters-gap, 1rem)', alignItems: 'flex-end', flexShrink: 0 }}>
          {/* Métrica: se aplica al instante, separada del grupo Limpiar/Aplicar */}
          <div className="filters-metric" role="group" aria-label="Métrica" aria-describedby="filters-metric-hint">
          <div className="btn-toggle" style={{ display: 'flex' }} title="Se aplica al instante">
            <button
              type="button"
              aria-pressed={metricType === 'absolute'}
              className={metricType === 'absolute' ? 'active' : ''}
              onClick={() => setMetricType('absolute')}
            >
              Cifras absolutas
            </button>
            <button
              type="button"
              aria-pressed={metricType === 'rate'}
              className={metricType === 'rate' ? 'active' : ''}
              onClick={() => setMetricType('rate')}
            >
              {RATE_LABEL}
            </button>
          </div>
          <span id="filters-metric-hint" className="filters-metric-hint">Se aplica al instante</span>
          </div>

          <div className="filters-actions">
            <button
              type="button"
              className="filters-btn"
              id="btn-limpiar-filtros"
              onClick={onClear}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 1rem', fontSize: '0.875rem', fontWeight: 600,
                borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)',
                cursor: 'pointer', transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
                background: 'white', color: 'var(--text-secondary, #64748b)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = 'var(--text-secondary, #64748b)'; e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)'; }}
            >
              Limpiar filtros
            </button>

            <button
              type="button"
              className="filters-btn"
              id="btn-aplicar-filtros"
              onClick={handleApplyClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 1.1rem', fontSize: '0.875rem', fontWeight: 600,
                borderRadius: '8px', border: 'none', cursor: 'pointer',
                transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
                background: pendingCount > 0 ? 'var(--color-accent, #2563eb)' : 'var(--bg-main, #f1f5f9)',
                color: pendingCount > 0 ? '#fff' : 'var(--text-secondary, #64748b)',
                boxShadow: pendingCount > 0 ? '0 4px 12px rgba(69,89,147,0.30)' : 'none'
              }}
              onMouseEnter={e => { if (pendingCount > 0) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              Aplicar filtros
              {pendingCount > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.3)', fontSize: '0.75rem',
                  fontWeight: 700, lineHeight: 1
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Meses: tira con arrastre (sin selección = año completo) */}
      <MonthStrip
        meses={selectedFilters.meses || []}
        mesesAplicados={appliedFilters.meses || []}
        onChange={(meses) => setSelectedFilters(prev => ({ ...prev, meses }))}
        mesFinalAplica={dataset === appliedFilters.dataset && String(selectedFilters.anio) === String(appliedFilters.anio)}
      />

      </div>
      </div>
      </div>

      {isCustomModalOpen && (
        <AltoImpactoModal
          onClose={() => setIsCustomModalOpen(false)}
          onConfirm={(token) => {
            if (onAddCustomCapsule) onAddCustomCapsule(token);
            setIsCustomModalOpen(false);
          }}
          customCapsules={customCapsules}
          scope={selectedFilters}
          activeTokens={Array.isArray(selectedFilters.altoImpacto) ? selectedFilters.altoImpacto : []}
        />
      )}
    </div>
  );
};

export default Filters;

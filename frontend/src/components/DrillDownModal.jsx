import React, { useEffect, useId, useRef, useState } from 'react';
import { useDialogFocus } from '../utils/useDialogFocus';
import { PREFERS_REDUCED_MOTION } from '../utils/motion';
import ExportMenu from './ExportMenu';
import { downloadCSV, copyTableToClipboard } from '../utils/exportUtils';
import EmptyState from './EmptyState';

const EXIT_MS = 150; // fundido de salida (.modal-backdrop.is-closing)

const DrillDownModal = ({
  title,
  subtitle,
  data,
  loading,
  onClose,
  valueLabel = 'Incidencia',
  showPct = false,
  showRank = false,
  // Tasa: dos decimales fijos en todas las filas
  isRate = false,
  // false cuando sumar las filas no tiene sentido (tasas de municipios distintos)
  showTotal = true,
  // Exportar/copiar el desglose: nombre de archivo y filtros de la consulta (bloque de filtros del CSV)
  exportFilename,
  exportFilters,
  // Encabezado de la columna de nombres y sustantivo del pie ("79 subtipos")
  nameLabel = 'Nombre',
  countNoun = ['registro', 'registros'],
  // La consulta falló: se muestra el error con reintento, no "sin datos"
  error = false,
  onRetry,
}) => {
  // El padre desmonta el modal en onClose: primero se desvanece (150ms) y luego se avisa
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef(null);
  useEffect(() => () => clearTimeout(exitTimer.current), []);
  const requestClose = () => {
    if (closing) return;
    if (PREFERS_REDUCED_MOTION) { onClose(); return; }
    setClosing(true);
    exitTimer.current = setTimeout(onClose, EXIT_MS);
  };

  // Foco: "Cerrar" al abrir, Tab atrapado, Escape cierra y el foco vuelve a la barra/región que lo abrió
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  useDialogFocus(true, { containerRef: panelRef, initialFocusRef: closeRef, onEscape: requestClose });

  const total = (data || []).reduce(
    (sum, d) => sum + (typeof d.value === 'number' ? d.value : 0),
    0
  );

  const fmt = (v) => (typeof v !== 'number' ? v
    : isRate ? v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString('es-MX'));

  const exportHeaders = showRank ? ['Lugar', nameLabel, valueLabel] : [nameLabel, valueLabel];
  const exportRows = () => (data || []).map(r => (showRank ? [r.rank ?? r.id, r.name, r.value] : [r.name, r.value]));
  const hasRows = !loading && !error && Array.isArray(data) && data.length > 0;

  const th = (extra = {}) => ({
    padding: '0.6rem 1rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '2px solid var(--border-color)',
    position: 'sticky',
    top: 0,
    backgroundColor: 'white',
    zIndex: 1,
    whiteSpace: 'nowrap',
    ...extra,
  });

  const tdStyle = (extra = {}) => ({
    padding: '0.6rem 1rem',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid #f1f5f9',
    ...extra,
  });

  return (
    <>
      <div
        className={`modal-backdrop${closing ? ' is-closing' : ''}`}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,23,42,0.65)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
        onClick={requestClose}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="modal-panel"
          style={{
            backgroundColor: 'white',
            borderRadius: '18px',
            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '82vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
            background: 'linear-gradient(135deg, #f8fafc 0%, white 60%)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <h2 id={titleId} style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                  {title}
                </h2>
                {subtitle && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {hasRows && exportFilename && (
                <ExportMenu subject={title}
                  isTable
                  onDownloadCSV={() => downloadCSV(exportFilename, exportRows(), exportHeaders, exportFilters)}
                  onCopyTable={() => copyTableToClipboard(exportRows(), exportHeaders)}
                />
              )}
              <button
                ref={closeRef}
                type="button"
                onClick={requestClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px',
                  display: 'flex', flexShrink: 0, transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Cerrar (Esc)"
                aria-label="Cerrar"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '34px', height: '34px', border: '3px solid var(--border-color)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
                <span style={{ fontSize: '0.875rem' }}>Cargando datos…</span>
              </div>
            ) : error ? (
              <EmptyState variant="error" inline onRetry={onRetry} />
            ) : !data || data.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ fontSize: '0.875rem' }}>No hay datos disponibles para estos filtros.</span>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {showRank && <th style={th({ textAlign: 'left', width: '56px', paddingLeft: '1.5rem' })} aria-label="Lugar">#</th>}
                    <th style={th({ textAlign: 'left', paddingLeft: showRank ? '0.5rem' : '1.5rem' })}>{nameLabel}</th>
                    <th style={th({ textAlign: 'right' })}>{valueLabel}</th>
                    {showPct && <th style={th({ textAlign: 'right', paddingRight: '1.5rem', width: '100px' })}>% del total</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const rank = row.rank ?? row.id;
                    return (
                      <tr
                        key={i}
                        style={{ transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {showRank && (
                          <td style={tdStyle({ paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' })}>
                            {rank}
                          </td>
                        )}
                        <td style={tdStyle({ paddingLeft: showRank ? '0.5rem' : '1.5rem', fontWeight: 500 })}>{row.name}</td>
                        <td style={tdStyle({ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' })}>
                          {fmt(row.value)}
                        </td>
                        {showPct && (
                          <td style={tdStyle({ textAlign: 'right', paddingRight: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' })}>
                            {total > 0 && typeof row.value === 'number'
                              ? `${((row.value / total) * 100).toFixed(1)}%`
                              : '—'}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Footer ── */}
          {hasRows && (
            <div style={{
              padding: '0.65rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: '#f8fafc',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {data.length} {data.length === 1 ? countNoun[0] : countNoun[1]}
              </span>
              {showTotal && total > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>{fmt(total)}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DrillDownModal;

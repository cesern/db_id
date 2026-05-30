import React, { useEffect } from 'react';

const RANK_STYLES = {
  1: { bg: '#fef9c3', color: '#a16207' },
  2: { bg: '#f1f5f9', color: '#475569' },
  3: { bg: '#fce7f3', color: '#9d174d' },
};
const getRankStyle = (rank) => RANK_STYLES[rank] || { bg: '#f8fafc', color: '#64748b' };

const DrillDownModal = ({
  title,
  subtitle,
  data,
  loading,
  onClose,
  valueLabel = 'Incidencia',
  showPct = false,
  showRank = false,
}) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const total = (data || []).reduce(
    (sum, d) => sum + (typeof d.value === 'number' ? d.value : 0),
    0
  );

  const th = (extra = {}) => ({
    padding: '0.6rem 1rem',
    fontSize: '0.68rem',
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
      <style>{`
        @keyframes ddFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ddSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0)    scale(1)    }
        }
        @keyframes ddSpin { to { transform: rotate(360deg) } }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,23,42,0.65)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          animation: 'ddFadeIn 0.2s ease',
        }}
        onClick={onClose}
      >
        <div
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
            animation: 'ddSlideUp 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                  {title}
                </h2>
                {subtitle && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px',
                  display: 'flex', flexShrink: 0, transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Cerrar (Esc)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '34px', height: '34px', border: '3px solid var(--border-color)', borderTopColor: 'var(--color-accent)', borderRadius: '50%', animation: 'ddSpin 0.75s linear infinite' }} />
                <span style={{ fontSize: '0.875rem' }}>Cargando datos…</span>
              </div>
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
                    <th style={th({ textAlign: 'left', paddingLeft: '1.5rem' })}>Nombre</th>
                    {showRank && <th style={th({ textAlign: 'center', width: '72px' })}>Rank</th>}
                    <th style={th({ textAlign: 'right' })}>{valueLabel}</th>
                    {showPct && <th style={th({ textAlign: 'right', paddingRight: '1.5rem', width: '100px' })}>% del total</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const rank = row.rank ?? row.id;
                    const rs = getRankStyle(rank);
                    return (
                      <tr
                        key={i}
                        style={{ transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={tdStyle({ paddingLeft: '1.5rem', fontWeight: 500 })}>{row.name}</td>
                        {showRank && (
                          <td style={tdStyle({ textAlign: 'center' })}>
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: rs.bg,
                              color: rs.color,
                              fontSize: '0.72rem', fontWeight: 700,
                              padding: '2px 9px', borderRadius: '999px',
                            }}>
                              #{rank}
                            </span>
                          </td>
                        )}
                        <td style={tdStyle({ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' })}>
                          {typeof row.value === 'number' ? row.value.toLocaleString('en-US') : row.value}
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
          {!loading && data && data.length > 0 && (
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
                {data.length} {data.length === 1 ? 'registro' : 'registros'}
              </span>
              {total > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Total: <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-US')}</strong>
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

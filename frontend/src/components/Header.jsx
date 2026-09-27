import React, { useState, useEffect, useRef } from 'react';
import InfoModal from './InfoModal';

const Header = ({ dataset, setDataset, activeTab = 'dashboard', setActiveTab }) => {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const tabsRef = useRef(null);

  // En pantallas angostas la barra de pestañas se desplaza: mantener visible la activa
  useEffect(() => {
    const active = tabsRef.current?.querySelector('[aria-selected="true"]');
    if (active && tabsRef.current.scrollWidth > tabsRef.current.clientWidth) {
      active.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }, [dataset, activeTab]);

  return (
    <header className="app-header" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem',
      padding: 'var(--header-padding, 1rem 1.5rem)',
      backgroundColor: 'white',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
        <img src="/logo.png" alt="Fiscalía General de Justicia del Estado de Sonora" style={{ height: 'var(--header-logo-height, 50px)', objectFit: 'contain' }} />
        <h1
          style={{
            fontSize: 'clamp(1.2rem, 2.6vw, 2.2rem)',
            fontWeight: 900,
            color: '#081C3A',
            letterSpacing: '-0.03em',
            textTransform: 'uppercase',
            marginLeft: '1rem',
            fontFamily: '"Montserrat", "Inter", sans-serif',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              flexShrink: 0,
              width: '6px',
              height: 'var(--header-bar-height, 38px)',
              background: 'linear-gradient(to bottom, #C8A96B, #9F7A3D)',
              borderRadius: '999px',
              display: 'inline-block',
            }}
          />
          {/* Título fijo: la pestaña activa ya indica el dataset */}
          Incidencia Delictiva
        </h1>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setIsInfoOpen(true)}
          aria-label="Metodología y fuentes de información"
          title="Metodología y fuentes de información"
          style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 7.5h.01" />
          </svg>
        </button>
        <div ref={tabsRef} className="dataset-tabs" role="tablist" aria-label="Conjunto de datos">
          {[
            { id: 'delitos', label: 'Delitos' },
            { id: 'alto_impacto', label: 'Delitos Alto Impacto' },
            { id: 'victimas', label: 'Víctimas' },
            { id: 'victimas_mun', label: 'Víctimas Municipios' },
            { id: 'rankings', label: 'Rankings' }
          ].map(opt => {
            const isActive = opt.id === 'rankings'
              ? activeTab === 'rankings'
              : (activeTab === 'dashboard' && dataset === opt.id);

            const handleClick = () => {
              if (opt.id === 'rankings') {
                if (setActiveTab) setActiveTab('rankings');
              } else {
                if (setActiveTab) setActiveTab('dashboard');
                setDataset(opt.id);
              }
            };

            const tab = (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={handleClick}
              >
                {opt.label}
              </button>
            );
            // Rankings es un modo de análisis, no un dataset: se separa con un divisor
            return opt.id === 'rankings' ? (
              <React.Fragment key={opt.id}>
                <span className="dataset-tabs-divider" aria-hidden="true" />
                {tab}
              </React.Fragment>
            ) : tab;
          })}
        </div>
      </div>

      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </header>
  );
};

export default Header;

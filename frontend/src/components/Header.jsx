import React, { useState } from 'react';
import InfoModal from './InfoModal';

<<<<<<< HEAD
const Header = ({ dataset, setDataset, activeTab = 'dashboard', setActiveTab }) => {
=======
const Header = ({ dataset, setDataset }) => {
>>>>>>> ce4ea9aaf35a9667e97a313e943acafae32cd390
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem',
      padding: '1rem 1.5rem',
      backgroundColor: 'white',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src="/logo.png" alt="Logo Institucional" style={{ height: '50px', objectFit: 'contain' }} />
        <h1
          style={{
            fontSize: 'clamp(1.2rem, 3.5vw, 2.2rem)',
            fontWeight: 900,
            color: '#081C3A',
            letterSpacing: '-0.06em',
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
            style={{
              width: '6px',
              height: '38px',
              background: 'linear-gradient(to bottom, #C8A96B, #9F7A3D)',
              borderRadius: '999px',
              display: 'inline-block',
            }}
          />
<<<<<<< HEAD
          Incidencia Delictiva - {activeTab === 'rankings' ? 'Evolución Ranking' : (dataset === 'delitos' ? 'Delitos' : dataset === 'victimas' ? 'Víctimas' : 'Víctimas Municipios')}
=======
          Incidencia Delictiva - {dataset === 'delitos' ? 'Delitos' : dataset === 'victimas' ? 'Víctimas' : 'Víctimas Municipios'}
>>>>>>> ce4ea9aaf35a9667e97a313e943acafae32cd390
        </h1>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          onClick={() => setIsInfoOpen(true)}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.2rem',
            fontWeight: 600,
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)'
          }}
          title="Ver Metodología e Información"
          onMouseEnter={(e) => {
            e.target.style.borderColor = 'var(--color-accent)';
            e.target.style.color = 'var(--color-accent)';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'var(--border-color)';
            e.target.style.color = 'var(--text-secondary)';
          }}
        >
          i
        </button>
<<<<<<< HEAD
        <div style={{
          display: 'flex',
          alignItems: 'center',
=======
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
>>>>>>> ce4ea9aaf35a9667e97a313e943acafae32cd390
          backgroundColor: 'var(--bg-main, #f1f5f9)',
          padding: '4px',
          borderRadius: '10px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {[
            { id: 'delitos', label: 'Delitos' },
            { id: 'victimas', label: 'Víctimas' },
<<<<<<< HEAD
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

            return (
              <button
                key={opt.id}
                onClick={handleClick}
=======
            { id: 'victimas_mun', label: 'Víctimas Municipios' }
          ].map(opt => {
            const isActive = dataset === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setDataset(opt.id)}
>>>>>>> ce4ea9aaf35a9667e97a313e943acafae32cd390
                style={{
                  padding: '0.45rem 1rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'var(--color-accent, #2563eb)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #64748b)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 4px 10px rgba(0,0,0,0.15)' : 'none'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-primary, #334155)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.6)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <InfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </header>
  );
};

export default Header;

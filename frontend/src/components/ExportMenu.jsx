import React, { useState, useEffect, useRef } from 'react';
import { downloadImage, downloadPNGFromSVG } from '../utils/exportUtils';

const ExportMenu = ({ elementRef, imageFilename, onDownloadCSV, onCopyTable, isTable = false, style = {} }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportImage = () => {
    if (elementRef && elementRef.current) {
      // Ocultar temporalmente el menú de exportación antes de capturar la imagen
      setIsOpen(false);
      
      // Esperar un breve instante para que el menú se cierre visualmente
      setTimeout(() => {
        downloadImage(elementRef.current, imageFilename);
      }, 150);
    }
  };

  const handleExportCSV = () => {
    setIsOpen(false);
    if (onDownloadCSV) {
      onDownloadCSV();
    }
  };

  const handleExportPNG = () => {
    if (elementRef && elementRef.current) {
      setIsOpen(false);
      setTimeout(() => {
        downloadPNGFromSVG(elementRef.current, imageFilename.replace('.svg', '.png'));
      }, 150);
    }
  };

  const handleCopyTable = () => {
    setIsOpen(false);
    if (onCopyTable) {
      onCopyTable();
    }
  };

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block', zIndex: 90, ...style }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Opciones de exportación"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-card, #ffffff)',
          cursor: 'pointer',
          color: 'var(--text-secondary, #64748b)',
          transition: 'all 0.2s ease',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent, #2563eb)';
          e.currentTarget.style.color = 'var(--color-accent, #2563eb)';
          e.currentTarget.style.backgroundColor = 'var(--color-accent-light, #f0f4ff)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-color, #e2e8f0)';
          e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
          e.currentTarget.style.backgroundColor = 'var(--bg-card, #ffffff)';
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '38px',
          right: 0,
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.05))',
          padding: '4px',
          minWidth: '150px',
          zIndex: 9999
        }}>
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '6px',
              background: 'transparent',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'var(--text-primary, #1e293b)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-main, #f8fafc)';
              e.currentTarget.style.color = 'var(--color-accent, #2563eb)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-primary, #1e293b)';
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Exportar CSV
          </button>
          
          {isTable ? (
            <button
              onClick={handleCopyTable}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-primary, #1e293b)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-main, #f8fafc)';
                e.currentTarget.style.color = 'var(--color-accent, #2563eb)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-primary, #1e293b)';
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copiar Tabla
            </button>
          ) : (
            <button
              onClick={handleExportPNG}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-primary, #1e293b)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-main, #f8fafc)';
                e.currentTarget.style.color = 'var(--color-accent, #2563eb)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-primary, #1e293b)';
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Exportar PNG
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ExportMenu;

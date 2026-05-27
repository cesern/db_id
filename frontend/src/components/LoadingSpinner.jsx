import React from 'react';

/**
 * LoadingSpinner
 * Overlay semi-transparente con spinner animado.
 * Se superpone sobre el contenido mientras se cargan datos.
 *
 * Props:
 *   - size: 'sm' | 'md' | 'lg'  (default: 'md')
 *   - overlay: bool — si true, cubre el contenedor padre con posición absolute
 */
const LoadingSpinner = ({ size = 'md', overlay = true }) => {
  const sizeMap = { sm: 20, md: 32, lg: 48 };
  const px = sizeMap[size] ?? 32;

  const spinner = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--color-accent, #2563eb)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="0"
      />
    </svg>
  );

  if (!overlay) return spinner;

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(2px)',
          zIndex: 20,
          borderRadius: 'inherit',
          transition: 'opacity 0.2s ease',
        }}
        aria-label="Cargando..."
        role="status"
      >
        {spinner}
      </div>
    </>
  );
};

export default LoadingSpinner;

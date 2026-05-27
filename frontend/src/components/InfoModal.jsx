import React, { useEffect } from 'react';

const InfoModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-xl)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-card)',
          zIndex: 1,
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.5rem', fontWeight: 800 }}>
            Metodología y Fuentes de Información
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = 'var(--bg-main)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Fuentes de Información
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Los datos presentados en este dashboard son de carácter <strong>público y oficial</strong>. Provienen directamente del <strong>Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP)</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Se actualizan mensualmente conforme a los reportes de incidencia delictiva del fuero común proporcionados por las Procuradurías de Justicia y Fiscalías Generales de las entidades federativas.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Cálculo de Tasas
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Las <strong>tasas por cada 100,000 habitantes</strong> se calculan utilizando las proyecciones de población oficiales de <strong>CONAPO</strong> (Consejo Nacional de Población).
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>Permiten comparar de manera justa la incidencia delictiva entre entidades o municipios con diferentes tamaños de población.</li>
              <li>Fórmula: <code>(Número de delitos o víctimas / Población proyectada) × 100,000</code></li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Metodología de Rankings
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Los rankings muestran los estados y municipios ordenados por su nivel de incidencia delictiva para el periodo seleccionado.
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Manejo de Empates:</strong> Se utiliza el método de <em>Ranking Denso (Dense Ranking)</em>. Si dos entidades tienen exactamente el mismo valor, comparten el mismo lugar (ej. 4º, 4º), y el siguiente en la lista continúa con el número inmediato siguiente sin saltar posiciones (5º).</li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Promedios Móviles y Tendencias
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              En las gráficas de líneas históricas, ofrecemos herramientas de análisis avanzado:
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Promedio Móvil 3M y 6M:</strong> Suavizan los picos irregulares (ruido) promediando los últimos 3 o 6 meses, facilitando ver la dirección de corto y mediano plazo.</li>
              <li><strong>Suavizado (12M):</strong> Elimina la estacionalidad (ej. delitos que suben en ciertos meses del año) promediando todo un año, revelando la verdadera tendencia estructural.</li>
              <li><strong>Línea de Tendencia:</strong> Calculada mediante regresión lineal simple sobre todos los datos visibles, mostrando una recta que indica si el fenómeno va al alza (rojo) o a la baja (verde) en el periodo analizado.</li>
            </ul>
          </section>

          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(69, 89, 147, 0.05)',
            borderLeft: '4px solid var(--color-accent)',
            borderRadius: '4px'
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, fontStyle: 'italic' }}>
              Toda la información contenida en esta plataforma tiene fines estadísticos e informativos, basados en los datos de acceso público.
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default InfoModal;

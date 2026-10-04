import React, { useEffect, useId, useRef } from 'react';
import { useDialogFocus } from '../utils/useDialogFocus';
import { useExitAnimation } from '../utils/useExitAnimation';

const InfoModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Al cerrar se queda montado 150ms para el fundido de salida (.is-closing)
  const { mounted, closing } = useExitAnimation(isOpen, 150);

  // Foco: "Cerrar" al abrir, Tab atrapado, Escape cierra y el foco vuelve al botón de información
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  useDialogFocus(isOpen, { containerRef: panelRef, initialFocusRef: closeRef, onEscape: onClose });

  if (!mounted) return null;

  return (
    <div
      className={`modal-backdrop${closing ? ' is-closing' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(8, 28, 58, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-panel"
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
          flexDirection: 'column'
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
          <h2 id={titleId} style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.5rem', fontWeight: 800 }}>
            Metodología y fuentes de información
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar"
            title="Cerrar (Esc)"
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
              Fuentes de información
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Los datos de este tablero son de carácter <strong>público y oficial</strong>. Provienen directamente del <strong>Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP)</strong>.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Se actualizan mensualmente conforme a los reportes de incidencia delictiva del fuero común proporcionados por las Procuradurías de Justicia y Fiscalías Generales de las entidades federativas.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Cambio de metodología en Víctimas (2026)
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              A partir de <strong>2026</strong> el SESNSP cambió la metodología de registro de víctimas: se incorporan bienes jurídicos que antes no se reportaban (por ejemplo, <em>La familia</em> y <em>Otros bienes jurídicos afectados</em>). Por ello las cifras de víctimas de 2026 <strong>no son comparables</strong> con las de años anteriores; los aumentos entre 2025 y 2026 reflejan en buena parte el cambio de cobertura, no solo un cambio en la incidencia.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Cálculo de tasas
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Las <strong>tasas por cada 100,000 habitantes</strong> se calculan utilizando las proyecciones de población oficiales de <strong>CONAPO</strong> (Consejo Nacional de Población).
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>Permiten comparar de manera justa la incidencia delictiva entre entidades o municipios con diferentes tamaños de población.</li>
              <li>Fórmula: <code>(Número de delitos o víctimas / Población proyectada) × 100,000</code></li>
              <li><strong>N/D</strong> (no disponible) aparece cuando no hay población para el cálculo; por ejemplo, en los registros con municipio "No especificado".</li>
              <li>En un año aún incompleto la tasa usa los meses publicados y la población de todo el año, por lo que es menor que la de un año cerrado.</li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Delitos de alto impacto
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              La pestaña <strong>Delitos Alto Impacto</strong> suma una selección de delitos del conjunto Delitos: homicidio doloso, feminicidio, secuestro, extorsión, robo de vehículo (coche de 4 ruedas), robo con violencia (sin contar el de vehículo) y violación. Se pueden activar o desactivar, y agregar delitos propios; un mismo registro nunca se cuenta dos veces.
            </p>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Metodología de rankings
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              Los rankings muestran los estados y municipios ordenados por su nivel de incidencia delictiva para el periodo seleccionado.
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Empates:</strong> si dos entidades tienen exactamente el mismo valor, comparten el mismo lugar (ej. 2º, 2º), y el siguiente en la lista salta a la posición real correspondiente (4º).</li>
            </ul>
          </section>

          <section>
            <h3 style={{ color: 'var(--color-accent)', fontSize: '1.2rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              Promedios móviles y tendencias
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              El histórico mensual ofrece estas herramientas:
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Promedio móvil 3M y 6M:</strong> suavizan los picos irregulares (ruido) promediando los últimos 3 o 6 meses, facilitando ver la dirección de corto y mediano plazo.</li>
              <li><strong>Suavizado (12M):</strong> elimina la estacionalidad (ej. delitos que suben en ciertos meses del año) promediando todo un año, revelando la verdadera tendencia estructural.</li>
              <li><strong>Línea de tendencia:</strong> calculada mediante regresión lineal simple sobre todos los datos visibles, mostrando una recta que indica si el fenómeno va al alza (rojo) o a la baja (verde) en el periodo analizado.</li>
            </ul>
          </section>

          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(69, 89, 147, 0.06)',
            border: '1px solid rgba(69, 89, 147, 0.18)',
            borderRadius: '8px'
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, fontStyle: 'italic' }}>
              Toda la información contenida en esta plataforma tiene fines estadísticos e informativos, basados en los datos de acceso público.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;

import React, { useContext, useEffect, useId, useRef, useState } from 'react';
import { parseCapsule } from '../utils/altoImpacto';
import { periodLabel, monthsLabel } from '../utils/labels';
import { MesFinalContext } from '../utils/mesFinalContext';
import { useDialogFocus } from '../utils/useDialogFocus';

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * periodMode: cómo rotular el periodo según lo que muestra la vista
 * - 'year' (tabla, mapa): "Periodo: Ene–Ago 2026" / "Mar 2026" / "Año 2024"
 * - 'series' (barras por año): "Año: 2026 (Ene–Ago)" si es parcial + "Meses: Mar de cada año" si hay meses
 * - 'history' (histórico mensual, ignora meses): "Datos hasta: Ago 2026" si el año es parcial
 *
 * Foco: el encabezado vive solo dentro del overlay de pantalla completa, así que maneja el diálogo
 * completo (foco inicial en "Cerrar", Tab atrapado, Escape cierra y el foco vuelve a `returnFocusRef`,
 * el botón que abrió la vista, que se vuelve a montar al cerrar).
 */
const FullScreenHeader = ({ title, selectedFilters, metricType, onClose, extraActions, periodMode = 'year', returnFocusRef }) => {
  const mesFinal = useContext(MesFinalContext);
  const titleId = useId();
  const rootRef = useRef(null);
  const closeRef = useRef(null);
  // El overlay es el ancestro .fullscreen-immersive-overlay (lo renderiza cada tarjeta)
  const [overlayRef] = useState(() => ({ get current() { return rootRef.current?.closest('.fullscreen-immersive-overlay') || null; } }));

  // Semántica de diálogo sobre el overlay mientras este encabezado está montado. Se aplica aquí
  // (un solo lugar) porque en varias tarjetas el overlay es la misma tarjeta con otra clase.
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return undefined;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', titleId);
    return () => {
      el.removeAttribute('role');
      el.removeAttribute('aria-modal');
      el.removeAttribute('aria-labelledby');
    };
  }, [overlayRef, titleId]);

  useDialogFocus(true, { containerRef: overlayRef, initialFocusRef: closeRef, returnFocusRef, onEscape: onClose });
  // Generar subtítulo contextual basado en los filtros (en formato de pastillas/badges)
  const generateSubtitle = () => {
    if (!selectedFilters) return null;
    const badges = [];

    // 1. Periodo (año + meses elegidos o, si el año está incompleto, hasta qué mes hay datos)
    if (selectedFilters.anio) {
      const anio = selectedFilters.anio;
      const meses = selectedFilters.meses;
      const partial = mesFinal && mesFinal < 12 && !monthsLabel(meses);
      if (periodMode === 'series') {
        badges.push({ label: 'Año', value: partial ? `${anio} (Ene–${MESES_CORTOS[mesFinal - 1]})` : anio });
        if (monthsLabel(meses)) badges.push({ label: 'Meses', value: `${monthsLabel(meses)} de cada año` });
      } else if (periodMode === 'history') {
        if (mesFinal && mesFinal < 12) badges.push({ label: 'Datos hasta', value: `${MESES_CORTOS[mesFinal - 1]} ${anio}` });
      } else {
        badges.push({ label: 'Periodo', value: periodLabel(anio, meses, mesFinal) });
      }
    }

    // 2. Entidad
    const entidadVal = selectedFilters.entidad || 'All';
    badges.push({ 
      label: 'Entidad', 
      value: entidadVal === 'All' ? 'Nacional' : entidadVal 
    });

    // 3. Municipio
    if (selectedFilters.municipio && selectedFilters.municipio !== 'All') {
      badges.push({ label: 'Municipio', value: selectedFilters.municipio });
    }

    // 4. Tipo de Métrica (Cifras absolutas / Tasa)
    if (metricType) {
      badges.push({
        label: 'Métrica',
        value: metricType === 'absolute' ? 'Cifras absolutas' : 'Tasa por 100 mil hab.'
      });
    }

    // 4b. Dataset
    if (selectedFilters.dataset) {
      badges.push({
        label: 'Conjunto de datos',
        value: selectedFilters.dataset === 'delitos' ? 'Delitos'
          : selectedFilters.dataset === 'alto_impacto' ? 'Delitos Alto Impacto'
          : selectedFilters.dataset === 'victimas_mun' ? 'Víctimas Municipios' : 'Víctimas'
      });
    }

    // 4b2. Cápsulas de alto impacto
    if (selectedFilters.dataset === 'alto_impacto' && Array.isArray(selectedFilters.altoImpacto) && selectedFilters.altoImpacto.length > 0) {
      const names = selectedFilters.altoImpacto.map(t => parseCapsule(t).name);
      badges.push({
        label: `Alto Impacto (${names.length})`,
        value: names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} ... (+${names.length - 2})`,
        fullValue: names.join(', ')
      });
    }

    // 4c. Temporalidad
    if (selectedFilters.temporalidad) {
      let tempLabel = selectedFilters.temporalidad === 'anual' ? 'Anual' : selectedFilters.temporalidad === 'mensual' ? 'Mensual' : 'Acumulado';
      if (selectedFilters.temporalidad === 'acumulado' && selectedFilters.mesAcumulado) {
        tempLabel += ` (Ene-${selectedFilters.mesAcumulado.slice(0, 3)})`;
      }
      badges.push({ label: 'Periodo', value: tempLabel });
    }

    // 5. Mostrar filtros específicos aplicados (tanto planos como anidados en .filters)
    const filterObj = selectedFilters.filters || selectedFilters;
    const filterKeysConfig = [
      { key: 'bienJuridico', label: 'Bien jurídico' },
      { key: 'tipoDelito', label: 'Tipo' },
      { key: 'subtipoDelito', label: 'Subtipo' },
      { key: 'modalidad', label: 'Modalidad' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'rangoEdad', label: 'Edad' }
    ];

    filterKeysConfig.forEach(({ key, label }) => {
      const val = filterObj[key];
      if (Array.isArray(val) && val.length > 0) {
        let textVal = '';
        if (val.length <= 2) {
          textVal = val.join(', ');
        } else {
          textVal = `${val.slice(0, 2).join(', ')} ... (+${val.length - 2})`;
        }
        badges.push({ label, value: textVal, fullValue: val.join(', ') });
      }
    });

    if (badges.length === 0) return null;

    return (
      <div className="fs-badges" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        flexWrap: 'wrap',
        marginTop: '0.35rem'
      }}>
        {badges.map((badge, idx) => (
          <span 
            key={idx} 
            title={badge.fullValue || badge.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.2rem 0.55rem',
              backgroundColor: 'var(--bg-main, #f8fafc)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.2,
              cursor: badge.fullValue ? 'help' : 'default'
            }}
          >
            <span style={{ color: 'var(--text-primary, #0f172a)', fontWeight: '700', marginRight: '0.25rem' }}>
              {badge.label}:
            </span>
            {badge.value}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div ref={rootRef} className="fs-header" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '1.25rem',
      marginBottom: '1.5rem',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 id={titleId} className="fs-title" style={{
          fontSize: '1.84rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: 0,
          fontFamily: 'inherit'
        }}>
          {title}
        </h2>
        {generateSubtitle()}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {extraActions}
        <button
          ref={closeRef}
          type="button"
          className="fs-close"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            color: '#b91c1c', /* 6.1:1 sobre #fef2f2 (antes #ef4444, 3.4:1) */
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#b91c1c';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = '#b91c1c';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fef2f2';
            e.currentTarget.style.color = '#b91c1c';
            e.currentTarget.style.borderColor = '#fee2e2';
          }}
          title="Salir de pantalla completa (Esc)"
          aria-label="Salir de pantalla completa"
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default FullScreenHeader;

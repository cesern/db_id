import React from 'react';

const FullScreenHeader = ({ title, selectedFilters, metricType, onClose, extraActions }) => {
  // Generar subtítulo contextual basado en los filtros (en formato de pastillas/badges)
  const generateSubtitle = () => {
    if (!selectedFilters) return null;
    const badges = [];

    // 1. Año
    if (selectedFilters.anio) {
      badges.push({ label: 'Año', value: selectedFilters.anio });
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
        value: metricType === 'absolute' ? 'Cifras absolutas' : 'Tasa 100 mil hab.'
      });
    }

    // 4b. Dataset
    if (selectedFilters.dataset) {
      badges.push({
        label: 'Dataset',
        value: selectedFilters.dataset === 'delitos' ? 'Delitos' : 'Víctimas'
      });
    }

    // 4c. Temporalidad
    if (selectedFilters.temporalidad) {
      let tempLabel = selectedFilters.temporalidad === 'anual' ? 'Anual' : selectedFilters.temporalidad === 'mensual' ? 'Mensual' : 'Acumulado';
      if (selectedFilters.temporalidad === 'acumulado' && selectedFilters.mesAcumulado) {
        tempLabel += ` (Ene-${selectedFilters.mesAcumulado.slice(0, 3)})`;
      }
      badges.push({ label: 'Temporalidad', value: tempLabel });
    }

    // 5. Mostrar filtros específicos aplicados (tanto planos como anidados en .filters)
    const filterObj = selectedFilters.filters || selectedFilters;
    const filterKeysConfig = [
      { key: 'bienJuridico', label: 'Bien jurídico' },
      { key: 'tipoDelito', label: 'Tipo' },
      { key: 'subtipoDelito', label: 'Subtipo' },
      { key: 'modalidad', label: 'Modalidad' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'rangoEdad', label: 'Edad' },
      { key: 'meses', label: 'Meses' }
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
      <div style={{
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
              fontSize: '0.72rem',
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
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '1.25rem',
      marginBottom: '1.5rem',
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 style={{
          fontSize: '1.6rem',
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
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ef4444';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fef2f2';
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.borderColor = '#fee2e2';
          }}
          title="Salir de pantalla completa (Esc)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

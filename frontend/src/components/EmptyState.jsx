import React from 'react';

/**
 * Estado vacío / error compartido por Sidebar, gráficas y mapa.
 * - variant="empty": la consulta respondió pero sin filas para los filtros aplicados.
 * - variant="error": la consulta falló; ofrece "Reintentar" si se pasa onRetry.
 * Por defecto se superpone al contenedor (que debe tener position: relative);
 * con inline=true ocupa su propio espacio.
 */
const COPY = {
  empty: {
    title: 'Sin datos para estos filtros',
    detail: 'Prueba con otro año, entidad o quita algún filtro.'
  },
  error: {
    title: 'No se pudieron cargar los datos',
    detail: 'El servidor no respondió. Revisa tu conexión e intenta de nuevo.'
  }
};

const EmptyState = ({ variant = 'empty', onRetry, inline = false, title, detail }) => {
  const copy = COPY[variant] || COPY.empty;
  return (
    <div
      className={`state-panel${inline ? ' is-static' : ''}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {variant === 'error' ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5M12 16h.01" />
          </>
        ) : (
          <>
            <path d="M3 3v18h18" />
            <path d="M7 15l3-3 3 2 5-6" strokeDasharray="2 2.5" />
          </>
        )}
      </svg>
      <strong>{title || copy.title}</strong>
      <span>{detail || copy.detail}</span>
      {variant === 'error' && onRetry && (
        <button type="button" className="state-panel-retry" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
};

export default EmptyState;

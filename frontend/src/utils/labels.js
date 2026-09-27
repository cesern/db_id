/**
 * Títulos y sustantivos de métrica compartidos por todas las tarjetas.
 * Un solo criterio (tipo oración) para que el título siempre siga al dataset
 * y a la métrica: Delitos, Alto Impacto, Víctimas y Víctimas Municipios.
 */

/** Sustantivo de la métrica según el dataset de la UI. */
export const metricNoun = (dataset) => {
  if (dataset === 'victimas' || dataset === 'victimas_mun') return 'víctimas';
  if (dataset === 'alto_impacto') return 'alto impacto';
  return 'incidencia';
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Incidencia" | "Tasa de incidencia" (y equivalentes por dataset). */
export const metricPhrase = (dataset, metricType) =>
  metricType === 'rate' ? `Tasa de ${metricNoun(dataset)}` : capitalize(metricNoun(dataset));

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Meses elegidos en forma corta: '' si ninguno o los 12; "Mar", "Ene–Mar" o "Ene, Mar, Jul". */
export const monthsLabel = (meses) => {
  const sel = Array.isArray(meses) ? meses : [];
  const idx = sel.map(m => MESES.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b);
  if (idx.length === 0 || idx.length === 12) return '';
  if (idx.length === 1) return MESES_CORTOS[idx[0]];
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  return contiguous ? `${MESES_CORTOS[idx[0]]}–${MESES_CORTOS[idx[idx.length - 1]]}` : idx.map(i => MESES_CORTOS[i]).join(', ');
};

/**
 * Periodo de un año con filtros: "Mar 2026", "Ene–Mar 2026", "Año 2024"; sin meses elegidos y con
 * año incompleto (mesFinal < 12) rotula el periodo real: "Ene–Ago 2026".
 */
export const periodLabel = (anio, meses, mesFinal) => {
  const m = monthsLabel(meses);
  if (m) return `${m} ${anio}`;
  const sel = Array.isArray(meses) ? meses : [];
  if (sel.length === 0 && mesFinal && mesFinal < 12) return `Ene–${MESES_CORTOS[mesFinal - 1]} ${anio}`;
  return `Año ${anio}`;
};

/** Título de tarjeta: metricPhrase + complemento. Ej.: chartTitle('victimas_mun', 'rate', 'por municipio (Sonora)'). */
export const chartTitle = (dataset, metricType, complement) =>
  `${metricPhrase(dataset, metricType)} ${complement}`.trim();

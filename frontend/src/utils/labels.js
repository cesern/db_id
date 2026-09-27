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

/** Título de tarjeta: metricPhrase + complemento. Ej.: chartTitle('victimas_mun', 'rate', 'por municipio (Sonora)'). */
export const chartTitle = (dataset, metricType, complement) =>
  `${metricPhrase(dataset, metricType)} ${complement}`.trim();

// Formatos del panel de datos (es-MX, meses cortos en español).

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const num = (n) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));

/** "Agosto" → "Ago" (acepta también el nombre ya corto). */
export const shortMonth = (name) => {
  if (!name) return null;
  const i = MESES.findIndex((m) => m.toLowerCase() === String(name).toLowerCase());
  return i >= 0 ? CORTOS[i] : String(name).slice(0, 3);
};

/** ISO → "27 sep 2026 14:05" (withYear=false → "27 sep 14:05"). */
export const fmtDate = (iso, withYear = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const mes = CORTOS[d.getMonth()].toLowerCase();
  return `${d.getDate()} ${mes}${withYear ? ` ${d.getFullYear()}` : ''} ${hh}:${mm}`;
};

export const yearRange = (s) => {
  if (!s || s.year_min == null) return null;
  return s.year_min === s.year_max ? String(s.year_min) : `${s.year_min}–${s.year_max}`;
};

/** Resumen en una línea: "2015–2026 · datos hasta Ago 2026 · 34,123,456 filas". */
export const summaryLine = (s) => {
  if (!s) return '';
  const parts = [];
  const rango = yearRange(s);
  if (rango) parts.push(rango);
  if (s.last_month) parts.push(`datos hasta ${shortMonth(s.last_month)} ${s.year_max}`);
  parts.push(`${num(s.rows)} filas`);
  return parts.join(' · ');
};

/** Diferencia con signo: +2,744 / −120 / 0. */
export const signed = (n) => {
  if (n == null) return null;
  if (n === 0) return '0';
  return `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('es-MX')}`;
};

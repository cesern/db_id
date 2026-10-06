/**
 * Lógica pura de la pestaña Rankings (sin React): escala del eje, mejor/peor posición y nota de
 * empate. Pruebas: `node --test tests/rankings.test.js` desde frontend/.
 */

// Cifras redondas del eje según cuánto abarca la serie (un paso de 1 en un rango de 80 lugares sería ruido)
const pasoDelEje = (span) => (span <= 20 ? 1 : span <= 60 ? 5 : span <= 200 ? 10 : span <= 600 ? 50 : span <= 2000 ? 100 : 500);

/**
 * Eje Y de un municipio: se ajusta al rango de lugares que recorre la serie (con margen y cifras
 * redondas) para que la variación llene la gráfica en vez de ocupar una franja de 1…2,500.
 * El 1 solo aparece si la serie está cerca. `tope` = municipios clasificados (el eje no lo pasa).
 * Devuelve { min, max, ticks }: tres marcas (mínimo, mitad y máximo) o cinco si abarca 40 lugares o más.
 */
export const ejeRanking = (minLugar, maxLugar, tope = Infinity) => {
  const min = Math.max(1, Math.floor(Number(minLugar) || 1));
  const max = Math.max(min, Math.ceil(Number(maxLugar) || min));
  const margen = Math.max(2, Math.ceil((max - min) * 0.2), Math.ceil(max * 0.05));
  const crudoMin = Math.max(1, min - margen);
  const crudoMax = max + margen;
  const paso = pasoDelEje(crudoMax - crudoMin);
  const lo = Math.max(1, Math.floor(crudoMin / paso) * paso);
  let hi = Math.ceil(crudoMax / paso) * paso;
  if (hi > tope) hi = Math.max(tope, max);
  if (hi <= lo) hi = lo + 1;
  const marcas = hi - lo >= 40 ? 5 : 3;
  return { min: lo, max: hi, ticks: Array.from({ length: marcas }, (_, i) => Math.round(lo + ((hi - lo) * i) / (marcas - 1))) };
};

/**
 * Mejor y peor posición de una serie [{ period, rank, total, n }].
 * "Mejor" = lugar numérico más alto (menos incidencia); "peor" = el más bajo (más incidencia).
 * Cada una lleva todos los periodos en que se alcanzó. Serie vacía = null.
 * La peor sale solo de periodos con casos (si los hay): con cifra 0 el lugar es un empate, no un mal periodo.
 */
export const resumenPosiciones = (serie) => {
  const puntos = (Array.isArray(serie) ? serie : []).filter(p => typeof p?.rank === 'number');
  if (puntos.length === 0) return null;
  const lugares = puntos.map(p => p.rank);
  const conCasos = puntos.filter(p => p.total > 0).map(p => p.rank);
  const armar = (rank) => ({
    rank,
    items: puntos.filter(p => p.rank === rank).map(({ period, total, n }) => ({ period, total, n })),
  });
  return { mejor: armar(Math.max(...lugares)), peor: armar(Math.min(...(conCasos.length > 0 ? conCasos : lugares))) };
};

// Desde cuántos municipios en el mismo lugar se avisa (contando al propio)
const EMPATE_MIN = 10;

/** "312 municipios comparten este lugar (todos con 0 víctimas)", o null si el empate es chico. */
export const notaEmpate = (punto, unidad) => {
  if (!punto || !(punto.empatados >= EMPATE_MIN)) return null;
  const base = `${punto.empatados.toLocaleString('es-MX')} municipios comparten este lugar`;
  return punto.total === 0 ? `${base} (todos con 0 ${unidad})` : base;
};

/**
 * Columnas de una cuadrícula de selectores repartidos en filas parejas. Con `minCol` y `gap` caben
 * `max` columnas en `ancho`; se usan las filas que hagan falta y se reparte el resto en partes iguales
 * (8 selectores donde caben 6 quedan 4 + 4, no 6 + 2 con uno huérfano).
 */
export const columnasBalanceadas = (n, ancho, minCol, gap) => {
  const max = Math.max(1, Math.floor((Number(ancho) + gap) / (minCol + gap)) || 1);
  const filas = Math.ceil(n / max);
  return Math.max(1, Math.ceil(n / filas));
};

/**
 * ¿Caben los botones (Limpiar / Aplicar, `necesario` px) en la misma fila que `ocupadas` selectores
 * de una cuadrícula de `cols` columnas y `ancho` px? Se miden las columnas que quedan libres.
 */
export const accionesEnLaMismaFila = (cols, ocupadas, ancho, gap, necesario) => {
  const libres = cols - ocupadas;
  if (libres < 1 || !(ancho > 0)) return false;
  const anchoColumna = (ancho - (cols - 1) * gap) / cols;
  return libres * anchoColumna + (libres - 1) * gap >= necesario;
};

/**
 * Lógica pura de la pestaña Rankings (sin React): escala del eje, mejor/peor posición y nota de
 * empate. Pruebas: `node --test tests/rankings.test.js` desde frontend/.
 */

// Tope del eje Y según el lugar más bajo que alcanza la serie: un municipio que se mueve entre los
// lugares 5 y 40 se lee en una escala de 1 a 50, no de 1 a 2,500
const ESCALONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

/** Eje del ranking: { max, ticks } con tres marcas (1, la mitad y el tope). */
export const ejeRanking = (maxLugar) => {
  const lugar = Math.max(1, Math.ceil(Number(maxLugar) || 1));
  const max = ESCALONES.find(e => e >= lugar) ?? lugar;
  return { max, ticks: [1, Math.round(max / 2), max] };
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

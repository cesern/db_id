import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejeRanking, resumenPosiciones, notaEmpate, columnasBalanceadas, accionesEnLaMismaFila } from '../src/utils/rankings.js';

test('ejeRanking ajusta el dominio al rango de la serie, con margen y cifras redondas', () => {
  // Cajeme: lugares 67 a 113 de 2,478
  assert.deepEqual(ejeRanking(67, 113, 2478), { min: 50, max: 130, ticks: [50, 70, 90, 110, 130] });
  // cerca del 1 el eje arranca en 1
  assert.deepEqual(ejeRanking(2, 12, 2478), { min: 1, max: 14, ticks: [1, 8, 14] });
  // lugar constante: un margen mínimo alrededor
  assert.deepEqual(ejeRanking(85, 85, 2478), { min: 80, max: 90, ticks: [80, 85, 90] });
});

test('ejeRanking no pasa del total de municipios clasificados', () => {
  assert.deepEqual(ejeRanking(2470, 2478, 2478), { min: 2300, max: 2478, ticks: [2300, 2345, 2389, 2434, 2478] });
});

test('resumenPosiciones: mejor = lugar más alto, peor = más bajo, con todos los periodos empatados', () => {
  const serie = [
    { period: '2019', rank: 9, total: 12345, n: 2476 },
    { period: '2020', rank: 14, total: 9000, n: 2470 },
    { period: '2021', rank: 9, total: 12000, n: 2480 },
  ];
  const r = resumenPosiciones(serie);
  assert.equal(r.peor.rank, 9);
  assert.deepEqual(r.peor.items.map(i => i.period), ['2019', '2021']);
  assert.equal(r.mejor.rank, 14);
  assert.deepEqual(r.mejor.items, [{ period: '2020', total: 9000, n: 2470 }]);
  assert.equal(resumenPosiciones([]), null);
});

test('notaEmpate solo desde 10 empatados', () => {
  assert.equal(notaEmpate({ empatados: 9, total: 0 }, 'víctimas'), null);
  assert.equal(notaEmpate({ empatados: 312, total: 0 }, 'víctimas'), '312 municipios comparten este lugar (todos con 0 víctimas)');
  assert.equal(notaEmpate({ empatados: 1200, total: 3 }, 'delitos'), '1,200 municipios comparten este lugar');
  assert.equal(notaEmpate(null, 'delitos'), null);
});

test('resumenPosiciones: la peor posición no sale de un periodo en cero si hubo periodos con casos', () => {
  const serie = [
    { period: '2026-01', rank: 2, total: 0, n: 2478 },      // casi nadie tuvo casos: empate en el lugar 2
    { period: '2026-02', rank: 40, total: 3, n: 2478 },
    { period: '2026-03', rank: 900, total: 0, n: 2478 },
  ];
  const r = resumenPosiciones(serie);
  assert.equal(r.peor.rank, 40);
  assert.equal(r.mejor.rank, 900);
  assert.equal(resumenPosiciones([{ period: '2026-01', rank: 5, total: 0, n: 10 }]).peor.rank, 5);
});

test('columnasBalanceadas reparte los selectores en filas parejas, sin uno huérfano', () => {
  assert.equal(columnasBalanceadas(8, 1454, 160, 16), 8);   // caben todos: una fila
  assert.equal(columnasBalanceadas(8, 1100, 160, 16), 4);   // caben 6: 4 + 4 en lugar de 6 + 2
  assert.equal(columnasBalanceadas(6, 1100, 160, 16), 6);
  assert.equal(columnasBalanceadas(7, 1100, 160, 16), 4);   // 4 + 3
  assert.equal(columnasBalanceadas(8, 290, 160, 16), 1);    // celular: una columna
  assert.equal(columnasBalanceadas(3, 5000, 160, 16), 3);   // nunca más columnas que selectores
  assert.equal(columnasBalanceadas(8, 0, 160, 16), 1);      // sin medida: una columna
});

test('accionesEnLaMismaFila: los botones suben a la fila de Sexo y Rango de edad solo si caben', () => {
  // 6 columnas en 1480 px: tras 2 selectores quedan 4 columnas (~980 px) de sobra para ~360 px de botones
  assert.equal(accionesEnLaMismaFila(6, 2, 1480, 16, 360), true);
  // 3 columnas en 1000 px: queda una de ~320 px, no alcanza: bajan a su propia fila
  assert.equal(accionesEnLaMismaFila(3, 2, 1000, 16, 360), false);
  // sin columnas libres (o una sola columna) nunca caben
  assert.equal(accionesEnLaMismaFila(2, 2, 1000, 16, 360), false);
  assert.equal(accionesEnLaMismaFila(1, 2, 300, 16, 360), false);
  // sin medida del bloque: no se arriesga
  assert.equal(accionesEnLaMismaFila(6, 2, 0, 16, 360), false);
  // con los botones reales (~300 px: Limpiar 127 + Aplicar 160 + espacio) caben en una columna de ~323 px
  assert.equal(accionesEnLaMismaFila(3, 2, 1000, 16, 320), true);
  assert.equal(accionesEnLaMismaFila(3, 2, 960, 16, 320), false);
});

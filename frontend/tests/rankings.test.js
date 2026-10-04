import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ejeRanking, resumenPosiciones, notaEmpate } from '../src/utils/rankings.js';

test('ejeRanking sube al siguiente escalón', () => {
  assert.deepEqual(ejeRanking(12), { max: 25, ticks: [1, 13, 25] });
  assert.deepEqual(ejeRanking(46), { max: 50, ticks: [1, 25, 50] });
  assert.deepEqual(ejeRanking(2476), { max: 2500, ticks: [1, 1250, 2500] });
  assert.deepEqual(ejeRanking(1), { max: 10, ticks: [1, 5, 10] });
  assert.equal(ejeRanking(9000).max, 9000);   // por encima del último escalón: el propio valor
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

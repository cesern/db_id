import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claveGeo, buscarDatoGeo } from '../src/utils/geoMatch.js';

const sonora = [
  { name: 'Nacozari de García, Sonora', municipio: 'Nacozari de García', value: 69 },
  { name: 'Naco, Sonora', municipio: 'Naco', value: 18 },
  { name: 'Nácori Chico, Sonora', municipio: 'Nácori Chico', value: 2 },
  { name: 'Álamos, Sonora', municipio: 'Álamos', value: 5 },
];

test('Naco resuelve a Naco aunque Nacozari venga antes y tenga más valor', () => {
  assert.equal(buscarDatoGeo(sonora, 'Naco', true)?.value, 18);
  assert.equal(buscarDatoGeo(sonora, 'Naco', true)?.municipio, 'Naco');
});

test('cada municipio resuelve a su propia fila', () => {
  assert.equal(buscarDatoGeo(sonora, 'Nacozari de García', true)?.value, 69);
  assert.equal(buscarDatoGeo(sonora, 'Nácori Chico', true)?.value, 2);
  assert.equal(buscarDatoGeo(sonora, 'Naco', true)?.municipio, 'Naco');
});

test('compara sin acentos ni mayúsculas', () => {
  assert.equal(buscarDatoGeo(sonora, 'Alamos', true)?.municipio, 'Álamos');
  assert.equal(buscarDatoGeo(sonora, 'ÁLAMOS', true)?.municipio, 'Álamos');
});

test('no usa coincidencias por subcadena', () => {
  assert.equal(buscarDatoGeo(sonora, 'Nac', true), undefined);
  assert.equal(buscarDatoGeo(sonora, 'Nacozari', true), undefined);
  assert.equal(buscarDatoGeo(sonora, 'Sonora', true), undefined);
});

test('el mapa nacional compara contra name, no contra municipio', () => {
  const entidades = [
    { name: 'Ciudad de México', value: 1 },
    { name: 'México', value: 2 },
  ];
  assert.equal(buscarDatoGeo(entidades, 'México', false)?.value, 2);
  assert.equal(buscarDatoGeo(entidades, 'mexico', false)?.name, 'México');
  assert.equal(buscarDatoGeo(entidades, 'Estado de México', false), undefined);
});

test('sin fila o sin nombre devuelve undefined', () => {
  assert.equal(buscarDatoGeo(sonora, 'Hermosillo', true), undefined);
  assert.equal(buscarDatoGeo(sonora, '', true), undefined);
  assert.equal(buscarDatoGeo(sonora, null, true), undefined);
  assert.equal(buscarDatoGeo([], 'Naco', true), undefined);
});

test('claveGeo usa municipio en Sonora y name en el mapa nacional', () => {
  assert.equal(claveGeo(sonora[1], true), 'naco');
  assert.equal(claveGeo(sonora[1], false), 'naco, sonora');
  assert.equal(claveGeo({ name: 'México' }, false), 'mexico');
});

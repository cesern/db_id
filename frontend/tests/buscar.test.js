import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, filtrarOpciones, conteoOpciones } from '../src/utils/buscar.js';

const ops = [
  { value: 'All', label: 'Nacional' },
  { value: 'Álamos', label: 'Álamos' },
  { value: 'Cajeme', label: 'Cajeme' },
  { value: 'Cintalapa', label: 'Cintalapa de Figueroa' },
];

test('normalizar quita acentos, mayúsculas y espacios de los extremos', () => {
  assert.equal(normalizar('  ÁLAMOS '), 'alamos');
  assert.equal(normalizar(null), '');
});

test('filtrarOpciones encuentra sin importar acentos ni mayúsculas', () => {
  assert.deepEqual(filtrarOpciones(ops, 'alamos').map(o => o.value), ['Álamos']);
  assert.deepEqual(filtrarOpciones(ops, 'CIN').map(o => o.value), ['Cintalapa']);
  assert.deepEqual(filtrarOpciones(ops, 'ca').map(o => o.value), ['Cajeme']);
});

test('filtrarOpciones: vacío devuelve todo y sin coincidencias devuelve []', () => {
  assert.equal(filtrarOpciones(ops, '   ').length, 4);
  assert.deepEqual(filtrarOpciones(ops, 'zzz'), []);
});

const munis = [
  { value: 'All', label: 'Todos los municipios', noCuenta: true },
  { value: 'Álamos', label: 'Álamos' },
  { value: 'Cajeme', label: 'Cajeme' },
  { value: 'Otros', label: 'Otros Municipios', noCuenta: true },
  { value: 'Cintalapa', label: 'Cintalapa de Figueroa' },
];

test('conteoOpciones no cuenta "todos" ni las categorías residuales marcadas con noCuenta', () => {
  assert.equal(conteoOpciones(munis, munis, '', 'municipios'), '3 municipios');
  assert.equal(conteoOpciones(munis, filtrarOpciones(munis, 'ca'), 'ca', 'municipios'), '1 de 3 municipios');
  assert.equal(conteoOpciones(munis, filtrarOpciones(munis, 'todos'), 'todos', 'municipios'), '0 de 3 municipios');
});

test('conteoOpciones sin unidad dice "opciones"', () => {
  assert.equal(conteoOpciones(ops, ops, ''), '4 opciones');
  assert.equal(conteoOpciones(ops, filtrarOpciones(ops, 'cin'), 'cin'), '1 de 4 opciones');
});

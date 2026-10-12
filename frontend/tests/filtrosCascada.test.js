import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purgarSeleccion } from '../src/utils/filtrosCascada.js';

const opciones = {
  tiposDelito: ['Robo', 'Fraude'],
  subtiposDelito: ['Robo a casa habitación'],
  modalidades: ['Con violencia'],
  sexos: ['Hombre', 'Mujer'],
  rangosEdad: ['Adultos'],
};

test('purgarSeleccion conserva el mismo objeto si todo sigue siendo válido', () => {
  const sel = { bienJuridico: ['El patrimonio'], tipoDelito: ['Robo'], subtipoDelito: [], modalidad: ['Con violencia'], sexo: ['Mujer'], rangoEdad: [] };
  assert.equal(purgarSeleccion(sel, opciones), sel);
});

test('purgarSeleccion quita por nivel lo que ya no está entre las opciones', () => {
  const sel = { bienJuridico: ['El patrimonio'], tipoDelito: ['Robo', 'Homicidio'], subtipoDelito: ['Homicidio doloso'], modalidad: [], sexo: ['Hombre'], rangoEdad: ['Menores'] };
  assert.deepEqual(purgarSeleccion(sel, opciones), {
    bienJuridico: ['El patrimonio'], tipoDelito: ['Robo'], subtipoDelito: [], modalidad: [], sexo: ['Hombre'], rangoEdad: [],
  });
});

test('purgarSeleccion no toca el bien jurídico ni otros campos', () => {
  const sel = { dataset: 'delitos', bienJuridico: ['Otro'], tipoDelito: ['Homicidio'], subtipoDelito: [], modalidad: [], sexo: [], rangoEdad: [] };
  const out = purgarSeleccion(sel, opciones);
  assert.equal(out.dataset, 'delitos');
  assert.deepEqual(out.bienJuridico, ['Otro']);
  assert.deepEqual(out.tipoDelito, []);
});

test('purgarSeleccion tolera campos ausentes y opciones vacías', () => {
  const sel = { tipoDelito: ['Robo'] };
  assert.deepEqual(purgarSeleccion(sel, {}), { tipoDelito: [], subtipoDelito: [], modalidad: [], sexo: [], rangoEdad: [] });
  const vacia = { anio: 2026 };
  assert.equal(purgarSeleccion(vacia, opciones), vacia);
});

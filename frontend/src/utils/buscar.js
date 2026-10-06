/** Búsqueda de opciones sin acentos ni mayúsculas (selectores con buscador). Pruebas: tests/buscar.test.js */

export const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Opciones [{ value, label }] cuyo rótulo contiene el término; término vacío = todas. */
export const filtrarOpciones = (opciones, termino) => {
  const t = normalizar(termino);
  if (!t) return opciones;
  return opciones.filter(o => normalizar(o.label).includes(t));
};

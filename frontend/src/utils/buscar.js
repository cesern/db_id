/** Búsqueda de opciones sin acentos ni mayúsculas (selectores con buscador). Pruebas: tests/buscar.test.js */

export const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Opciones [{ value, label }] cuyo rótulo contiene el término; término vacío = todas. */
export const filtrarOpciones = (opciones, termino) => {
  const t = normalizar(termino);
  if (!t) return opciones;
  return opciones.filter(o => normalizar(o.label).includes(t));
};

/**
 * Texto del contador de un selector con buscador: "72 municipios" o, al buscar, "1 de 72 municipios".
 * No cuentan las opciones marcadas `noCuenta` (el "Todos" y las categorías residuales como
 * "No especificado"): el número es el de lugares reales.
 */
export const conteoOpciones = (opciones, visibles, termino, unidad = 'opciones') => {
  const total = opciones.filter(o => !o.noCuenta).length;
  if (!normalizar(termino)) return `${total} ${unidad}`;
  return `${visibles.filter(o => !o.noCuenta).length} de ${total} ${unidad}`;
};

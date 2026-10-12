// Cascada de filtros de delito/víctima: tras pedir a /api/filtros las opciones que corresponden a lo
// elegido, quita de la selección los valores que ya no existen (p. ej. un Tipo de otro Bien jurídico).
// La usan el tablero (Filters) y Rankings, para que ambos acoten igual.

// Campo de la selección -> clave de /api/filtros con sus opciones
const NIVELES = [
  ['tipoDelito', 'tiposDelito'],
  ['subtipoDelito', 'subtiposDelito'],
  ['modalidad', 'modalidades'],
  ['sexo', 'sexos'],
  ['rangoEdad', 'rangosEdad'],
];

// Devuelve el MISMO objeto si nada cambió (evita renders y efectos de más); si algo se quitó, uno nuevo
// con los cinco campos como arreglos. El bien jurídico no se purga: sus opciones no dependen de lo elegido.
export function purgarSeleccion(seleccion, opciones = {}) {
  let cambio = false;
  const purgados = {};
  for (const [campo, clave] of NIVELES) {
    const actual = Array.isArray(seleccion[campo]) ? seleccion[campo] : [];
    const validas = Array.isArray(opciones[clave]) ? opciones[clave] : [];
    purgados[campo] = actual.filter(v => validas.includes(v));
    if (purgados[campo].length !== actual.length) cambio = true;
  }
  return cambio ? { ...seleccion, ...purgados } : seleccion;
}

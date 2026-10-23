/** Emparejamiento entre polígonos del mapa y filas del API. Pruebas: tests/geoMatch.test.js */

import { normalizar } from './buscar.js';

/**
 * Clave de comparación de una fila: `municipio` en Sonora (el API entrega `name` como
 * "Naco, Sonora") y `name` en el mapa nacional (entidad).
 */
export const claveGeo = (d, isSonora) => normalizar(isSonora ? d?.municipio : d?.name);

/**
 * Busca la fila del polígono por nombre exacto normalizado. Sin coincidencia devuelve
 * undefined: nunca hereda el valor de otro municipio por una coincidencia parcial.
 */
export const buscarDatoGeo = (stateData, nombreGeo, isSonora) => {
  const clave = normalizar(nombreGeo);
  if (!clave) return undefined;
  return stateData.find((d) => claveGeo(d, isSonora) === clave);
};

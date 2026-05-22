/**
 * api.js
 * Módulo central para la configuración del API.
 * Importar API_URL desde aquí en lugar de hardcodear la URL en cada componente.
 *
 * Uso:
 *   import { API_URL } from '../api';
 *   axios.get(`${API_URL}/api/filtros`, { params })
 */

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

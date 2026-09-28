/**
 * api.js
 * Módulo central para la configuración del API.
 * Importar API_URL desde aquí en lugar de hardcodear la URL en cada componente.
 *
 * Uso:
 *   import { API_URL } from '../api';
 *   axios.get(`${API_URL}/api/filtros`, { params })
 */

import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

// Admin apagado por defecto: solo con VITE_ENABLE_ADMIN=true en el build
export const ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === 'true';

// ── Cliente del admin ─────────────────────────────────────────────────────────
// Envía la cookie de sesión (HttpOnly) y, en peticiones que modifican datos,
// el encabezado X-CSRF-Token con el token que devuelven /login y /me.

let csrfToken = null;

export const setCsrfToken = (token) => {
  csrfToken = token || null;
};

export const adminClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

adminClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (csrfToken && !['get', 'head', 'options'].includes(method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

import { createContext } from 'react';

/** Último mes con datos del año aplicado (1–12, o null). Lo provee PublicDashboard; lo leen los encabezados de pantalla completa. */
export const MesFinalContext = createContext(null);

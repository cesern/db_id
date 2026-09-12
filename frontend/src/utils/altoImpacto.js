/**
 * altoImpacto.js
 * Utilidades de la sección "Delitos Alto Impacto".
 * Los nombres de presets deben coincidir con PRESET_ALTO_IMPACTO del backend.
 */

export const ALTO_IMPACTO_PRESETS = [
  "Homicidio doloso",
  "Feminicidio",
  "Secuestro",
  "Extorsión",
  "Robo de vehículo",
  "Robo con violencia",
  "Violación"
];

// Configuración equivalente de cada preset para deduplicación.
// Claves: b (bien jurídico), t (tipo), s (subtipo), m (modalidad).
// El prefijo "!" en un valor representa exclusión (<>), solo para comparación.
const PRESET_CONFIGS = {
  "Homicidio doloso": { s: "Homicidio doloso" },
  "Feminicidio": { s: "Feminicidio" },
  "Secuestro": { t: "Secuestro" },
  "Extorsión": { t: "Extorsión" },
  "Robo de vehículo": { s: "Robo de vehículo automotor - Coche de 4 ruedas" },
  "Robo con violencia": { t: "Robo", s: "!Robo de vehículo automotor - Coche de 4 ruedas", m: "Con violencia" },
  "Violación": { t: "Violación" }
};

const norm = (v) => String(v || "").trim().toLowerCase();

/** Llave normalizada de una config {b,t,s,m} para comparar duplicados. */
export function configKey(cfg) {
  if (!cfg) return "";
  return ["b", "t", "s", "m"].map(k => norm(cfg[k])).join("|");
}

/**
 * Parsea un token de cápsula.
 * Retorna { name, config, isCustom }. config es null si no se pudo interpretar.
 */
export function parseCapsule(token) {
  if (typeof token !== "string") return { name: String(token), config: null, isCustom: false };
  if (token.startsWith("CUSTOM:")) {
    try {
      const cfg = JSON.parse(token.slice("CUSTOM:".length));
      const config = {};
      if (cfg.b) config.b = String(cfg.b);
      if (cfg.t) config.t = String(cfg.t);
      if (cfg.s) config.s = String(cfg.s);
      if (cfg.m) config.m = String(cfg.m);
      return { name: cfg.n ? String(cfg.n) : "Personalizado", config, isCustom: true };
    } catch {
      return { name: token, config: null, isCustom: true };
    }
  }
  return { name: token, config: PRESET_CONFIGS[token] || null, isCustom: false };
}

/**
 * Revisa si una config ya existe entre presets y customs.
 * Retorna el nombre visible de la cápsula duplicada, o null.
 */
export function findDuplicateCapsule(cfg, customTokens) {
  const key = configKey(cfg);
  if (!key.replace(/\|/g, "")) return null;
  for (const preset of ALTO_IMPACTO_PRESETS) {
    if (configKey(PRESET_CONFIGS[preset]) === key) return preset;
  }
  for (const token of customTokens || []) {
    const parsed = parseCapsule(token);
    if (parsed.config && configKey(parsed.config) === key) return parsed.name;
  }
  return null;
}

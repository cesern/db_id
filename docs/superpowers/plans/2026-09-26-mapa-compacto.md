# Mapa compacto + cifras completas en barras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar más ancho a la columna central (barras y línea) achicando la columna del mapa en escritorio, para que las etiquetas de la gráfica de barras muestren siempre la cifra completa en horizontal. El análisis detallado del mapa se hace en pantalla completa.

**Architecture:** Solo cambian proporciones CSS del `.dashboard-grid` en escritorio, la presentación del mapa en vista normal (leyenda compacta y pista para ampliar) y la regla de etiquetas de `ChartBarYears`. No cambian el backend, los datos ni la vista en pantalla completa. El mapa sigue interactivo en la vista normal (variante A del brainstorming).

**Tech Stack:** React 19 + Vite, Recharts 3 (`BarChart`, `LabelList`), react-simple-maps, CSS en `frontend/src/index.css` con estilos en línea.

**Spec:** decisión tomada en chat el 2026-09-26 (brainstorming "mapa más pequeño"). El mapa es **de referencia, poco usado**; se eligió la **variante A** (columna angosta, mapa interactivo) sobre la miniatura (C). No hay spec en archivo; este plan resume la decisión.

## Global Constraints

- Audiencia: analista de la Fiscalía, en escritorio; tono sobrio. Nada de animación nueva en acciones frecuentes (Emil: lo que se usa decenas de veces al día no se anima).
- Grid a ≥1280px: `300px 1.4fr 0.8fr` (antes `300px 1.1fr 1fr`). Entre 1024 y 1279px: `280px 1.3fr 0.85fr` (antes `280px 1fr 1fr`). Por debajo de 1024px **no cambia nada**.
- Las etiquetas de barras muestran **siempre la cifra completa** (`Intl.NumberFormat('es-MX')`). Se elimina el formato compacto ("36.1 k") de las etiquetas; el tooltip no cambia.
- Texto mínimo de 12px en la vista normal. Contraste ≥4.5:1 (usar `var(--text-secondary)` = `#526075`, nunca `#64748b`).
- Pantalla completa del mapa y de las barras: sin cambios visuales, salvo que heredan la nueva regla de etiquetas.
- Sin dependencias nuevas.
- No hay runner de pruebas en el frontend: cada tarea se verifica en el navegador (`localhost:5173`, backend `:8000`) con los snippets de JS de sus pasos, más `npx vite build` y `npx eslint .` (sin avisos nuevos; la base actual es 32).

## Review Focus

1. **Pantalla de 1280–1366px (laptop):** la columna central es la más angosta; las 12 etiquetas deben verse completas y sin encimarse. Se cubre en el Task 2, paso 4.
2. **Vista nacional (Entidad = Nacional):** en la columna angosta el mapa de México debe seguir entero, sin recortes, y la leyenda no debe tapar la península de Baja California ni Yucatán. Se cubre en el Task 3, paso 4.
3. **Modo tasa:** cifras como "1,234.56" son más largas que las absolutas; deben verse completas (se escalonan si hace falta). Se cubre en el Task 2, paso 4.
4. **Año parcial (2026, "Ene–Ago"):** la etiqueta bajo el eje y la barra punteada deben seguir funcionando con el escalonado. Se cubre en el Task 2, paso 4.
5. **Exportar PNG del mapa:** la leyenda compacta debe salir en la imagen exportada, porque el analista la pega en informes. Se cubre en el Task 3, paso 4.

## Archivos

| Archivo | Responsabilidad en este plan |
|---|---|
| `frontend/src/index.css` | Proporciones del grid (Task 1) |
| `frontend/src/components/ChartBarYears.jsx` | Separación entre barras y regla de etiquetas completas con escalonado (Task 2) |
| `frontend/src/components/MapMexico.jsx` | Leyenda compacta y pista "Ampliar" en el encabezado (Task 3) |
| `AGENTS.md` | Registrar las nuevas proporciones y la regla de etiquetas (Task 4) |

**Prerrequisito (antes del Task 1):** los cambios de la ronda 2 de impeccable (año parcial, leyenda del mapa, Rankings, chip "Todos", pestañas en móvil, `.gitignore`) siguen **sin commit**. Hay que hacer commit primero para que este plan parta de un árbol limpio.

---

### Task 1: Proporciones del grid en escritorio

**Files:**
- Modify: `frontend/src/index.css` (bloques `@media (min-width: 1024px)` y `@media (min-width: 1280px)` de `.dashboard-grid`, hoy en las líneas 263 y 272)

**Interfaces:**
- Consumes: nada.
- Produces: la columna del mapa (`.dashboard-col-map`) queda más angosta; el Task 2 y el Task 3 se miden sobre este layout.

- [ ] **Step 1: Medir el estado actual (línea base).** En `localhost:5173` a 1440×900, ejecuta:
  ```js
  const cols=[...document.querySelectorAll('.dashboard-col')].map(c=>Math.round(c.getBoundingClientRect().width)); cols
  ```
  Resultado esperado aproximado: `[300, ~575, ~520]`. Anota los valores.
- [ ] **Step 2: Cambiar las proporciones.** A ≥1280px, `grid-template-columns: 300px 1.4fr 0.8fr`. A ≥1024px, `280px 1.3fr 0.85fr`.
- [ ] **Step 3: Verificar.** Repite el snippet a 1440×900. Esperado: la columna central mide ≥660px y el mapa ≥380px. Repite a 1280×800 y a 1100×800: ninguna columna debe medir menos de 330px y `document.documentElement.scrollWidth === innerWidth`.
- [ ] **Step 4: Verificar que nada cambió en tablet y móvil.** A 800px y 375px, el snippet debe devolver lo mismo que antes del cambio.
- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/index.css
  git commit -m "Layout: columna del mapa más angosta en escritorio"
  ```

### Task 2: Etiquetas de barras con cifra completa

**Files:**
- Modify: `frontend/src/components/ChartBarYears.jsx` (props de `<BarChart>`, línea ~402; `content` del `<LabelList>`; margen superior del chart)

**Interfaces:**
- Consumes: el layout del Task 1.
- Produces: nada que usen otras tareas.

**Decisiones:**
- `barCategoryGap="14%"` en `<BarChart>`: barras más anchas; hoy se usa el 10% por defecto con barras delgadas por el ancho de la columna.
- Las etiquetas siempre usan `formatValue(value)` (cifra completa). Se elimina el uso de `formatCompactValue` **solo en las etiquetas**; la función puede quedarse si otra parte del archivo la usa.
- **Escalonado condicional:** si alguna etiqueta mide más que el ancho de su barra (`String(text).length * fs * 0.6 > width`), las etiquetas de índice impar se suben `fs + 4px` adicionales. Si ninguna choca, todas quedan a la altura normal. La decisión se toma una vez por render, con todas las barras, no barra por barra, para que el patrón sea regular.
- El margen superior del `BarChart` crece `fs + 4px` solo cuando hay escalonado, para que las etiquetas altas no se corten.
- **Sin animación nueva** (Emil: es una gráfica que se reconsulta con cada filtro).

- [ ] **Step 1: Reproducir el problema.** A 1440×900 con los filtros por defecto, ejecuta:
  ```js
  const t=[...document.querySelectorAll('.recharts-label-list text')].map(e=>e.getBoundingClientRect());
  const overlaps=t.some((a,i)=>t.slice(i+1).some(b=>a.right>b.left+1&&b.right>a.left+1&&a.bottom>b.top+1&&b.bottom>a.top+1));
  ({n:t.length, compact:[...document.querySelectorAll('.recharts-label-list text')].some(e=>/k|mil/.test(e.textContent)), overlaps})
  ```
  Hoy devuelve `compact: true` (se usa el formato compacto).
- [ ] **Step 2: Implementar.** `barCategoryGap="14%"`, la regla de etiqueta completa y el escalonado condicional, según las decisiones anteriores.
- [ ] **Step 3: Verificar la vista por defecto.** Repite el snippet del paso 1 a 1440×900. Esperado: `compact: false`, `overlaps: false`, y cada texto es la cifra con comas (ej. `36,125`).
- [ ] **Step 4: Verificar los casos de Review Focus.** Con el mismo snippet, esperado `compact:false, overlaps:false` en:
  - 1280×800 y 1366×768
  - Entidad = Nacional, cifras de 6 o 7 dígitos
  - Modo "Tasa por 100 mil hab."
  - La barra de 2026 sigue punteada y conserva "Ene–Ago" bajo el eje
  - Pantalla completa de la gráfica: todas las etiquetas a la misma altura, sin escalonado, porque ahí caben
- [ ] **Step 5: Build y lint.** `npx vite build` compila. `npx eslint .` reporta ≤32 problemas.
- [ ] **Step 6: Commit**
  ```bash
  git add frontend/src/components/ChartBarYears.jsx
  git commit -m "Barras: cifra completa en etiquetas con escalonado si chocan"
  ```

### Task 3: Leyenda compacta y pista para ampliar el mapa

**Files:**
- Modify: `frontend/src/components/MapMexico.jsx` (bloque de la leyenda agregado en la ronda 2, justo después de `</ComposableMap>`; encabezado con `<h3>` en la línea ~328 y el botón de pantalla completa)

**Interfaces:**
- Consumes: `maxVal`, `formatValue`, `tooltipLabel`, `metricType`, `isFullScreen`, `fsScale` (ya existen en `MapMexico`).
- Produces: nada que usen otras tareas.

**Decisiones:**
- **Leyenda en vista normal:** una sola fila. Gradiente de 64×6px, `0`, `–`, `formatValue(maxVal)`, y el recuadro "Sin dato" de 8×8px. Letra de 12px, fondo `rgba(255,255,255,0.92)`, borde `var(--border-color)`, radio 6px, posición `left:0.5rem; bottom:0.5rem`. El título de la métrica se quita de la leyenda porque ya está en el `<h3>`.
- **Leyenda en pantalla completa** (`isFullScreen`): se queda como está hoy (bloque de 3 filas con título).
- **Pista para ampliar:** el botón de pantalla completa del encabezado pasa de solo ícono a ícono + texto "Ampliar" (12px, `var(--text-secondary)`), solo en la vista normal. Conserva `aria-label="Ver en pantalla completa"`.
- **Estados del botón:** el hover solo aplica bajo `@media (hover: hover) and (pointer: fine)`. Se reutiliza la clase `.icon-btn`, que ya tiene la respuesta al presionar (`scale(0.97)`). Sin transición nueva.

- [ ] **Step 1: Línea base.** A 1440×900 (con el Task 1 hecho), mide la leyenda:
  ```js
  const l=document.querySelector('[aria-label^="Escala de color"]').getBoundingClientRect(); ({w:Math.round(l.width),h:Math.round(l.height)})
  ```
  Hoy mide unos 150×60px.
- [ ] **Step 2: Implementar** la leyenda compacta en vista normal y el botón "Ampliar", según las decisiones anteriores.
- [ ] **Step 3: Verificar la leyenda.** Repite el snippet. Esperado: altura ≤28px y ancho ≤220px. El `aria-label` de la leyenda sigue igual ("Escala de color: de 0 a …").
- [ ] **Step 4: Verificar los casos de Review Focus.**
  - Entidad = Nacional: la leyenda no se superpone a ningún estado. Verifícalo visualmente en una captura; Baja California Sur y Yucatán deben verse completos.
  - Exporta el mapa como PNG desde el menú de exportación: la leyenda compacta aparece en la imagen.
  - En pantalla completa del mapa: la leyenda es la versión de 3 filas.
  - Con teclado: Tab llega a "Ampliar", Enter abre la pantalla completa y Escape la cierra.
- [ ] **Step 5: Build y lint.** Igual que en el Task 2.
- [ ] **Step 6: Commit**
  ```bash
  git add frontend/src/components/MapMexico.jsx
  git commit -m "Mapa: leyenda compacta y botón Ampliar en vista normal"
  ```

### Task 4: Documentación y revisión final

**Files:**
- Modify: `AGENTS.md` (sección 7, línea de estilos "grid `.dashboard-grid`", y la sección 14c "Ronda 2")

**Interfaces:**
- Consumes: los valores de los Tasks 1–3.
- Produces: documentación.

- [ ] **Step 1:** En la sección 7 de `AGENTS.md`, reemplaza el grid documentado por `1fr -> 768px 1fr 1fr -> 1024px 280px 1.3fr 0.85fr -> 1280px 300px 1.4fr 0.8fr`. En la sección 14c agrega:
  - "Mapa compacto (2026-09-26): columna angosta, leyenda de una fila en vista normal, botón 'Ampliar'; análisis detallado en pantalla completa."
  - "Barras: siempre cifra completa; escalonado de etiquetas impares solo si alguna no cabe."
- [ ] **Step 2: Ronda visual final** (un solo lote, sin iterar más): capturas a 1440×900, 1280×800 y 375×812 en Delitos, Víctimas y Nacional. Confirma que no hay desplazamiento lateral y que no hay errores en consola.
- [ ] **Step 3: Detector.** `.claude/skills/impeccable/scripts/impeccable detect --json frontend/src`: solo los 2 hallazgos conocidos de `overused-font`.
- [ ] **Step 4: Commit**
  ```bash
  git add AGENTS.md
  git commit -m "docs: layout con mapa compacto y regla de etiquetas"
  ```

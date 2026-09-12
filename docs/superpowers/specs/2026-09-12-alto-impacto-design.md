# Spec: Sección "Delitos de Alto Impacto"

- Fecha: 2026-09-12
- Estado: aprobado por secciones (S1 backend, S2 estado/cable, S3 UI) en brainstorming
- Alcance: nueva sección del dashboard sobre dataset `delitos`, sin cambiar arquitectura

## 1. Objetivo

Agregar la opción **Delitos Alto Impacto** junto a Delitos / Víctimas / Víctimas Municipios.
Internamente usa el dataset `delitos` + una capa de filtrado por cápsulas. Todo lo
existente sigue funcionando igual. Se reutilizan componentes, hooks, estilos,
endpoints y patrones actuales. Sin librerías ni arquitecturas nuevas.

## 2. Decisiones cerradas

- Modo solo-UI: el estado frontend usa `dataset='alto_impacto'`; al cable sale
  `dataset=delitos&altoImpacto=...` (el `DatasetEnum` del backend solo admite
  `delitos|victimas|victimas_mun`; enviar `alto_impacto` daría 422).
- Combinación de cápsulas = OR (un registro cuenta si cae en >= 1 cápsula activa).
- Arreglo vacío = sin resultados (`[]` / `0`), nunca "todo sin filtrar".
- Al entrar al modo: las 7 preset activas; se limpian bien/tipo/subtipo/modalidad.
- La barra conserva Año, Entidad, Municipio, Meses, métrica Absoluta/Tasa,
  Limpiar/Aplicar; solo los 4 MultiSelect de delito se reemplazan por chips.
- Customs viven en estado a nivel `PublicDashboard` (sobreviven cambios de dataset);
  al re-entrar se reactivan las 7 preset.
- `HistoryRankings` y `TableTopCrimes` (huérfano) quedan fuera de alcance.
- Sin cambios en Admin, ETL, Parquet ni deploy.

## 3. Backend (1 archivo: `backend/app/main.py`)

- Nueva constante `PRESET_ALTO_IMPACTO` (única fuente de verdad), cada preset =
  lista de bloques; cada bloque = lista de `(columna, operador, valor)`:
  - Homicidio doloso: `("Subtipo de delito", "=", "Homicidio doloso")`
  - Feminicidio: `("Subtipo de delito", "=", "Feminicidio")`
  - Secuestro: `("Tipo de delito", "=", "Secuestro")`
  - Extorsión: `("Tipo de delito", "=", "Extorsión")`
  - Robo de vehículo: `("Subtipo de delito", "=", "Robo de vehículo automotor - Coche de 4 ruedas")`
  - Robo con violencia: `("Tipo de delito", "=", "Robo")` +
    `("Subtipo de delito", "<>", "Robo de vehículo automotor - Coche de 4 ruedas")` +
    `("Modalidad", "=", "Con violencia")`
  - Violación: `("Tipo de delito", "=", "Violación")`
  - Verificar estos literales contra los `DISTINCT` reales de `/api/filtros` en implementación.
- `build_where()` gana el parámetro `altoImpacto=None` (después de `rangoEdad`,
  antes de `additional_clause`). Si llega no vacío: `split('|')`, cada token es
  nombre preset o `CUSTOM:{json}`; cada token produce un bloque `(cond AND cond...)`;
  los bloques se unen con OR dentro de un paréntesis que se agrega a `where_clauses`.
  Todo parametrizado con `?` (nunca interpolar valores); los params se agregan en orden.
- `CUSTOM:{...}`: `json.loads` con try/except (token malformado = se ignora ese token);
  claves `b|t|s|m` → columnas `Bien jurídico afectado|Tipo de delito|Subtipo de delito|Modalidad`;
  solo niveles presentes y no vacíos entran al AND. Si no queda ninguna condición,
  el token se ignora.
- Solo filtra si la columna existe en `valid_cols` (patrón actual); si el arreglo
  queda sin bloques válidos, forzar condición falsa (`1=0`) para cumplir "vacío=vacío".
- Sin rutas nuevas ni duplicar consultas. Heredan gratis todos los endpoints que
  llaman a `build_where` (`filtros`, `total_incidencia`, `incidencia_por_entidad`,
  `incidencia_por_municipio`, `incidencia_por_anio`, `incidencia_por_mes_historico`,
  `incidencia_por_delito`, `ranking_historico`). En implementación auditar que cada
  endpoint reenvíe el nuevo query param `altoImpacto` a `build_where`.

## 4. Frontend estado y cable

- `PublicDashboard.jsx`: `INITIAL_FILTERS += { altoImpacto: [] }`; constante
  `ALTO_IMPACTO_DEFAULT = [7 presets]`; `handleDatasetChange('alto_impacto')`
  inicializa `altoImpacto` con las 7 y limpia delito clásico; customs persistentes
  en estado del dashboard.
- Helper por componente que consulta: `wireDataset = dataset==='alto_impacto' ? 'delitos' : dataset`
  + anexar `altoImpacto=arr.join('|')` cuando aplique. Archivos:
  `SidebarLeft.jsx` (3 llamadas), `ChartBarYears.jsx` (principal + drill subtipo),
  `ChartLineTrend.jsx` (+ export con rango del slider), `MapMexico.jsx`
  (entidades/municipios + 2 drills), `Filters.jsx` (cascada con `dataset=delitos`
  SIN `altoImpacto` para no autolimitarse).
- `Header.jsx`: opción `{ id: 'alto_impacto', label: 'Delitos Alto Impacto' }` +
  título correspondiente; `DATASET_COLORS += { alto_impacto: '#b91c1c' }`;
  `FullScreenHeader.jsx:38` badge "Delitos de Alto Impacto". El resto de ternarios
  `isVictimas*` ya cae al lado Delitos/Incidencia (conducta deseada).

## 5. UI cápsulas y modal

- `Filters.jsx`, rama `dataset==='alto_impacto'`: conserva Año/Entidad/Municipio/
  Meses/métrica/Limpiar/Aplicar+badge; chips con estilo `btn-toggle` existente;
  botón `+ Agregar delito`; customs con `×`; Limpiar restaura las 7 preset.
- Nuevo `frontend/src/components/AltoImpactoModal.jsx` (único archivo nuevo;
  patrón visual `InfoModal`, overlay + Escape): 4 selects en cascada
  Bien→Tipo→Subtipo→Modalidad vía `/api/filtros?dataset=delitos` reutilizando la
  purga en cascada; campo "Nombre de la cápsula"; dedup por config exacta
  normalizada `b|t|s|m` contra presets mapeados y customs (coincidencias listadas,
  alta bloqueada); validación que prohíbe `|` en el nombre (rompería el separador).
  Confirmar crea `CUSTOM:{"n":..,"b":..,"t":..,"s":..,"m":..}` (solo niveles
  definidos), activa la cápsula y aplica el dashboard de inmediato.

## 6. Export y etiquetas

- `exportUtils.downloadCSV`: bloque de filtros con `Dataset: Delitos de Alto Impacto`
  + cápsulas activas (nombres visibles, no JSON crudo); filenames `alto_impacto_*`.
- `FullScreenHeader`: badge "Alto Impacto (N)" con tooltip de nombres.

## 7. Pruebas

- Backend (venv): `build_where` con cada preset genera el SQL esperado y parametriza
  valores (incl. `<>` de Robo con violencia); `CUSTOM` parcial (solo b+t) genera AND
  de 2; token malformado se ignora; vacío → `1=0`; `GET /api/ranking_historico` y
  `/api/incidencia_por_*` con `altoImpacto=Feminicidio` devuelven subconjunto.
- Frontend (`npm run dev` + `npm run build`): entrar al modo activa las 7;
  togglear chips actualiza Sidebar/mapa/gráficas; drill-downs respetan el filtro;
  modal en cascada + dedup + validación `|`; custom persiste al cambiar de dataset;
  CSV contiene etiqueta y cápsulas; switches entre datasets no rompen filtros.

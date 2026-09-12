# AGENTS.md — Dashboard Incidencia Delictiva

Guía práctica para agentes IA que trabajen en ESTE repositorio. Basada en el código real al 2026-09-12. No modificar código sin leer esta guía.

## 1. Propósito

Sistema analítico de incidencia delictiva (fuentes SESNSP + población CONAPO):

- Dashboard público con filtros, KPI, tablas, gráficas de barras/años, tendencia mensual, mapa México/Sonora, rankings históricos.
- Panel admin en `/admin` con login JWT en cookie HttpOnly, subida CSV, ETL a Parquet y recarga DuckDB sin reiniciar.
- Sin base de datos tradicional: DuckDB in-memory lee Parquet columnares.

## 2. Arquitectura

```
CSV anchos (meses como columnas)
  -> backend/convertir_datos.py (melt + NFC + downcast/category + zstd/snappy)
  -> backend/storage/parquet/*.parquet
  -> backend/app/main.py: reload_duckdb_views() crea VIEWS delitos,victimas,victimas_mun,poblacion sobre read_parquet()
  -> FastAPI GET /api/* (DuckDB + pandas merge para tasas)
  -> frontend (axios + VITE_API_URL) React + Recharts + react-simple-maps
Admin: POST /api/admin/upload -> storage/uploads/ -> POST /run-etl (subprocess convertir_datos.py) -> POST /reload-db
```

Decisión clave: todo el estado analítico vive en `db = duckdb.connect(':memory:')` global en `backend/app/main.py:33` + caches pandas globales `CACHE_POB_DF, CACHE_ENT_MAP, CACHE_MUN_MAP, CACHE_MUN_POB_DF, CACHE_MERGED_POP`. Se pueblan en import (`reload_duckdb_views()` línea 87).

## 3. Estructura de carpetas (real)

```
backend/
  app/main.py (732 líneas, núcleo API, 9 endpoints GET públicos)
  app/config.py (BaseSettings, singleton settings)
  app/routes/admin.py (177 líneas, prefix /api/admin)
  app/routes/__init__.py (solo "# Init")
  app/services/auth.py (29 líneas, JWT cookie)
  convertir_datos.py (482 líneas, ETL)
  convertir_datos.bat (solo Windows, usa venv\Scripts\python.exe)
  requirements.txt, .env.example, .gitignore
  storage/parquet/delitos.parquet, victimas.parquet, victimas_mun.parquet, pob_municipios.parquet
  # NO existen en repo: storage/uploads/, data/, .env, venv/ (se crean on-demand)
frontend/
  src/main.jsx (StrictMode + App), App.jsx (router), PublicDashboard.jsx (254 lín, orquestador)
  src/api.js (solo export API_URL)
  src/components/Header.jsx, Filters.jsx (575), SidebarLeft.jsx (472), ChartBarYears.jsx (336),
    ChartLineTrend.jsx (702), MapMexico.jsx (419), TableTopCrimes.jsx (213, HUÉRFANO),
    HistoryRankings.jsx (780), DrillDownModal.jsx, ExportMenu.jsx, FullScreenHeader.jsx,
    InfoModal.jsx, LoadingSpinner.jsx
  src/components/admin/Login.jsx, AdminDashboard.jsx
  src/utils/exportUtils.js (214, CSV/PNG/clipboard)
  src/index.css (382, design system), App.css (40, residuo Vite, colisiona .card)
  public/mexico_geo.json, sonora_geo.json (usados), mexico.json, sonora.json (no usados),
    logo.png, fgje_ico.png, mapa.png (no referenciado), vite.svg (residuo)
  vite.config.js, eslint.config.js, package.json, .env.example, index.html
raíz/
  iniciar.bat, setup_backend.bat, setup_frontend.bat, render.yaml, README.md, INSTRUCCIONES.md,
  fix_quotes.py, refactor.py, generate_pdf_analysis.py, cls/ (no auditado, fuera del runtime)
```

## 4. Tecnologías reales (no asumir otras)

Backend (`backend/requirements.txt`): `fastapi==0.136.1, uvicorn==0.46.0, duckdb>=1.0.0, pandas==2.3.3, numpy==2.2.6, pyarrow>=15.0.0, pydantic==2.13.4, pydantic-settings>=2.2.1, python-multipart, PyJWT, openpyxl==3.1.5`. Falta `chardet` aunque `convertir_datos.py:451` hace `import chardet`.

Frontend (`frontend/package.json`): `react ^19.2.0, react-dom ^19.2.0, react-router-dom ^7.15.1, vite ^7.3.1, axios ^1.16.0, recharts ^3.8.1, react-simple-maps ^3.0.0, d3-scale ^4.0.2, d3-scale-chromatic ^3.1.0 (instalado pero no importado), html-to-image ^1.11.13, sonner ^2.0.7, prop-types ^15.8.1`.

## 5. Flujo de datos

1. CSV entrada: 12 columnas mes `Enero...Diciembre` + columnas ID.
   - `COLUMNAS_ID_DELITOS` en `convertir_datos.py:42`: Año, Clave_Ent, Entidad, Cve. Municipio, Municipio, Bien jurídico afectado, Tipo de delito, Subtipo de delito, Modalidad.
   - `COLUMNAS_ID_VICTIMAS` (`:47`): igual sin municipio + Sexo, Rango de edad.
   - `COLUMNAS_ID_VICTIMAS_MUN` (`:51`): con municipio + Sexo, Rango de edad.
2. ETL `convertir_csv()`: detecta encoding `utf-8-sig -> latin-1`, normaliza NFC, `reparar_encoding`, `melt(var_name="Mes", value_name="Víctimas"|"Incidencia")` según nombre, `to_numeric(coerce)->dropna->int64`, `analizar_y_optimizar()` (downcast int8/16/32 por rango + object->category si ahorro >=5%, aplica solo si ahorro total >=10% `UMBRAL_AHORRO_PORCENTAJE`, compresión `zstd` si optimiza sino `snappy`), `to_parquet(pyarrow)`.
3. Población: `convertir_poblacion_csv()` guarda directo `snappy` sin optimizar.
4. Backend: vistas DuckDB + caches. Tasas = `(total / poblacion) * 100000 round 2`. Año más cercano si no existe. `get_poblacion_valor()` en `main.py:97-158`.
5. Frontend: `GET /api/*` con `dataset, anio, entidad, municipio, bienJuridico|tipoDelito|subtipoDelito|modalidad|sexo|rangoEdad (separador |), meses (separador ,), metric_type=absolute|rate, categoria, nivel, temporalidad`.

Consultas principales (todas GET sin auth en `main.py`):
` /api/filtros, /api/total_incidencia, /api/incidencia_por_entidad, /api/incidencia_por_municipio, /api/incidencia_por_anio, /api/incidencia_por_mes_historico, /api/incidencia_por_delito?categoria=bien_juridico|tipo_delito|subtipo_delito, /api/ranking_historico?nivel=entidad|municipio&temporalidad=anual|acumulado|mensual, /incidencia (diagnóstico COUNT + PRAGMA + timing)`.

## 6. Backend — cómo funciona

- Entrada: `uvicorn app.main:app` desde `backend/`. `BASE_DIR=backend/`, `PARQUET_DIR/ DATA_DIR` vienen de `settings`.
- `DatasetEnum` en `main.py:11`: solo `delitos, victimas, victimas_mun`. `poblacion` es vista interna, no enum.
- `build_where()` (`main.py:160`): solo filtra si columna existe en `PRAGMA table_info` (permite esquemas distintos). `anio` es `"Año" = ?`, resto `IN (?)`. `additional_clause` se concatena crudo (solo uso interno).
- `obtener_filtros`: cascada (anios global; entidades por anio/sexo/edad; bienes +entidad; municipios solo si `entidad!=All`; tipos +bien; subtipos +tipo; modalidades +subtipo; sexos/rangos globales).
- `incidencia_por_entidad` ignora filtro `entidad/municipio` a propósito y fuerza `Entidad IS NOT NULL`. `incidencia_por_anio` ignora `anio` y agrupa todo. `ranking_historico` filtra municipios a `*, Sonora` + top3 si `nivel==municipio`.
- Columna valor: `'Víctimas' if 'victimas' in dataset.value else 'Incidencia'` — aplica a `victimas` y `victimas_mun`.
- Rate: si `pop<=0` retorna `{"total_incidencia":"N/D"}` o `"N/D"` por celda (string, no número). Entidades usan `fillna(1)`, municipios `fillna(0)->None`.
- Admin (`routes/admin.py`): `POST /login` compara texto plano con `settings`, cookie `admin_session` HttpOnly 8h (`samesite=lax` local, `none+secure` si `environment!=local`); `GET /me`, `POST /logout`, `POST /upload` (solo `.endswith(".csv")`, guarda `.tmp` luego valida `pd.read_csv(nrows=0)`, `shutil.move`), `POST /run-etl` (BackgroundTasks -> `run_etl_process()` con `Popen([sys.executable, convertir_datos.py, --delitos uploads/delitos_combinado.csv, --victimas uploads/victimas_combinado.csv, --victimas-mun uploads/victimas_combinado_municipal_2026.csv, --salida-* parquet/*.parquet, --poblacion data/pob_municipios.csv, ...])` + `reload_duckdb_views()`), `GET /etl-status` (dict global `idle|processing|completed|error`), `POST /reload-db`.
- Auth (`services/auth.py`): `APIKeyCookie(name="admin_session", auto_error=False)`, `jwt.encode/decode` con `settings.jwt_secret/jwt_algorithm`, valida `sub==admin_user`. Usa `datetime.utcnow()` (deprecado).
- Errores: endpoints públicos casi sin try/except (500 si falta tabla). Solo rate tiene fallback `"N/D"`. `reload_duckdb_views` traga errores con `print`.

## 7. Frontend — cómo funciona

- Entrada `index.html -> /src/main.jsx -> App.jsx`. Rutas en `App.jsx:19-31`: `/ -> PublicDashboard`, `/admin,/admin/login -> Login`, `/admin/dashboard -> AdminDashboard` (envuelto en `ProtectedRoute` que es no-op, retorna `children`), `* -> /`.
- `src/api.js:11`: `export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'`. Excepciones: `admin/Login.jsx` usa `VITE_API_URL` sin fallback, `admin/AdminDashboard.jsx` usa `|| 'http://localhost:8000'` (host distinto).
- `PublicDashboard.jsx`: `INITIAL_FILTERS={dataset:"delitos", anio:2026, entidad:"All", municipio:"All", resto []}`, `DATASET_COLORS={delitos:#455993, victimas:#ef4444, victimas_mun:#7c3aed}`. Patrón central `selectedFilters` (edición) vs `appliedFilters` (consultas) + `handleApply/handleClear/handleDatasetChange` (este último aplica inmediato). Splash `#081C3A/#C8A96B` con timeout 10s + `componentsLoading {filters,sidebar,barChart,lineChart,map:true, topCrimes:false}`.
- Componentes y endpoints:
  - `Filters.jsx`: 2 llamadas a `/api/filtros` (base por `applied`, cascada por `selected` + purga inválidos). `MultiSelectDropdown` con buscador + master checkbox indeterminate. Meses `MONTHS[12]` nombres completos. Municipio oculto si `dataset==victimas`, deshabilitado si `entidad==All`.
  - `SidebarLeft.jsx`: `Promise.all([/api/total_incidencia, /api/incidencia_por_entidad, +/api/incidencia_por_municipio si entidad!=All y no victimas])` con `AbortController`. KPI default `Sonora` si `Nacional`. Tabla entidades/municipios con rank `method=min`.
  - `ChartBarYears.jsx`: `/api/incidencia_por_anio` salvo `victimas_mun` que usa `/api/incidencia_por_mes_historico`. Click barra -> `GET /api/incidencia_por_delito?categoria=subtipo_delito` -> `DrillDownModal`.
  - `ChartLineTrend.jsx`: siempre `/api/incidencia_por_mes_historico` (sin param meses). Calcula promedio, max/min, regresión lineal (rojo alza, verde baja), MA 3/6/12.
  - `MapMexico.jsx`: nacional `/api/incidencia_por_entidad`, Sonora `/api/incidencia_por_municipio?entidad=Sonora`. Geo ` /mexico_geo.json` (`properties.nom_ent`) o `/sonora_geo.json` (`properties.MUN`), `geoMercator`, escala color `d3-scale scaleLinear([0,max]->[#eceef5,#455993])`, matching `normalize()` sin diacríticos. Click entidad no-victimas -> drill municipios; click municipio Sonora -> drill subtipos.
  - `TableTopCrimes.jsx`: `/api/incidencia_por_delito?categoria=...`, cats `bien_juridico|tipo_delito|subtipo_delito`. HUÉRFANO: importado en `PublicDashboard.jsx:8` pero nunca renderizado.
  - `HistoryRankings.jsx`: estado aislado (no usa `appliedFilters`), `selectedEntidad='Sonora'`, `/api/filtros` + `/api/ranking_historico?nivel=entidad&temporalidad=...&meses=Ene,..`. Y invertido `domain[1,32]`, `ReferenceArea 1-10 rojo, 11-20 ámbar, 21-32 verde`.
  - Transversales: `ExportMenu` (CSV/Copiar/PNG via `html-to-image`), `FullScreenHeader` (badges filtros), `DrillDownModal`, `InfoModal` (fuentes SESNSP, tasas CONAPO), `LoadingSpinner`.
- `utils/exportUtils.js`: `downloadCSV` con bloque `=== FILTROS APLICADOS ===` + BOM `\ufeff`, `downloadImage/toPng`, `downloadPNGFromSVG` (inlina estilos, oculta tooltip), `copyTableToClipboard` (TSV + `sonner` toast).
- Estilos: `index.css` vars `--bg-main #f4f7f9, --color-accent #455993, ...`, grid `.dashboard-grid` (1fr -> 768px 1fr 1fr -> 1024px 280px 1fr 1fr -> 1280px 300px 1.1fr 1fr), fullscreen `.fullscreen-immersive-overlay`. Resto inline. Sin Tailwind/CSS Modules.
- Visualizaciones: `recharts` Bar/Composed/Line siempre en `ResponsiveContainer`; `react-simple-maps` ComposableMap/Geographies/Geography.

## 8. Configuración

Backend `.env` (ver `.env.example`, `config.py:9-20`, `model_config env_file=".env"` relativo al cwd):
```
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ADMIN_USER=admin / ADMIN_PASSWORD=change_me (defaults código admin/admin)
JWT_SECRET=super_secret_key (default código "secret") / JWT_ALGORITHM=HS256
ENVIRONMENT=local
# UPLOADS_DIR, PARQUET_DIR, DATA_DIR (defaults backend/storage/uploads, backend/storage/parquet, backend/data)
```
Frontend `.env`: solo `VITE_API_URL` (ej local `http://127.0.0.1:8000`).

## 9. Ejecución local

Requiere venv + node_modules previos. Desde raíz o carpetas respectivas:
```
# Backend (terminal 1, desde backend/):
.\venv\Scripts\activate
pip install -r requirements.txt   # solo primera vez / si cambia
uvicorn app.main:app --reload --port 8000  # http://127.0.0.1:8000
# Frontend (terminal 2, desde frontend/):
npm install   # solo primera vez
npm run dev   # http://localhost:5173
# Atajos Windows:
iniciar.bat (lanza ambos con start cmd /k)
setup_backend.bat (rmdir venv, py -3.12 -m venv venv, pip install)
setup_frontend.bat (npm install)
convertir_datos.bat / python convertir_datos.py [--delitos --victimas --victimas-mun --salida-* --poblacion --salida-poblacion]
```
`config.py:env_file=".env"` solo funciona si cwd es `backend/`. `iniciar.bat` ya hace `cd backend/frontend`.

## 10. Build / deploy

- `render.yaml`: `dashboard-backend (python, PYTHON_VERSION 3.11.0, build pip install -r backend/requirements.txt, start cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT, env ENVIRONMENT=production + UPLOADS/PARQUET/DATA_DIR=/opt/render/... + CORS_ORIGINS=https://tu-frontend.onrender.com + disk 1GB en .../storage)` + `dashboard-frontend (static, build npm install && npm run build, publish frontend/dist, VITE_API_URL=https://dashboard-backend.onrender.com)`.
- `README.md` documenta también Railway (vars `ADMIN_USER/PASSWORD/JWT_SECRET/PARQUET/UPLOADS/DATA_DIR/CORS_ORIGINS` + `VITE_API_URL`). No verificado en deploy real.
- `vite.config.js`: solo `plugins:[react()], server.host 0.0.0.0, preview.host 0.0.0.0`. Sin proxy. `npm run build = vite build`, `preview = vite preview`.
- Persistencia: `storage/uploads/` ignorado por git (`backend/.gitignore`), `parquet/` sí commiteado. Recomendación README: generar Parquet local y subir solo `.parquet` en prod.

## 11. Convenciones del proyecto

- Nombres funciones backend español `obtener_*`, `get_poblacion_valor`, `build_where`, `reload_duckdb_views`; params frontend camelCase `bienJuridico,tipoDelito,subtipoDelito,rangoEdad,metric_type` que matchean query backend.
- Columnas con tildes/espacios siempre citadas `"Año","Bien jurídico afectado","Cve. Municipio"`.
- `dataset` como `DatasetEnum` query param; `metricType` UI `absolute|rate` -> API `metric_type`.
- Filtros multi-valor `|` para categóricos, `,` para `meses`. `All` = sin filtro. Arrays vacíos frontend = sin filtro.
- Frontend: importar `API_URL` de `src/api.js`, `axios.get` con `AbortController` + `axios.isCancel`, `selected vs applied` + badge `countPendingChanges`, `onInitialLoad` once con ref, fullscreen con `Escape` + `FullScreenHeader`, export vía `exportUtils` con filenames `tabla_*, incidencia_por_anio.csv, top_*`.
- Logs backend con `print` español. ETL verboso con `[OK]/[ERROR]`.

## 12. Reglas importantes para modificar

1. No cambiar nombres de columnas Parquet sin actualizar `COLUMNAS_ID_*` (ETL), `build_where`, `get_columns`, `Filters.jsx` y GeoJSON `nom_ent/MUN`.
2. No cambiar separadores `|`/`,` ni `metric_type` sin actualizar ambos lados.
3. No mover `backend/storage/parquet` sin actualizar `config.py` + `render.yaml` + `admin.py run_etl_process` args.
4. No agregar endpoint público sin `DatasetEnum` + `build_where` (verifica columna existente).
5. No tocar `reload_duckdb_views` sin entender import circular `main<->admin` (import diferido dentro de función) y caches globales.
6. No endurecer CORS sin probar admin cookie (`samesite/secure` + `withCredentials`).
7. No reintroducir `TableTopCrimes` sin agregarlo al grid + `componentsLoading` en `PublicDashboard`.
8. No renombrar `victimas`/`victimas_mun` sin revisar `isVictimas/isVictimasMun/isVictimasBase` en 5+ componentes + `val_col` + `exportUtils` + `FullScreenHeader` (ver `refactor.py` como antecedente de migración).
9. Ejecutar siempre desde `backend/` para que `.env` cargue; frontend necesita `VITE_API_URL` en build static.
10. No commitear `.env`, `venv/`, `storage/uploads/`, `node_modules/`, `dist/`.

## 13. Áreas delicadas (no modificar sin entender dependencias)

- `main.py:18-24` CORS `*` + `allow_credentials=True` ignora `settings.get_cors_origins_list`. Intencional en dev, inválido en spec prod.
- `main.py:81-82` `CACHE_MERGED_POP` se calcula pero nunca se usa.
- `main.py:328,392,98` default año `2026` hardcodeado en 3 sitios + `PublicDashboard.jsx:19` `anio:2026`. Cambiar en uno rompe tasas.
- `convertir_datos.py:444-465` `convertir_poblacion_csv` referencia `BARRA,nfc,reparar_encoding` definidos solo dentro de `convertir_csv` + `import chardet` no declarado -> `NameError/ImportError` seguro al procesar población. No tocar sin mover helpers a scope global y agregar `chardet` a requirements.
- `admin.py:70` `uploads_dir / file.filename` sin sanitizar (path traversal `../../`) + sin límite tamaño + validación solo headers `nrows=0`.
- `db` DuckDB global sin pool, `etl_status` dict global sin lock (raza en `run-etl` concurrente, mitigado parcialmente con check `processing`).
- `"N/D"` string en respuestas numéricas (`total_incidencia`, `incidencia_por_*` rate) — frontend ya hace passthrough en `formatNumber`, pero rompe si se asume number.
- `ranking_historico`: param `target_state="Sonora"` nunca usado; `entidad` filtro ignorado por diseño.
- `App.jsx:10-12` `ProtectedRoute` no protege; auth real en `AdminDashboard` vía `/api/admin/me -> navigate('/admin/login')`.
- `App.css` `.card{padding:2em}` colisiona con `.card` de `index.css`. Orden de import (`App.jsx:7` importa `App.css` después de `main.jsx:index.css`) define ganador.
- `index.html lang="en"` para app española; `build_output.txt` fallo histórico `prop-types` ya resuelto en `package.json` pero exige `npm install` limpio.
- Archivos muertos con rutas `d:\dev\Dashboard`: `fix_quotes.py, refactor.py, generate_pdf_analysis.py, check_pob.py (ruta data/... obsoleta), INSTRUCCIONES.md, README.md` (rutas ejemplo desactualizadas), `setup_backend.bat py -3.12` vs `render.yaml 3.11.0`.

## 14b. Sección Delitos Alto Impacto (2026-09-12, implementada; el spec de diseño ya se retiró)

- Modo solo-UI `dataset='alto_impacto'` (selector en `Header.jsx`, color `#b91c1c` en `DATASET_COLORS`). Al cable siempre sale `dataset=delitos&altoImpacto=a|b|CUSTOM:json` (`DatasetEnum` rechazaría `alto_impacto` con 422).
- Backend: `PRESET_ALTO_IMPACTO` + `_build_alto_impacto_clause()` en `main.py`; `build_where(..., altoImpacto=...)` une bloques con OR (AND dentro), todo parametrizado `?`. `CUSTOM:{b,t,s,m}` dinámico; token malformado se ignora; param `""` o sin bloques válidos fuerza `1=0` (vacío=vacío). Los 8 endpoints reenvían el param.
- Frontend: `INITIAL_FILTERS.altoImpacto`, `ALTO_IMPACTO_DEFAULT` (7 presets activas al entrar), customs `CUSTOM:` en estado `PublicDashboard` (persisten entre datasets). Cada componente que consulta mapea a `wireDataset` y anexa el param, incluidos drills (`ChartBarYears`, `MapMexico` vía `buildFilterParams`). `Filters.jsx` muestra chips + `+ Agregar delito` (conserva año/entidad/municipio/meses/métrica); modal nuevo `AltoImpactoModal.jsx` en cascada vía `/api/filtros?dataset=delitos`, dedup por config exacta (`utils/altoImpacto.js`), prohíbe `|` en nombres. Export con etiqueta `Delitos de Alto Impacto` + filenames `*alto_impacto*`.
- `HistoryRankings` y `TableTopCrimes` fuera de alcance (no envían ni aceptan `altoImpacto`).

## 14c. Pulido visual (2026-09-12)

- Tokens: `--color-accent-dark #38487a` (hovers), `--font-display Montserrat` (import real en `index.css`; Header/splash/KPI lo usan), sin `#2563eb` en renders (sombras con `rgba(69,89,147,*)`).
- `App.css` eliminado (colisionaba `.card`); `index.html lang="es"` + theme-color/description.
- Números siempre `toLocaleString('es-MX', ...)`; CSV `Suavizado (MA12)` en español.
- `:focus-visible` global con outline accent; transitions específicas (no `all`).
- `ChartTooltip.jsx` compartido (Barras/Línea, mismo lenguaje que rankings); `EmptyState.jsx` en Sidebar/Bar/Línea/Mapa (+ fullscreen); `toast.error` en todos los fetch públicos.
- KPI hero: cifra principal con display font + regla dorada; badges fullscreen monocromos pill; meses colapsables en `Filters` (default expandido).

## 14c. Fullscreen con escala (2026-09-12)

- Hook compartido `src/utils/fullscreenScale.js`: `useFullscreenScale(isFullScreen)` → factor `clamp(min(vw/1280, vh/720), 1.25, 1.75)` con listener `resize` (~1.5 a 1080p; mínimo 1.25 para que siempre se note); `scaleSize(base, s)`. En vista normal siempre 1 (sin cambios visuales).
- Barras/Líneas/Rankings: ticks, etiquetas y tooltips vía `F(n)`; slider de rango con prop `labelScale`; tooltip de rankings con prop `fs`.
- Tabla Sidebar: bloque fullscreen (variante `40px/120px`) escala fuentes y columnas; la variante compacta normal (`30px/80px`) intacta.
- Mapa: `mapWrapRef` + `ResizeObserver`; en fullscreen `scale = min(1.9w, 2.5h)` nacional o `min(8.9w, 8.7h)` Sonora (×0.96 margen), centros fijos; en normal se conservan constantes 1200/4000.
- `FullScreenHeader` solo existe en overlay: bump fijo (título 1.84rem, badges 0.83rem).

## 14. Dependencias importantes

- No quitar: `duckdb, pandas, pyarrow, fastapi, uvicorn, pydantic-settings, python-multipart, PyJWT` (backend runtime); `axios, react-router-dom, recharts, react-simple-maps, d3-scale, html-to-image, sonner` (frontend runtime).
- `openpyxl` está en requirements pero no se importa en `app/` ni ETL (posible resto). `d3-scale-chromatic`, `sonora.json/mexico.json`, `mapa.png`, `vite.svg`, `frontend/README.md` plantilla: no usados, candidatos a poda solo tras verificar build.
- Si algo no está claro (ej. contenido `cls/`, datos reales en parquet, Railway deploy), indicarlo explícitamente y leer el archivo/parquet antes de afirmar.

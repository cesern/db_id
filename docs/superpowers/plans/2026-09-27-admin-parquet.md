# Admin de datos por Parquet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apagar el admin actual por defecto y reemplazarlo por un admin que sube Parquet por conjunto, valida, muestra resumen, publica sin reiniciar y restaura la versión anterior; el ETL CSV→Parquet queda offline.

**Architecture:** Interruptor por variables de entorno (backend registra el router solo si la config es segura; frontend registra rutas solo con `VITE_ENABLE_ADMIN`). Un servicio `datastore` encapsula almacén (publicados/staging/backup/bitácora), validación y operaciones atómicas; `routes/admin.py` es una capa delgada sobre él y sobre `services/auth.py` (scrypt, JWT con CSRF, límite de intentos). DuckDB recarga vistas con `reload_duckdb_views()` apuntando a la carpeta de publicados.

**Tech Stack:** FastAPI, DuckDB, pyarrow, pandas, PyJWT, stdlib `hashlib.scrypt`; React 19 + axios; pytest + httpx (solo desarrollo).

**Spec:** `docs/superpowers/specs/2026-09-27-admin-parquet-design.md`

## Global Constraints

- Admin **apagado por defecto**: sin `ENABLE_ADMIN=true` → `/api/admin/*` 404; sin `VITE_ENABLE_ADMIN=true` → `/admin*` redirige a `/`.
- Railway hoy: **ningún cambio de variables**; el tablero público no cambia (GET abiertos, sin credenciales).
- Sin valores por defecto de credenciales: `ADMIN_USER`, `ADMIN_PASSWORD_HASH` obligatorios; `JWT_SECRET` ≥ 32 caracteres y distinto de `secret`, `super_secret_key`, `change_me`.
- Hash `scrypt$16384$8$1$<salt_b64>$<hash_b64>`; comparación con `hmac.compare_digest`.
- Conjuntos (lista cerrada) → archivo: `delitos`→`delitos.parquet`, `victimas`→`victimas.parquet`, `victimas_mun`→`victimas_mun.parquet`, `poblacion`→`pob_municipios.parquet`.
- `MAX_UPLOAD_MB` default 100; límite de login 5 fallos por IP en 15 min; sesión 8 h.
- Sin dependencias de runtime nuevas; `pytest` y `httpx` en `backend/requirements-dev.txt`.
- Compatibilidad: si existe `PARQUET_DIR`, es la carpeta de publicados.
- Textos de UI en español, tono sobrio; `convertir_datos.py` conserva argumentos y uso.
- Ejecutar backend y tests desde `backend/`.

## Review Focus

1. **Parquet válido pero de otro conjunto** (p. ej. víctimas subido en la casilla de delitos): debe rechazarse por columnas faltantes, no publicarse → test en Task 3 (`test_validate_rejects_wrong_dataset`).
2. **Nombres de columna con acentos en otra forma Unicode (NFD)** generados en otra máquina: deben aceptarse igual → test en Task 3 (`test_validate_accepts_nfd_columns`).
3. **Publicar sin nada en espera / restaurar sin respaldo**: respuesta 409 clara, sin tocar publicados → tests en Task 5.
4. **Recarga de DuckDB que falla tras mover el archivo**: se revierte al publicado anterior y el tablero sigue sirviendo → test en Task 3 (`test_publish_rolls_back_on_reload_error`).
5. **Sesión abierta tras redeploy con otro `JWT_SECRET`**: 401 y el panel manda al login, sin quedarse en blanco → test en Task 4 (`test_token_from_other_secret_rejected`) + verificación manual en Task 6.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `backend/app/config.py` (mod) | Variables nuevas + `admin_config_problems()` |
| `backend/app/main.py` (mod) | CORS según modo, carpeta de publicados, siembra, registro condicional del router |
| `backend/app/schemas_datos.py` (nuevo) | Columnas requeridas por conjunto, lista de meses, mapeo conjunto→archivo |
| `backend/app/services/datastore.py` (nuevo) | Almacén, validación, resumen, publicar/restaurar/descartar, candado, bitácora, siembra |
| `backend/app/services/auth.py` (reescrito) | scrypt, JWT con `csrf`, dependencias de sesión y CSRF, límite de intentos |
| `backend/app/tools/hash_password.py` (nuevo) | CLI para generar `ADMIN_PASSWORD_HASH` |
| `backend/app/routes/admin.py` (reescrito) | Endpoints del spec §6 |
| `backend/convertir_datos.py` (mod) | Importa columnas compartidas; población corregida |
| `backend/tests/` (nuevo) | `conftest.py`, `test_switch.py`, `test_schemas.py`, `test_datastore.py`, `test_auth.py`, `test_admin_api.py`, `test_etl_poblacion.py` |
| `backend/requirements-dev.txt` (nuevo) | `pytest`, `httpx` |
| `frontend/src/App.jsx` (mod) | Rutas admin condicionales, sin `ProtectedRoute` |
| `frontend/src/api.js` (mod) | `ADMIN_ENABLED`, `adminClient` |
| `frontend/src/components/admin/Login.jsx` (mod) | Usa `adminClient`, errores 401/429 |
| `frontend/src/components/admin/AdminDashboard.jsx` (reescrito) | Panel por tarjetas |
| `frontend/src/components/admin/DatasetCard.jsx` (nuevo) | Una tarjeta de conjunto |
| `frontend/src/components/admin/ConfirmDialog.jsx` (nuevo) | Diálogo accesible |
| `.env.example` ×2, `README.md`, `AGENTS.md` (mod) | Documentación |

---

### Task 1: Interruptor del admin (entregable solo, cierra el admin viejo)

**Files:**
- Modify: `backend/app/config.py`, `backend/app/main.py:18-26,95`, `frontend/src/App.jsx`, `frontend/src/api.js`
- Create: `backend/requirements-dev.txt`, `backend/tests/conftest.py`, `backend/tests/test_switch.py`

**Interfaces:**
- Produces: `settings.enable_admin: bool` (env `ENABLE_ADMIN`, default `False`); `main.ADMIN_ACTIVE: bool`; fixture `make_client(env: dict) -> TestClient` que aplica `monkeypatch.setenv` y recarga `app.config`, `app.services.auth`, `app.routes.admin`, `app.main` con `importlib.reload`; `api.js` exporta `ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === 'true'`.

- [ ] **Step 1:** Crear `backend/requirements-dev.txt` con `-r requirements.txt`, `pytest`, `httpx`; instalar: `venv\Scripts\pip install -r requirements-dev.txt`.
- [ ] **Step 2: Tests que fallan** en `tests/test_switch.py`:

```python
def test_admin_off_by_default(make_client):
    c = make_client({})
    assert c.post("/api/admin/login", json={"username": "a", "password": "b"}).status_code == 404

def test_public_cors_without_credentials_when_admin_off(make_client):
    c = make_client({})
    r = c.get("/api/filtros", headers={"Origin": "https://evil.example"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"
    assert "access-control-allow-credentials" not in r.headers
```

- [ ] **Step 3:** Run `venv\Scripts\python -m pytest tests/test_switch.py -v` → FAIL (login devuelve 401/422, CORS con credenciales).
- [ ] **Step 4: Implementar.** `config.py`: `enable_admin: bool = False`. `main.py`: `ADMIN_ACTIVE = settings.enable_admin`; si `ADMIN_ACTIVE` → `CORSMiddleware(allow_origins=settings.get_cors_origins_list, allow_credentials=True, ...)`, si no → `allow_origins=["*"], allow_credentials=False`; `app.include_router(admin.router)` solo si `ADMIN_ACTIVE` (Task 5 añade la validación de config). `App.jsx`: rutas `/admin`, `/admin/login`, `/admin/dashboard` solo si `ADMIN_ENABLED`; borrar `ProtectedRoute`.
- [ ] **Step 5:** Run tests → PASS. `npx vite build` en `frontend/` → OK. Con el backend local sin `ENABLE_ADMIN`: `curl -s -o NUL -w "%{http_code}" http://localhost:8000/api/admin/me` → `404`; abrir `http://localhost:5173/admin` → redirige a `/`.
- [ ] **Step 6: Commit** `feat(admin): apagado por defecto con ENABLE_ADMIN/VITE_ENABLE_ADMIN` y **push** (cierra el admin viejo en Railway sin cambiar variables).

---

### Task 2: Esquemas compartidos y ETL offline con población corregida

**Files:**
- Create: `backend/app/schemas_datos.py`, `backend/tests/test_schemas.py`, `backend/tests/test_etl_poblacion.py`
- Modify: `backend/convertir_datos.py:42-55,233-260,444-470`

**Interfaces:**
- Produces (`schemas_datos.py`):
  - `COLUMNAS_ID_DELITOS`, `COLUMNAS_ID_VICTIMAS`, `COLUMNAS_ID_VICTIMAS_MUN` (listas movidas tal cual de `convertir_datos.py`)
  - `MESES: list[str]` (`Enero`…`Diciembre`)
  - `DATASETS: dict[str, dict]` con claves `delitos|victimas|victimas_mun|poblacion`, cada uno `{"file": str, "label": str, "required": list[str], "value_col": str|None, "year_col": str, "month_col": str|None}`; `required` = columnas del spec §4.
  - `nfc(s: str) -> str`
- Produces (`convertir_datos.py`): funciones de módulo `nfc`, `reparar_encoding`, constante `BARRA`; `convertir_poblacion_csv(ruta_csv, salida_parquet, nombre) -> bool` sin `chardet`.

- [ ] **Step 1: Tests que fallan.** `test_schemas.py`: `DATASETS["victimas_mun"]["required"]` ⊇ `DATASETS["victimas"]["required"]` y contiene `"Municipio"`; `DATASETS["poblacion"]["file"] == "pob_municipios.parquet"`; los `required` de cada conjunto coinciden con el schema de `storage/parquet/<file>` (leer con `pyarrow.parquet.read_schema`, comparar con `nfc`). `test_etl_poblacion.py`: escribir en `tmp_path` un CSV latin-1 con columnas `CLAVE,CLAVE_ENT,NOM_ENT,NOM_MUN,AÑO,POB_MIT_MUN,POB_MIT_ENT` y 2 filas; `convertir_poblacion_csv(csv, out)` devuelve `True` y `pd.read_parquet(out).columns` contiene `"AÑO"`.
- [ ] **Step 2:** Run → FAIL (módulo inexistente; `NameError: BARRA` en población).
- [ ] **Step 3: Implementar.** Crear `schemas_datos.py`. En `convertir_datos.py`: `from app.schemas_datos import COLUMNAS_ID_DELITOS, ...` con fallback `sys.path.insert(0, str(BASE_DIR))` para ejecutarse suelto desde `backend/`; subir `nfc`, `reparar_encoding` y `BARRA` a nivel de módulo; en población leer con `utf-8-sig` y, ante `UnicodeDecodeError`, `latin-1` (igual que `convertir_csv`), quitar `import chardet`.
- [ ] **Step 4:** Run tests → PASS. `venv\Scripts\python convertir_datos.py --help` → sin error.
- [ ] **Step 5: Commit** `refactor(etl): columnas compartidas y conversión de población corregida`.

---

### Task 3: Servicio de almacén (`datastore`)

**Files:**
- Create: `backend/app/services/datastore.py`, `backend/tests/test_datastore.py`
- Modify: `backend/app/config.py` (variables `data_store_dir`, `data_store_persistent`, `max_upload_mb`)

**Interfaces:**
- Consumes: `schemas_datos.DATASETS`, `schemas_datos.MESES`, `schemas_datos.nfc`.
- Produces:
  - `class DataStore(root: Path, published_dir: Path, repo_dir: Path, reload: Callable[[], None], persistent: bool)`
  - `.seed() -> list[str]` (conjuntos copiados desde `repo_dir` si faltan)
  - `.stage(dataset: str, fileobj: BinaryIO, max_bytes: int) -> dict` → resumen; lanza `ValidationError(msg)` / `TooLargeError`
  - `.status() -> dict` (forma de `GET /datasets` del spec §6)
  - `.publish(dataset, user) -> dict`, `.restore(dataset, user) -> dict`, `.discard(dataset, user) -> None`; lanzan `NothingToDoError` y `BusyError`
  - `.log(limit=50) -> list[dict]`
  - `summarize(path: Path, dataset: str) -> dict` con claves `rows, year_min, year_max, last_month, total_last_year, size_mb, at`
  - `diff(new: dict, old: dict|None) -> dict` con `last_month`, `total_last_year` antes/después
  - Excepciones en el mismo módulo: `ValidationError`, `TooLargeError`, `NothingToDoError`, `BusyError`.

- [ ] **Step 1: Tests que fallan** (fixture crea Parquet mínimos con pandas en `tmp_path` para cada conjunto y un `reload` espía):
  - `test_seed_copies_missing_from_repo`
  - `test_stage_rejects_non_parquet` (bytes `b"hola"` → `ValidationError` con "no es un archivo Parquet")
  - `test_stage_rejects_too_large` (`max_bytes=10` → `TooLargeError`)
  - `test_validate_rejects_wrong_dataset` (Parquet de víctimas en `delitos` → mensaje contiene `"Cve. Municipio"`)
  - `test_validate_accepts_nfd_columns` (columnas en `unicodedata.normalize("NFD", ...)` → acepta)
  - `test_stage_rejects_bad_month` (`Mes="Enro"` → `ValidationError` con `"Mes"`)
  - `test_summary_values` (datos 2025 Ene–Dic y 2026 Ene–Ago → `year_max==2026`, `last_month=="Agosto"`, `total_last_year` = suma de 2026)
  - `test_publish_moves_backup_and_reloads` (tras `publish`: `backup/delitos.parquet` = anterior, publicado = nuevo, `reload` llamado 1 vez, entrada `publish` en bitácora)
  - `test_publish_rolls_back_on_reload_error` (`reload` lanza la 1.ª vez → publicado vuelve al anterior, excepción propagada)
  - `test_restore_swaps` y `test_restore_without_backup_raises` (`NothingToDoError`)
  - `test_publish_while_busy_raises` (candado tomado → `BusyError`)
- [ ] **Step 2:** Run `python -m pytest tests/test_datastore.py -v` → FAIL.
- [ ] **Step 3: Implementar.** Lectura en bloques de 1 MB hasta `max_bytes`; firma `PAR1` en los primeros y últimos 4 bytes; `pyarrow.parquet.read_schema`; columnas comparadas con `nfc`; chequeos de datos y resumen con una conexión DuckDB efímera (`duckdb.connect()`), `Año` en 2000–2100, `Mes` ∈ `MESES`, valor ≥ 0, ≥ 1 fila; resúmenes guardados como `<conjunto>.json` junto al archivo; movimientos con `os.replace`; candado `threading.Lock` con `acquire(blocking=False)`; bitácora JSONL (`at, user, action, dataset, summary`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(admin): servicio de almacén con validación, publicar y restaurar`.

---

### Task 4: Autenticación reforzada

**Files:**
- Rewrite: `backend/app/services/auth.py`
- Create: `backend/app/tools/__init__.py`, `backend/app/tools/hash_password.py`, `backend/tests/test_auth.py`
- Modify: `backend/app/config.py` (`admin_password_hash`, `trust_proxy`; quitar defaults de `admin_user`/`admin_password`/`jwt_secret`)

**Interfaces:**
- Produces:
  - `hash_password(pw: str) -> str`, `verify_password(pw: str, stored: str) -> bool`
  - `admin_config_problems(s: Settings) -> list[str]` (en `config.py`; vacío = config segura)
  - `cross_site() -> bool` (= `CORS_ORIGINS` con valor)
  - `create_session(username: str) -> tuple[str, str]` (token, csrf)
  - dependencias FastAPI `require_admin(request) -> str` y `require_csrf(request, user=Depends(require_admin)) -> str`
  - `cookie_kwargs() -> dict` (`httponly`, `max_age=8*3600`, `samesite` `"strict"`/`"none"`, `secure`)
  - `class LoginLimiter(max_fails=5, window_s=900)` con `.check(ip) -> int|None` (segundos de espera) y `.fail(ip)`, `.reset(ip)`

- [ ] **Step 1: Tests que fallan:**
  - `test_hash_roundtrip` (formato empieza con `"scrypt$16384$8$1$"`, verifica correcta, rechaza incorrecta)
  - `test_config_problems` (sin hash, secreto de 10 chars, secreto `"secret"` → cada uno reportado; config completa → `[]`)
  - `test_limiter_blocks_after_5` (5 `fail` → `check` devuelve > 0; `reset` → `None`)
  - `test_token_from_other_secret_rejected` (token firmado con otro secreto → `require_admin` lanza 401)
  - `test_csrf_required_cross_site` (con `CORS_ORIGINS` definido, header ausente o distinto → 403; igual → OK)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar.** `hashlib.scrypt(n=2**14, r=8, p=1, dklen=32)`, sal 16 bytes, base64 urlsafe. JWT HS256 con `sub`, `csrf` (`secrets.token_urlsafe(24)`), `exp` con `datetime.now(timezone.utc)`. IP: `X-Forwarded-For` solo si `trust_proxy`, tomando el valor en la posición `-TRUSTED_PROXY_HOPS` desde la derecha (default 1; el cliente puede falsificar los primeros valores); si la lista es más corta, `request.client.host`. `hash_password.py`: `getpass` dos veces, compara, imprime el hash.
- [ ] **Step 4:** Run → PASS. `python -m app.tools.hash_password` imprime una línea `scrypt$...`.
- [ ] **Step 5: Commit** `feat(admin): contraseña scrypt, sesión con CSRF y límite de intentos`.

---

### Task 5: Endpoints del admin y cableado en `main.py`

**Files:**
- Rewrite: `backend/app/routes/admin.py`
- Modify: `backend/app/main.py` (publicados = `settings.published_dir`; siembra; `ADMIN_ACTIVE = enable_admin and not admin_config_problems(settings)` con avisos `[DATOS] sembrado <conjuntos> desde el repo` y `[ADMIN] habilitado (modo mismo dominio|dominios distintos)` / `[ADMIN] deshabilitado: <motivos>`)
- Modify: `backend/app/config.py` (`published_dir` property: `PARQUET_DIR` si existe, si no `<data_store_dir>/parquet`)
- Create: `backend/tests/test_admin_api.py`

**Interfaces:**
- Consumes: `DataStore` (Task 3), `auth` (Task 4), `reload_duckdb_views` de `main`.
- Produces: rutas del spec §6 exactamente; `{c}` tipado `Literal["delitos","victimas","victimas_mun","poblacion"]`; errores: `ValidationError`→400, `TooLargeError`→413, `NothingToDoError`→409, `BusyError`→409, login fallido→401 `"Usuario o contraseña incorrectos"`, bloqueado→429 con `retry_after`.

- [ ] **Step 1: Tests que fallan** (cliente con `ENABLE_ADMIN=true`, hash de `"clave-de-prueba"`, secreto de 40 chars, `DATA_STORE_DIR=tmp_path`, `CORS_ORIGINS=http://localhost:5173`):
  - `test_unsafe_config_keeps_admin_off` (secreto corto → login 404)
  - `test_login_ok_returns_csrf_and_cookie`; `test_login_bad_401`; `test_sixth_failed_login_429`
  - `test_full_cycle` (upload delitos válido → 200 con resumen; `GET /datasets` muestra `staging`; publish → 200; `GET /api/total_incidencia?anio=<año>` refleja el nuevo total sin reiniciar; restore → vuelve al total anterior; `GET /log` tiene `upload, publish, restore`)
  - `test_publish_without_staging_409`; `test_restore_without_backup_409`
  - `test_mutations_need_csrf` (upload sin `X-CSRF-Token` → 403)
  - `test_unknown_dataset_422`
  - `test_old_endpoints_gone` (`/api/admin/run-etl` → 404)
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementar** rutas delgadas sobre `DataStore`; `DataStore` creado en `main.py` tras la carga inicial y pasado al router con `admin.init(store)`; borrar `etl_status`, `run_etl_process`, `/upload`, `/run-etl`, `/etl-status`, `/reload-db`.
- [ ] **Step 4:** Run toda la suite `python -m pytest -v` → PASS. Arrancar el backend local **sin** variables nuevas → tablero funciona y `/api/admin/me` 404.
- [ ] **Step 5: Commit** `feat(admin): endpoints por conjunto (subir, publicar, restaurar, bitácora)`.

---

### Task 6: Panel del admin (frontend)

**Files:**
- Modify: `frontend/src/api.js`, `frontend/src/components/admin/Login.jsx`
- Rewrite: `frontend/src/components/admin/AdminDashboard.jsx`
- Create: `frontend/src/components/admin/DatasetCard.jsx`, `frontend/src/components/admin/ConfirmDialog.jsx`

**Interfaces:**
- Consumes: endpoints de Task 5.
- Produces: `adminClient` (axios `withCredentials: true`, `baseURL: API_URL`, interceptor que añade `X-CSRF-Token` desde `setCsrfToken(token)`); `DatasetCard({ id, label, info, onChanged })`; `ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel })` con `role="dialog"`, `aria-modal`, foco inicial en Cancelar, Tab atrapado, Escape cancela.

- [ ] **Step 1: Implementar** según spec §8: Login (401 → "Usuario o contraseña incorrectos"; 429 → "Demasiados intentos, espera N minutos"); panel con encabezado, aviso ámbar si `persistent=false` (texto: "Los cambios se perderán en el próximo despliegue (sin volumen persistente)"), 4 tarjetas 2×2 (1 columna < 768px), zona de arrastre + botón "Elegir archivo" (`accept=".parquet"`), progreso con `onUploadProgress`, mensajes en `aria-live="polite"`, resumen "En espera" con diferencias ("hasta Sep 2026 (antes Ago)", "+2,744 en 2026"), **Publicar**/**Descartar**, enlace **Restaurar anterior** con `ConfirmDialog` ("¿Regresar Delitos a la versión del 27 sep 14:05?"), bitácora compacta, esqueleto al cargar, error con Reintentar; `/me` 401 → `navigate('/admin/login')`. Números con `toLocaleString('es-MX')`. Estilos con tokens de `index.css`.
- [ ] **Step 2:** `npx vite build` y `npx eslint src/components/admin` → sin errores nuevos.
- [ ] **Step 3: Verificación manual** (backend con `ENABLE_ADMIN=true`, hash, secreto, `CORS_ORIGINS=http://localhost:5173`, `DATA_STORE_DIR` temporal; frontend con `VITE_ENABLE_ADMIN=true`):
  - login correcto/incorrecto; 6 fallos → mensaje de espera;
  - subir `delitos.parquet` actual → resumen con diferencias 0 → Descartar;
  - subir un Parquet de víctimas en Delitos → error con columnas faltantes;
  - publicar un Parquet modificado → el tablero (otra pestaña) muestra el nuevo total tras recargar; Restaurar → vuelve;
  - aviso ámbar visible sin `DATA_STORE_PERSISTENT`;
  - diálogo: foco, Tab, Escape;
  - reiniciar backend con otro `JWT_SECRET` → el panel manda al login;
  - 375px: tarjetas en una columna, sin scroll horizontal.
- [ ] **Step 4: Commit** `feat(admin): panel por conjunto con revisar, publicar y restaurar`.

---

### Task 7: Documentación y verificación final

**Files:**
- Modify: `backend/.env.example`, `frontend/.env.example`, `README.md`, `AGENTS.md` (secciones 2, 3, 6, 8, 10, 13)

- [ ] **Step 1:** `.env.example` backend: bloque comentado con `ENABLE_ADMIN`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `CORS_ORIGINS`, `DATA_STORE_DIR`, `DATA_STORE_PERSISTENT`, `MAX_UPLOAD_MB`, `TRUST_PROXY`; quitar `ADMIN_PASSWORD`, `UPLOADS_DIR`. Frontend: `# VITE_ENABLE_ADMIN=true`. README: flujo offline (`convertir_datos.py` → Parquet → push) y resumen de cómo encender el admin (remitir a la guía privada). AGENTS.md: arquitectura nueva del admin, áreas delicadas actualizadas (quitar path traversal/ETL en servidor/CORS `*` con credenciales), comandos de tests.
- [ ] **Step 2:** `python -m pytest -v` (todo PASS), `npx vite build` OK; backend local sin variables nuevas → tablero completo en navegador y `/admin` redirige.
- [ ] **Step 3: Commit** `docs(admin): variables, flujo offline y arquitectura` y push.

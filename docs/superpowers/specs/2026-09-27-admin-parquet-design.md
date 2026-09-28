# Admin de datos por Parquet — Diseño

Fecha: 2026-09-27 · Estado: aprobado en conversación, pendiente de revisión escrita

## 1. Objetivo y contexto

- **Hoy:** el analista genera los Parquet en su computadora con `backend/convertir_datos.py` y hace push; Railway redespliega. El panel `/admin` (subida de CSV + ETL en servidor) no se usa y está expuesto con fallas de seguridad (credenciales por defecto, CORS `*` con cookies, nombre de archivo sin sanear, sin límite de tamaño).
- **Futuro:** el sistema se instalará en un servidor propio y ahí sí se actualizarán los datos desde `/admin`, subiendo **Parquet ya convertidos** (pesan poco), no CSV.
- **Resultado buscado:**
  1. Hoy en Railway el admin queda **apagado** por defecto sin cambiar nada en Railway.
  2. Encendido (servidor propio o Railway), el admin permite subir un Parquet por conjunto, ver un resumen, **publicar** sin reiniciar y **restaurar** la versión anterior.
  3. `convertir_datos.py` se conserva como herramienta **offline** (ya no la ejecuta el servidor) y se corrige su paso de población.

Fuera de alcance: varios usuarios, subida de CSV, ETL en servidor, cambios al tablero público.

## 2. Interruptor y modos

| Variable | Efecto |
|---|---|
| `ENABLE_ADMIN` (backend) | `true` registra `/api/admin/*`. Ausente/otro valor: el router no se registra (404) y CORS no permite cookies. |
| `VITE_ENABLE_ADMIN` (frontend, en build) | `true` registra las rutas `/admin*`. Ausente: `/admin*` redirige a `/`. |

**Arranque seguro:** con `ENABLE_ADMIN=true`, si falta `ADMIN_USER` o `ADMIN_PASSWORD_HASH`, o `JWT_SECRET` tiene menos de 32 caracteres o es un valor de ejemplo conocido, el admin **no se registra** y se imprime un aviso en el log. No existen valores por defecto (`admin/admin`, `secret`).

**Modo de sesión** (se deduce de `CORS_ORIGINS`):
- **Mismo dominio** (`CORS_ORIGINS` vacío): cookie `SameSite=Strict`, sin CORS para admin.
- **Dominios distintos** (`CORS_ORIGINS` con valor, p. ej. Railway): cookie `SameSite=None; Secure`, CORS con `allow_origins` = lista exacta y `allow_credentials=True`, y **token CSRF** obligatorio en operaciones que modifican.
- En modo de dominios distintos la cookie siempre es `Secure` (`SameSite=None` lo exige). Chrome y Firefox la aceptan en `http://localhost`; Safari no, así que para pruebas locales usar Chrome o el modo de mismo dominio.

Los endpoints públicos (GET) siguen aceptando cualquier origen **sin credenciales**.

## 3. Almacenamiento

`DATA_STORE_DIR` (por defecto `backend/storage`). Compatibilidad: si existe `PARQUET_DIR` (variable actual) se respeta como carpeta de publicados.

```
<DATA_STORE_DIR>/
  parquet/   delitos.parquet victimas.parquet victimas_mun.parquet pob_municipios.parquet   ← publicados (lo lee DuckDB)
  staging/   <conjunto>.parquet + <conjunto>.json (resumen)                                  ← en espera
  backup/    <conjunto>.parquet + <conjunto>.json                                            ← versión anterior (1 por conjunto)
  admin_log.jsonl                                                                             ← bitácora
```

- **Siembra:** al arrancar, si `parquet/` del almacén no tiene un archivo y el repo (`backend/storage/parquet/`) sí, se copia. Sin volumen o sin admin, el comportamiento es idéntico al actual.
- **Persistencia:** `GET /datasets` informa `persistent: true|false`. Se considera persistente si `DATA_STORE_DIR` está fuera del directorio de la app o si existe la variable `DATA_STORE_PERSISTENT=true`. El panel muestra aviso ámbar si es `false`.

Conjuntos (lista cerrada): `delitos`, `victimas`, `victimas_mun`, `poblacion` → archivos `delitos.parquet`, `victimas.parquet`, `victimas_mun.parquet`, `pob_municipios.parquet`.

## 4. Validación (módulo compartido)

Nuevo `backend/app/schemas_datos.py`, fuente única de columnas para ETL offline y admin:

| Conjunto | Columnas requeridas |
|---|---|
| delitos | Año, Clave_Ent, Entidad, Cve. Municipio, Municipio, Bien jurídico afectado, Tipo de delito, Subtipo de delito, Modalidad, Mes, Incidencia |
| victimas | Año, Clave_Ent, Entidad, Bien jurídico afectado, Tipo de delito, Subtipo de delito, Modalidad, Sexo, Rango de edad, Mes, Víctimas |
| victimas_mun | las de victimas + Cve. Municipio, Municipio |
| poblacion | CLAVE, CLAVE_ENT, NOM_ENT, NOM_MUN, AÑO, POB_MIT_MUN, POB_MIT_ENT |

`convertir_datos.py` importa `COLUMNAS_ID_*` desde ahí (con fallback de ruta para ejecutarse suelto).

Reglas al subir (en este orden; el primer fallo corta y se borra staging):
1. Tamaño ≤ `MAX_UPLOAD_MB` (default 100), leído en bloques.
2. Firma `PAR1` al inicio y al final.
3. `pyarrow.parquet.read_schema` legible; columnas comparadas con normalización NFC.
4. Columnas requeridas presentes (mensaje lista las faltantes).
5. Datos: `Año` entero en 2000–2100; `Mes` dentro de Enero…Diciembre; valor (`Incidencia`/`Víctimas`) numérico y finito (se permiten negativos: ajustes del SESNSP, contados en `negative_rows` del resumen); al menos 1 fila. Población: `AÑO` entero y `POB_MIT_*` numéricos.

**Resumen** (`<conjunto>.json`): filas, año mínimo/máximo, último mes con total > 0 del año máximo, total del año máximo (hasta ese mes), tamaño en MB, fecha. Se calcula con DuckDB sobre el archivo en staging. La comparación se hace contra el resumen del publicado (se genera y guarda la primera vez que se consulta).

## 5. Operaciones

- **Subir** → staging + validación + resumen. Si ya había algo en espera, se reemplaza.
- **Publicar** (con candado global): publicado → `backup/` (reemplaza el respaldo previo); staging → `parquet/` con `os.replace` (atómico en el mismo volumen); `reload_duckdb_views()`; bitácora. Si la recarga falla, se revierte (backup → parquet) y se recarga de nuevo; la respuesta indica el error.
- **Restaurar anterior**: intercambia backup ↔ publicado (el publicado actual queda como backup), recarga, bitácora.
- **Descartar**: borra staging.
- Candado: `threading.Lock` global; si está tomado, `409 Operación en curso`.

## 6. API (`/api/admin`, solo con admin encendido)

| Método | Ruta | Auth | Respuesta |
|---|---|---|---|
| POST | `/login` | — | `{ username, csrf_token }` + cookie. 401 genérico; 429 con `retry_after` si excede intentos |
| POST | `/logout` | sesión | borra cookie |
| GET | `/me` | sesión | `{ username, csrf_token }` (renueva token para recargas de página) |
| GET | `/datasets` | sesión | `{ persistent, datasets: { <c>: { published: resumen, staging: resumen+diff|null, has_backup, backup: resumen|null } } }` |
| POST | `/datasets/{c}/upload` | sesión+CSRF | multipart `file` → `{ staging: resumen, diff }` o 400/413 con `detail` |
| POST | `/datasets/{c}/publish` | sesión+CSRF | `{ published }` |
| POST | `/datasets/{c}/restore` | sesión+CSRF | `{ published }` |
| DELETE | `/datasets/{c}/staging` | sesión+CSRF | 204 |
| GET | `/log?limit=50` | sesión | lista de entradas |

`{c}` es `Literal['delitos','victimas','victimas_mun','poblacion']` (422 si no). CSRF: encabezado `X-CSRF-Token` igual al claim `csrf` del JWT de sesión (se exige solo en modo dominios distintos; en mismo dominio se acepta igual si viene).

Se eliminan: `/upload` (CSV), `/run-etl`, `/etl-status`, `/reload-db`, el estado global `etl_status` y la ejecución de `convertir_datos.py` en servidor.

## 7. Seguridad

- Contraseña: `ADMIN_PASSWORD_HASH` en formato `scrypt$n$r$p$salt_b64$hash_b64` (stdlib `hashlib.scrypt`, n=2^14, r=8, p=1). Comparación con `hmac.compare_digest`. Generador: `python -m app.tools.hash_password` (pide la contraseña sin eco).
- JWT HS256 con `sub`, `csrf`, `exp` (8 h); `datetime.now(timezone.utc)`.
- Límite de intentos: 5 fallos por IP en 15 min (memoria). IP de `X-Forwarded-For` solo si `TRUST_PROXY=true`, contando `TRUSTED_PROXY_HOPS` valores desde la derecha (default 1).
- Subidas: el nombre del archivo se ignora; tamaño limitado; se lee solo con pyarrow/DuckDB.
- Bitácora: fecha ISO, usuario, acción (`upload|publish|restore|discard|login_fail`), conjunto, resumen corto; sin datos sensibles.

## 8. Frontend

- `App.jsx`: rutas `/admin`, `/admin/login`, `/admin/dashboard` solo si `import.meta.env.VITE_ENABLE_ADMIN === 'true'`; se elimina el `ProtectedRoute` no-op.
- `src/api.js`: añade `adminClient` (axios con `withCredentials: true` e interceptor que pone `X-CSRF-Token`). Login y panel usan `API_URL` de `api.js` (se quitan los fallbacks distintos).
- `Login.jsx`: mismo formulario; error genérico; mensaje de espera en 429.
- `AdminDashboard.jsx` (reescrito, estilo sobrio del tablero):
  - Encabezado "Administración de datos", usuario, Cerrar sesión; aviso ámbar si `persistent=false`.
  - 4 tarjetas (2×2; 1 columna < 768px): Publicado (resumen + fecha), zona de carga (arrastrar o botón "Elegir archivo", progreso, `aria-live`), En espera (resumen con diferencias marcadas; **Publicar** / **Descartar**), enlace **Restaurar anterior** con diálogo de confirmación (`role="dialog"`, foco atrapado, Escape).
  - Bitácora compacta (últimas 50).
  - Estados: esqueleto al cargar, error con Reintentar, "Publicando…" en el botón y marca breve "Publicado".

## 9. ETL offline (`convertir_datos.py`)

- Sin cambios de uso ni de argumentos.
- Corrección de población: `BARRA`, `nfc` y `reparar_encoding` pasan a nivel de módulo; `chardet` se reemplaza por el mismo intento `utf-8-sig → latin-1` que usa `convertir_csv` (sin dependencia nueva).
- `COLUMNAS_ID_*` se importan de `app/schemas_datos.py`.

## 10. Configuración y despliegue

- Railway hoy: **ningún cambio**. Sin `ENABLE_ADMIN`/`VITE_ENABLE_ADMIN` el admin no existe; los Parquet se leen de la misma carpeta.
- Encender el admin en Railway o en servidor propio: guía detallada fuera del repo en `docs/privado/railway-admin.md` (en `.gitignore`).
- `.env.example` (backend y frontend), `README.md` y `AGENTS.md` se actualizan con las variables nuevas y el flujo.
- `requirements-dev.txt` (nuevo) con `pytest` y `httpx`; `requirements.txt` sin dependencias nuevas de runtime.

## 11. Pruebas

Backend (`backend/tests/`, pytest, con Parquet mínimos generados en `tmp_path`):
- Admin apagado → `/api/admin/login` 404.
- Arranque seguro: secreto corto o sin hash → admin no registrado.
- Login correcto/incorrecto; 6.º intento fallido → 429.
- Upload: extensión/firma inválida 400; columnas faltantes 400 con lista; > límite 413; válido → resumen correcto.
- Publish: mueve a backup, publica, recarga (tablero ve el nuevo total), bitácora escrita; fallo de recarga → revierte.
- Restore: intercambia y recarga.
- Candado: operación simultánea → 409.
- CSRF: modo dominios distintos sin encabezado → 403; con encabezado → OK.
- Siembra: almacén vacío se llena desde el repo.

Manual (navegador): flujo completo en mismo dominio (proxy de Vite) y en dominios distintos (5173 ↔ 8000); aviso de no persistente; tablero actualizado sin reiniciar; accesibilidad del diálogo; `/admin` redirige con el admin apagado.

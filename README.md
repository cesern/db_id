# Dashboard de Incidencia Delictiva

Sistema analítico para visualización y exploración de datos de incidencia delictiva (SESNSP + población CONAPO), con backend en FastAPI y frontend en React + Vite.
La plataforma usa DuckDB en memoria sobre archivos Parquet para consultas rápidas sin base de datos tradicional.

---

# Arquitectura del Proyecto

```txt
backend/
├── app/
│   ├── main.py               # API pública (DuckDB + vistas sobre Parquet)
│   ├── routes/admin.py       # /api/admin (solo con el admin encendido)
│   ├── services/auth.py      # contraseña scrypt, sesión JWT + CSRF, límite de intentos
│   ├── services/datastore.py # almacén: publicados, en espera, respaldo, bitácora
│   ├── schemas_datos.py      # columnas por conjunto (ETL y admin)
│   └── tools/hash_password.py
├── storage/parquet/          # Parquet publicados en el repo (semilla)
├── tests/                    # pytest
└── convertir_datos.py/.bat   # ETL offline CSV -> Parquet

frontend/
├── src/                      # Aplicación React (tablero público + /admin opcional)
└── public/
```

---

# Tecnologías Utilizadas

- **Backend:** Python, FastAPI, DuckDB, pandas, PyArrow, PyJWT.
- **Frontend:** React, Vite, Axios, Recharts, react-simple-maps.

---

# Desarrollo Local

## Backend

```bash
cd backend
cp .env.example .env            # opcional; sin .env el tablero funciona y el admin queda apagado
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Ejecutar siempre desde `backend/` para que se lea `.env`.

## Frontend

```bash
cd frontend
cp .env.example .env            # VITE_API_URL=http://127.0.0.1:8000
npm install
npm run dev
```

## Pruebas

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

---

# Actualización de datos

Hay dos caminos; ambos terminan en los mismos cuatro archivos:
`delitos.parquet`, `victimas.parquet`, `victimas_mun.parquet`, `pob_municipios.parquet`.

## 1. Offline (flujo habitual)

1. Convertir los CSV anchos (meses como columnas) a Parquet en la computadora del analista:
   ```bash
   cd backend
   python convertir_datos.py --delitos ruta/delitos.csv --victimas ruta/victimas.csv \
     --victimas-mun ruta/victimas_mun.csv --poblacion ruta/pob_municipios.csv
   # o en Windows: convertir_datos.bat
   ```
   Por defecto escribe en `backend/storage/parquet/`.
2. Revisar el tablero en local, hacer commit de los `.parquet` y push. El despliegue (p. ej. Railway) se reconstruye con los nuevos archivos.

El servidor ya no ejecuta el ETL ni recibe CSV.

## 2. Desde el panel `/admin` (si está encendido)

Por conjunto (`delitos`, `victimas`, `victimas_mun`, `poblacion`):

1. **Subir** un Parquet ya convertido (límite `MAX_UPLOAD_MB`, 100 MB por defecto). Se valida (firma Parquet, columnas requeridas, años, meses, valores numéricos) y queda **en espera**.
2. **Revisar** el resumen (filas, años, último mes con datos, total, filas con valores negativos) y su diferencia contra lo publicado.
3. **Publicar**: la versión publicada pasa a respaldo y la nueva se activa sin reiniciar. Si la recarga falla, se revierte sola.
4. **Restaurar**: intercambia el respaldo con la versión publicada.

También se puede descartar lo que está en espera. Todas las operaciones quedan en la bitácora (`admin_log.jsonl`).

---

# Panel administrativo

**Apagado por defecto.** Sin variables nuevas, `/api/admin/*` responde 404 y `/admin` redirige a `/`.

Para encenderlo:

- **Backend:** `ENABLE_ADMIN=true`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH` (generar con `python -m app.tools.hash_password` desde `backend/`) y `JWT_SECRET` de 32 caracteres o más. Si falta algo o es inseguro, el admin no se registra y el log indica el motivo.
- **Frontend:** construir con `VITE_ENABLE_ADMIN=true`.
- **Modo de sesión:** `CORS_ORIGINS` vacío = mismo dominio (cookie `SameSite=Strict`); con valor = dominios distintos (orígenes exactos, cookie `SameSite=None; Secure` y token CSRF).
- **Almacenamiento:** `DATA_STORE_DIR` (por defecto `backend/storage`). En producción conviene un volumen persistente; sin él, lo publicado desde el admin se pierde al redesplegar (el panel lo advierte).

Todas las variables están explicadas en `backend/.env.example` y `frontend/.env.example`.
La guía paso a paso para encenderlo en un despliegue está en `docs/privado/` (no se versiona).

---

# Variables de Entorno

## Backend (resumen; detalle en `backend/.env.example`)

| Variable | Uso |
|---|---|
| `ENVIRONMENT` | `local` o `production` (cookie `Secure` fuera de local) |
| `CORS_ORIGINS` | Orígenes exactos (dominios distintos) o vacío (mismo dominio) |
| `ENABLE_ADMIN`, `ADMIN_USER`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET` | Admin |
| `DATA_STORE_DIR`, `DATA_STORE_PERSISTENT`, `MAX_UPLOAD_MB` | Almacén del admin |
| `TRUST_PROXY`, `TRUSTED_PROXY_HOPS` | IP real detrás de proxy (límite de intentos) |
| `PARQUET_DIR` | Legado: carpeta de publicados |

## Frontend

```env
VITE_API_URL=http://localhost:8000
# VITE_ENABLE_ADMIN=true
```

---

# Despliegue

- **Backend:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`, **un solo worker** (el candado del almacén es por proceso).
- **Frontend:** estático (`npm run build`, publicar `frontend/dist`) con `VITE_API_URL` definido en el build.
- Con volumen: los Parquet del repo solo siembran los archivos que falten; ya no sobrescriben lo publicado desde el admin.

---

# Git y archivos ignorados

`.env`, `venv/`, `node_modules/`, `dist/`, `storage/uploads/`, `storage/parquet/*.json` (resúmenes en caché) y `docs/privado/`.

---

# Notas

- DuckDB trabaja directamente sobre Parquet, sin motor SQL tradicional.
- Los valores negativos en los datos son ajustes oficiales del SESNSP y se aceptan.

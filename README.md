# Dashboard de Incidencia Delictiva

Sistema analítico para visualización y exploración de datos de incidencia delictiva, desarrollado con un backend en FastAPI y un frontend moderno en React + Vite.  
La plataforma utiliza DuckDB y archivos Parquet optimizados para ofrecer consultas rápidas y eficientes sobre grandes volúmenes de información.

---

# Arquitectura del Proyecto

```txt
backend/
├── app/                  # API FastAPI
├── storage/
│   ├── uploads/          # CSV subidos desde el panel admin
│   └── parquet/          # Archivos parquet optimizados
├── data/                 # Catálogos estáticos
└── convertir_datos.py    # Proceso ETL

frontend/
├── src/                  # Aplicación React
└── public/
```

---

# Tecnologías Utilizadas

## Backend
- Python
- FastAPI
- DuckDB
- pandas
- PyArrow
- JWT Authentication

## Frontend
- React
- Vite
- Axios
- Recharts

---

# Características Principales

- Dashboard interactivo de incidencia delictiva.
- Consultas rápidas usando DuckDB + Parquet.
- Panel administrativo protegido con autenticación JWT.
- Subida de archivos CSV desde el navegador.
- Conversión ETL automática a formato Parquet optimizado.
- Recarga dinámica de la base analítica sin reiniciar el servidor.
- Compatible con despliegues cloud ligeros.

---

# Desarrollo Local

## Backend

### 1. Navegar al backend
```bash
cd backend
```

### 2. Crear archivo de entorno
```bash
cp .env.example .env
```

### 3. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 4. Ejecutar servidor
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Frontend

### 1. Navegar al frontend
```bash
cd frontend
```

### 2. Crear archivo de entorno
```bash
cp .env.example .env
```

### 3. Configurar URL del backend
```env
VITE_API_URL=http://localhost:8000
```

### 4. Instalar dependencias
```bash
npm install
```

### 5. Ejecutar entorno de desarrollo
```bash
npm run dev
```

---

# Variables de Entorno

## Backend

```env
ADMIN_USER=admin
ADMIN_PASSWORD=tu_password
JWT_SECRET=tu_secret
ENVIRONMENT=local

UPLOADS_DIR=/app/storage/uploads
PARQUET_DIR=/app/storage/parquet
DATA_DIR=/app/data

CORS_ORIGINS=http://localhost:5173
```

---

## Frontend

```env
VITE_API_URL=http://localhost:8000
```

---

# Despliegue en Railway

El proyecto está preparado para despliegue automático mediante GitHub + Railway.

## Backend
- Servicio Python/FastAPI.
- Requiere configurar:
  - `ADMIN_USER`
  - `ADMIN_PASSWORD`
  - `JWT_SECRET`
  - `PARQUET_DIR`
  - `UPLOADS_DIR`
  - `DATA_DIR`
  - `CORS_ORIGINS`

## Frontend
- Servicio React/Vite.
- Requiere:
  - `VITE_API_URL`

---

# Persistencia de Datos

Los archivos CSV originales se almacenan en:

```txt
storage/uploads/
```

Los archivos optimizados utilizados por DuckDB se almacenan en:

```txt
storage/parquet/
```

Para entornos con almacenamiento limitado, se recomienda:
- generar los archivos Parquet localmente,
- subir únicamente los `.parquet`,
- evitar almacenar CSV pesados en producción.

---

# Panel Administrativo

Ruta:

```txt
/admin
```

Funciones:
- autenticación segura,
- subida de CSV,
- ejecución de ETL,
- recarga de vistas DuckDB,
- monitoreo del estado del procesamiento.

---

# Git y Archivos Ignorados

El proyecto ignora:
- archivos temporales,
- entornos virtuales,
- uploads pesados,
- archivos sensibles.

Ejemplo:

```gitignore
.env
venv/
__pycache__/
storage/uploads/
```

---

# Datos Estáticos

El archivo:

```txt
backend/data/pob_municipios.csv
```

sí se incluye en el repositorio debido a que:
- es pequeño,
- funciona como catálogo base,
- es necesario para cálculos de tasas poblacionales.

---

# Notas

- El sistema está optimizado para consultas analíticas rápidas.
- DuckDB funciona directamente sobre archivos Parquet sin necesidad de un motor SQL tradicional.
- Railway Free tiene limitaciones de almacenamiento; para producción se recomienda persistencia adicional o almacenamiento externo.

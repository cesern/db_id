# Dashboard Proyecto

Este proyecto contiene un backend en FastAPI y un frontend en React (Vite). Está preparado para despliegue en Render y manejo eficiente de datos.

## Estructura

- `backend/`: API en FastAPI.
  - Usa DuckDB y pandas para análisis de datos sobre archivos Parquet.
  - Los datos pesados se suben mediante un panel de administrador y se guardan en un volumen persistente.
- `frontend/`: SPA en React (Vite).
  - Consume el API del backend.

## Desarrollo Local

### Backend
1. Navegar a `backend/`
2. Copiar `.env.example` a `.env`
3. Instalar dependencias: `pip install -r requirements.txt`
4. Ejecutar el servidor: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

### Frontend
1. Navegar a `frontend/`
2. Copiar `.env.example` a `.env` y configurar `VITE_API_URL`
3. Instalar dependencias: `npm install`
4. Ejecutar entorno de desarrollo: `npm run dev`

## Despliegue en Render

El repositorio cuenta con un archivo `render.yaml` (IaC) para desplegar fácilmente:
- **Dashboard Backend**: Un servicio web en Python. Requiere variables de entorno de admin (`ADMIN_PASSWORD`, `JWT_SECRET`). Usa un disco de 1GB en `/opt/render/project/src/backend/storage` para que los uploads y archivos parquet no se borren en cada despliegue.
- **Dashboard Frontend**: Un sitio estático. Requiere definir `VITE_API_URL` apuntando a la URL del backend de Render (se configurará de manera automática en el Blueprint, pero debes asegurarte de que coincidan).

### Subida de Datos (Población)
El archivo `backend/data/pob_municipios.csv` está incluido en el repositorio como excepción porque es un catálogo estático pequeño y vital. Los datos delictivos (subidos desde el Admin) se omiten en Git.

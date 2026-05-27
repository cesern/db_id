# Guía de Ejecución del Dashboard

Este proyecto consta de dos partes: un **Backend** hecho en Python (FastAPI) y un **Frontend** hecho en Node.js (React + Vite). A continuación se explican los pasos detallados para ejecutar ambos sistemas localmente.

---

## 1. Configuración y Ejecución del Backend (Python)

El backend utiliza un entorno virtual para no interferir con las instalaciones globales de tu computadora.

### Abrir una terminal en Windows (PowerShell o CMD)

1. Navega a la carpeta del backend:
   ```bash
   cd d:\dev\Dashboard\backend
   ```

2. Activa el entorno virtual (si no existe, debes crearlo primero con `python -m venv venv`):
   ```bash
   .\venv\Scripts\activate
   ```
   *(Deberías ver `(venv)` al inicio de la línea de comandos indicando que está activo).*

3. Instala las dependencias (solo es necesario la primera vez o si el archivo `requirements.txt` cambia):
   ```bash
   pip install -r requirements.txt
   ```

4. Ejecuta el servidor FastAPI usando Uvicorn:
   ```bash
   uvicorn app.main:app --reload
   ```
   El servidor se iniciará y estará disponible en: **http://127.0.0.1:8000**

---

## 2. Configuración y Ejecución del Frontend (Node.js/React)

El frontend requiere Node.js instalado en tu sistema. Las librerías se instalan localmente en la carpeta `node_modules`.

### Abrir OTRA terminal (mantén la del backend corriendo)

1. Navega a la carpeta del frontend:
   ```bash
   cd d:\dev\Dashboard\frontend
   ```

2. Instala las dependencias (solo es necesario la primera vez o si el archivo `package.json` cambia):
   ```bash
   npm install
   ```

3. Ejecuta el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```
   El dashboard estará disponible en tu navegador, generalmente en: **http://localhost:5173** (la terminal te indicará el enlace exacto).

---

## Resumen de Ejecución Rápida (Día a Día)

Una vez que ya instalaste todo (`pip install` y `npm install`), la rutina para trabajar es simple:

**Terminal 1 (Backend):**
```bash
cd d:\dev\Dashboard\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload
```

**Terminal 2 (Frontend):**
```bash
cd d:\dev\Dashboard\frontend
npm run dev
```

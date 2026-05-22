from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, BackgroundTasks
from pydantic import BaseModel
import shutil
from pathlib import Path
import subprocess
import sys
import pandas as pd
from datetime import timedelta
import time

from app.config import settings
from app.services.auth import create_access_token, get_current_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

class LoginRequest(BaseModel):
    username: str
    password: str

# Estado del ETL
etl_status = {
    "status": "idle", # idle, processing, completed, error
    "message": "",
    "details": ""
}

@router.post("/login")
async def login(credentials: LoginRequest, response: Response):
    if credentials.username == settings.admin_user and credentials.password == settings.admin_password:
        access_token = create_access_token(
            data={"sub": credentials.username}, expires_delta=timedelta(hours=8)
        )

        is_secure = settings.environment != "local"

        response.set_cookie(
            key="admin_session",
            value=access_token,
            httponly=True,
            max_age=8 * 3600,
            samesite="none" if is_secure else "lax",
            secure=is_secure
        )

        return {"message": "Login exitoso"}

    raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("admin_session")
    return {"message": "Sesión finalizada"}

@router.get("/me")
async def get_me(username: str = Depends(get_current_admin)):
    return {"username": username}

@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...), 
    username: str = Depends(get_current_admin)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos CSV")
    
    # Restricción de tamaño implícita o leída en chunks
    uploads_dir = Path(settings.uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = uploads_dir / file.filename
    
    # Validar formato con pandas (leer solo primera línea para columnas)
    try:
        # Guardar archivo temporal
        temp_path = file_path.with_suffix('.tmp')
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Intentar leer columnas (manejo básico de encodings)
        try:
            df_test = pd.read_csv(temp_path, nrows=0, encoding="utf-8-sig")
        except:
            df_test = pd.read_csv(temp_path, nrows=0, encoding="latin-1")
            
        # Si pasó, renombrar archivo final
        shutil.move(temp_path, file_path)
        return {"message": f"Archivo {file.filename} validado y subido con éxito", "columns": df_test.columns.tolist()}
    
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=400, detail=f"Error validando CSV: {str(e)}")

import os

def run_etl_process():
    global etl_status
    etl_status["status"] = "processing"
    etl_status["message"] = "Iniciando conversión de datos..."
    etl_status["details"] = ""
    
    base_dir = Path(__file__).resolve().parent.parent.parent
    script_path = base_dir / "convertir_datos.py"
    
    try:
        # Forzar UTF-8 para evitar UnicodeEncodeError en Windows
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        # Ejecutamos convertir_datos.py como subprocess
        # Pasamos las rutas para que los archivos vayan a los lugares correctos
        process = subprocess.Popen(
            [
                sys.executable, str(script_path),
                "--delitos", str(Path(settings.uploads_dir) / "delitos_combinado.csv"),
                "--victimas", str(Path(settings.uploads_dir) / "victimas_combinado.csv"),
                "--victimas-mun", str(Path(settings.uploads_dir) / "victimas_combinado_municipal_2026.csv"),
                "--salida-delitos", str(Path(settings.parquet_dir) / "delitos.parquet"),
                "--salida-victimas", str(Path(settings.parquet_dir) / "victimas.parquet"),
                "--salida-victimas-mun", str(Path(settings.parquet_dir) / "victimas_mun.parquet"),
                "--poblacion", str(Path(settings.data_dir) / "pob_municipios.csv"),
                "--salida-poblacion", str(Path(settings.parquet_dir) / "pob_municipios.parquet")
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            cwd=str(base_dir),
            env=env
        )
        
        stdout, stderr = process.communicate()
        
        if process.returncode == 0:
            etl_status["status"] = "processing"
            etl_status["message"] = "ETL exitoso. Recargando base de datos DuckDB..."
            
            # Recargar vistas en DuckDB
            from app.main import reload_duckdb_views
            reload_duckdb_views()
            
            etl_status["status"] = "completed"
            etl_status["message"] = "Proceso completado exitosamente."
            etl_status["details"] = stdout
        else:
            etl_status["status"] = "error"
            etl_status["message"] = "Error durante el ETL."
            etl_status["details"] = stderr
            
    except Exception as e:
        etl_status["status"] = "error"
        etl_status["message"] = f"Fallo al ejecutar proceso: {str(e)}"

@router.post("/run-etl")
async def run_etl(
    background_tasks: BackgroundTasks, 
    username: str = Depends(get_current_admin)
):
    global etl_status
    if etl_status["status"] == "processing":
        raise HTTPException(status_code=400, detail="El proceso ya está en ejecución")
        
    background_tasks.add_task(run_etl_process)
    return {"message": "Proceso ETL iniciado en segundo plano"}

@router.get("/etl-status")
async def get_etl_status(username: str = Depends(get_current_admin)):
    return etl_status

@router.post("/reload-db")
async def reload_db(username: str = Depends(get_current_admin)):
    try:
        from app.main import reload_duckdb_views
        reload_duckdb_views()
        return {"message": "Base de datos recargada exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

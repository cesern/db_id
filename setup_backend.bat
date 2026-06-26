@echo off
cd /d "%~dp0"

echo ======================================
echo Configurando BACKEND...
echo ======================================

cd backend

echo Eliminando entorno virtual anterior si existe...
if exist venv (
    rmdir /s /q venv
)

echo Creando nuevo entorno virtual...
py -3.12 -m venv venv

echo Activando entorno virtual...
call venv\Scripts\activate

echo Actualizando pip...
python -m pip install --upgrade pip

echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo ======================================
echo BACKEND listo.
echo Para iniciarlo usa:
echo python -m uvicorn app.main:app --reload --port 8000
echo ======================================

pause
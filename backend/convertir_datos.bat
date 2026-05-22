@echo off
REM ========================================================
REM  convertir_datos.bat
REM  Ejecuta el script de conversion CSV->Parquet dentro del venv
REM  Uso: doble clic o ejecutar desde la carpeta backend\
REM ========================================================

setlocal
cd /d "%~dp0"

set PYTHON=%~dp0venv\Scripts\python.exe
set PYTHONIOENCODING=utf-8

if not exist "%PYTHON%" (
    echo [ERROR] No se encontro el venv. Ejecuta primero:
    echo   python -m venv venv
    echo   venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo Iniciando conversion CSV a Parquet...
echo.
"%PYTHON%" convertir_datos.py %*

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Conversion completada exitosamente.
) else (
    echo.
    echo [ERROR] La conversion termino con errores.
)

pause
